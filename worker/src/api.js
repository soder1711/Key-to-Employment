import {
  getEmployeeTasks, getTaskDetail, updateAssignmentProgress,
  getAllTasks, getAnyTaskDetail, updateAssignmentProgressAsAdmin,
  weekStartFrom, weekDates, getPrograms, getActiveEmployees,
  getSessionsBetween, getScheduleBetween, getRecurringOccurrencesBetween,
  getRecurringOccurrenceByKey, clearRecurringException,
  getSessionById, createSession, updateSession, setSessionStatus,
  deleteSession, logScheduleHistory, getMonthlySummary, getMonthlySessions,
  setMonthlyTarget, clearMonthlyTarget,
  getRecurringTimetable, getRecurringVersionAt, createRecurringSeries,
  createRecurringSeriesBatch,
  updateRecurringSeriesFrom, endRecurringSeriesFrom, endRecurringTimetableFrom,
  setRecurringException, saveRecurringOccurrence,
  setOccurrenceAssignment, getAllPrograms, getProgramById, getProgramByCode,
  createProgram, updateProgram, deactivateProgram, reactivateProgram, hardDeleteProgram, countProgramReferences,
  getEmployeeDirectory, findEmployeeByCodeOrEmail, createEmployee,
  getManagedEmployee, deactivateEmployee, reactivateEmployee, getScheduleHistory,
} from './db.js';
import { monthlyDateRange } from './monthly-summary.js';
import { vietnamDateISO, vietnamDateParts } from './date.js';

/**
 * @api {get} /api/me/tasks List my tasks
 * @apiName GetMyTasks
 * @apiGroup Tasks
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiSuccess {Object[]} tasks Tasks assigned to the authenticated employee.
 * @apiSuccessExample {json} Success:
 *     { "tasks": [] }
 */
export async function handleGetMyTasks(env, session) {
  const tasks = await getEmployeeTasks(env.DB, session.employeeId);
  return Response.json({ tasks });
}

/**
 * @api {get} /api/tasks/:taskId Get my task
 * @apiName GetMyTask
 * @apiGroup Tasks
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiParam {Number} taskId Task identifier.
 * @apiSuccess {Object} task Task details for the authenticated employee.
 * @apiError 404 Task not found or not assigned to the employee.
 */
export async function handleGetTask(env, session, taskId) {
  const task = await getTaskDetail(env.DB, taskId, session.employeeId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

/**
 * @api {post} /api/progress Update task progress
 * @apiName UpdateMyProgress
 * @apiGroup Tasks
 * @apiHeader {String} Cookie Encrypted administrator session cookie.
 * @apiBody {Number} assignmentId Assignment identifier.
 * @apiBody {Number} percentage Completion percentage from 0 to 100.
 * @apiBody {String} [notes] Optional progress notes.
 * @apiSuccess {Boolean} success Always true when the update succeeds.
 * @apiError 400 Invalid percentage.
 * @apiError 403 Administrator access required.
 * @apiError 404 Assignment not found.
 */
export async function handleUpdateProgress(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { assignmentId, percentage, notes } = body;

  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
    return new Response('Invalid percentage', { status: 400 });
  }

  const result = await updateAssignmentProgress(
    env.DB, assignmentId, session.employeeId, percentage, notes || ''
  );

  if (result.meta.changes === 0) {
    return new Response('Assignment not found or not yours', { status: 404 });
  }
  return Response.json({ success: true });
}

// ---------- Admin guard ----------

function requireAdmin(session) {
  if (!session?.isAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ---------- Admin handlers ----------

/**
 * @api {get} /api/admin/tasks List all tasks
 * @apiName AdminGetTasks
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiQuery {String} [status] Filter by task status.
 * @apiQuery {Number} [employeeId] Filter by assigned employee.
 * @apiSuccess {Object[]} tasks All matching tasks and assignments.
 * @apiDescription Read-only workforce workload data available to all active employees.
 */
export async function handleAdminGetAllTasks(env, session, url) {
  const status = url.searchParams.get('status');
  const employeeIdParam = url.searchParams.get('employeeId');
  const employeeId = employeeIdParam ? parseInt(employeeIdParam, 10) : null;

  const tasks = await getAllTasks(env.DB, { status, employeeId });
  return Response.json({ tasks });
}

/**
 * @api {get} /api/admin/tasks/:taskId Get any task
 * @apiName AdminGetTask
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiParam {Number} taskId Task identifier.
 * @apiSuccess {Object} task Task details and assignment data.
 * @apiDescription Read-only workforce workload data available to all active employees.
 * @apiError 404 Task not found.
 */
export async function handleAdminGetTask(env, session, taskId) {
  const task = await getAnyTaskDetail(env.DB, taskId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

/**
 * @api {get} /api/admin/programs List all task types
 * @apiName AdminListPrograms
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted administrator session cookie.
 * @apiSuccess {Object[]} programs All task types, including deleted ones.
 * @apiError 403 Administrator access required.
 */
export async function handleAdminListPrograms(env, session) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const programs = await getAllPrograms(env.DB);
  return Response.json({ programs });
}

/**
 * @api {post} /api/admin/programs Create a task type
 * @apiName AdminCreateProgram
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {String} code Unique task code, up to 16 characters.
 * @apiBody {String} name Task name, up to 120 characters.
 * @apiBody {String} [category=general] Category, up to 32 characters.
 * @apiBody {Number} [defaultPoints=1] Default points from 0 to 100.
 * @apiBody {String} [defaultStart] Default start time in HH:MM format.
 * @apiBody {String} [defaultEnd] Default end time in HH:MM format.
 * @apiSuccess {Object} program Created task type.
 * @apiError 400 Invalid task type.
 * @apiError 403 Admin access required.
 * @apiError 409 Task code already exists.
 */
export async function handleAdminCreateProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid task type', { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' && body.category.trim()
    ? body.category.trim()
    : 'general';
  const defaultPoints = Number(body.defaultPoints ?? 1);
  const defaultStart = body.defaultStart || null;
  const defaultEnd = body.defaultEnd || null;
  const validTime = value => value === null ||
    (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) &&
      Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59);

  if (!code || code.length > 16 || !name || name.length > 120 ||
      category.length > 32 || !Number.isFinite(defaultPoints) ||
      defaultPoints < 0 || defaultPoints > 100 ||
      !validTime(defaultStart) || !validTime(defaultEnd) ||
      (defaultStart && defaultEnd && defaultStart === defaultEnd)) {
    return new Response('Invalid task type', { status: 400 });
  }
  if (await getProgramByCode(env.DB, code)) {
    return new Response('Task code already exists', { status: 409 });
  }

  const result = await createProgram(env.DB, {
    code, name, category, defaultPoints, defaultStart, defaultEnd,
  });
  const program = await getProgramById(env.DB, result.meta.last_row_id);
  await logScheduleHistory(
    env.DB, session.email, 'create', 'programme', result.meta.last_row_id,
    `Created programme "${name}" (${code})`
  );
  return Response.json({ program }, { status: 201 });
}

export async function handleAdminUpdateProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const programId = Number(body?.programId);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const defaultPoints = Number(body?.defaultPoints);
  const defaultStart = body?.defaultStart || null;
  const defaultEnd = body?.defaultEnd || null;
  const validTime = value => value === null ||
    (typeof value === 'string' && TIME_RE.test(value) &&
      Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59);
  if (!Number.isSafeInteger(programId) || programId < 1 ||
      !name || name.length > 120 || !Number.isFinite(defaultPoints) ||
      defaultPoints < 0 || defaultPoints > 100 ||
      !validTime(defaultStart) || !validTime(defaultEnd) ||
      (defaultStart && defaultEnd && defaultStart === defaultEnd)) {
    return new Response('Invalid programme defaults', { status: 400 });
  }
  const before = await getProgramById(env.DB, programId);
  if (!before) return new Response('Programme not found', { status: 404 });
  await updateProgram(env.DB, programId, { name, defaultPoints, defaultStart, defaultEnd });
  const program = await getProgramById(env.DB, programId);
  await logScheduleHistory(
    env.DB, session.email, 'update', 'programme', programId,
    `Updated programme defaults for "${before.name}" (${before.code})`
  );
  return Response.json({ program });
}


/**
 * @api {post} /api/admin/programs/delete Delete a task type
 * @apiName AdminDeleteProgram
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} programId Task type identifier.
 * @apiSuccess {Boolean} success Whether the task type was deleted or hidden.
 * @apiError 400 Invalid task type identifier.
 * @apiError 403 Admin access required.
 * @apiError 404 Task type not found.
 */
export async function handleAdminDeleteProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid task type identifier', { status: 400 });
  }

  const programId = Number(body.programId);
  if (!Number.isSafeInteger(programId) || programId < 1) {
    return new Response('Invalid task type identifier', { status: 400 });
  }
  const program = await getProgramById(env.DB, programId);
  if (!program) {
    return new Response('Task type not found', { status: 404 });
  }

  const hasReferences = await countProgramReferences(env.DB, programId);
  if (hasReferences) {
    await deactivateProgram(env.DB, programId);
  } else {
    await hardDeleteProgram(env.DB, programId);
  }
  await logScheduleHistory(
    env.DB, session.email, 'delete', 'programme', programId,
    `Deleted programme "${program.name}" (${program.code}); ` +
    (hasReferences
      ? 'hidden; existing schedule records retained'
      : 'removed; no schedule records referenced it')
  );
  return Response.json({ success: true });
}

/**
 * @api {post} /api/admin/programs/reactivate Restore a hidden programme
 * @apiName AdminReactivateProgram
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} programId Programme identifier.
 * @apiSuccess {Boolean} success Whether the programme was reactivated.
 * @apiError 400 Invalid programme identifier.
 * @apiError 403 Admin access required.
 * @apiError 404 Programme not found.
 */
export async function handleAdminReactivateProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid programme identifier', { status: 400 });
  }

  const programId = Number(body.programId);
  if (!Number.isSafeInteger(programId) || programId < 1) {
    return new Response('Invalid programme identifier', { status: 400 });
  }
  const program = await getProgramById(env.DB, programId);
  if (!program) return new Response('Programme not found', { status: 404 });
  if (Number(program.is_active) !== 0) {
    return Response.json({ success: true, alreadyActive: true });
  }

  await reactivateProgram(env.DB, programId);
  await logScheduleHistory(
    env.DB, session.email, 'reactivate', 'programme', programId,
    `Reactivated programme "${program.name}" (${program.code})`
  );
  return Response.json({ success: true });
}

/**
 * @api {post} /api/admin/progress Update any task progress
 * @apiName AdminUpdateProgress
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} assignmentId Assignment identifier.
 * @apiBody {Number} percentage Completion percentage from 0 to 100.
 * @apiBody {String} [notes] Optional progress notes.
 * @apiSuccess {Boolean} success Always true when the update succeeds.
 * @apiError 403 Admin access required.
 * @apiError 400 Invalid percentage.
 * @apiError 404 Assignment not found.
 */
export async function handleAdminUpdateProgress(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { assignmentId, percentage, notes } = body;

  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
    return new Response('Invalid percentage', { status: 400 });
  }

  const result = await updateAssignmentProgressAsAdmin(
    env.DB, assignmentId, percentage, notes || ''
  );

  if (result.meta.changes === 0) {
    return new Response('Assignment not found', { status: 404 });
  }
  return Response.json({ success: true });
}

// ---------- Schedule handlers ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_CORRECTION_REASON_LENGTH = 1000;

function parseCorrectionReason(body) {
  if (typeof body?.correctionReason !== 'string') return null;
  const reason = body.correctionReason.trim();
  return reason && reason.length <= MAX_CORRECTION_REASON_LENGTH ? reason : null;
}

function isValidISODate(value) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Finite repeats are capped at one year; ongoing repetition uses the weekly timetable.
const MAX_REPEAT_WEEKS = 53;

function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * @api {get} /api/schedule Get my weekly schedule
 * @apiName GetMySchedule
 * @apiGroup Schedule
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiQuery {String} [start] Any date in the requested week; normalized to Monday.
 * @apiQuery {Number} [year] Summary year.
 * @apiQuery {Number} [month] Summary month from 1 to 12.
 * @apiSuccess {String} weekStart Monday for the requested week.
 * @apiSuccess {String[]} dates Seven dates in the week.
 * @apiSuccess {Object[]} sessions Occurrences assigned to the employee, each returned once with an `assignees` array.
 * @apiSuccess {Object} summary Monthly progress summary, or null.
 */
export async function handleGetMySchedule(env, session, url) {
  const start = weekStartFrom(url.searchParams.get('start'));
  const dates = weekDates(start);
  const sessions = await getScheduleBetween(env.DB, dates[0], dates[6], session.employeeId);

  // Explicit ?year=&month= wins; otherwise use the month of the week's Thursday
  let year = parseInt(url.searchParams.get('year'), 10);
  let month = parseInt(url.searchParams.get('month'), 10);
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    const mid = new Date(dates[3] + 'T00:00:00Z');
    year = mid.getUTCFullYear();
    month = mid.getUTCMonth() + 1;
  }
  const monthRange = monthlyDateRange(year, month);
  const rows = await getMonthlySummary(env.DB, year, month, session.employeeId);

  return Response.json({
    weekStart: start, dates, sessions,
    summary: rows[0] || null,
    summaryMonth: { year, month },
  });
}

/**
 * @api {get} /api/admin/schedule Get all-staff weekly schedule
 * @apiName AdminGetSchedule
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiQuery {String} [start] Any date in the requested week; normalized to Monday.
 * @apiSuccess {String} weekStart Monday for the requested week.
 * @apiSuccess {String[]} dates Seven dates in the week.
 * @apiSuccess {Object[]} sessions All occurrences in the week, including unassigned ones.
 * @apiSuccess {Object[]} employees Active employees.
 * @apiSuccess {Object[]} programs Available programs.
 * @apiDescription Read-only workforce schedule available to all active employees.
 */
export async function handleAdminGetSchedule(env, session, url) {
  const start = weekStartFrom(url.searchParams.get('start'));
  const dates = weekDates(start);
  const [sessions, employees, programs, timetable] = await Promise.all([
    getScheduleBetween(env.DB, dates[0], dates[6]),
    getActiveEmployees(env.DB),
    getPrograms(env.DB),
    getRecurringTimetable(env.DB),
  ]);
  return Response.json({
    weekStart: start, dates, sessions, employees, programs,
    weeklyTimetableEnabled: timetable.length > 0,
  });
}

/**
 * @api {post} /api/admin/schedule/weekly-timetable Save or disable the weekly timetable
 * @apiName AdminSetWeeklyTimetable
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Boolean} enabled Whether weekly timetable generation is enabled.
 * @apiBody {String} [weekStart] Monday date whose sessions become the timetable.
 *   Required when enabled is true.
 * @apiSuccess {Boolean} enabled Whether an active timetable remains.
 * @apiSuccess {Number} templateCount Number of active weekly entries.
 * @apiError 400 Invalid request.
 * @apiError 403 Admin access required.
 */
export async function handleAdminSetWeeklyTimetable(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (typeof body?.enabled !== 'boolean') {
    return new Response('enabled must be a boolean', { status: 400 });
  }

  if (!body.enabled) {
    const cutoffDate = body.cutoffDate || vietnamDateISO();
    if (!isValidISODate(cutoffDate)) return new Response('Invalid cutoff date', { status: 400 });
    await endRecurringTimetableFrom(env.DB, cutoffDate, session.email);
    return Response.json({ success: true, enabled: false, cutoffDate });
  }

  const weekStart = body.weekStart;
  if (typeof weekStart !== 'string' || !isValidISODate(weekStart) ||
      weekStartFrom(weekStart) !== weekStart) {
    return new Response('weekStart must be a valid Monday date', { status: 400 });
  }
  const endDate = addDaysISO(weekStart, 6);
  const sourceSessions = (await getScheduleBetween(env.DB, weekStart, endDate))
    .filter(row => !row.is_recurring && row.status !== 'cancelled');
  const versions = sourceSessions.map(occurrence => {
    const weekday = new Date(`${occurrence.session_date}T00:00:00Z`).getUTCDay();
    return {
      weekday, programId: occurrence.program_id, employeeId: null,
      startTime: occurrence.start_time, endTime: occurrence.end_time,
      points: Number(occurrence.points), isSudden: !!occurrence.is_sudden,
      notes: occurrence.notes || null, startDate: weekStart, endDate: null,
      effectiveFrom: weekStart,
    };
  });
  const seriesIds = await createRecurringSeriesBatch(
    env.DB, versions, session.employeeId, session.email,
    `Imported ${versions.length} one-off session(s) from ${weekStart}`,
  );
  return Response.json({
    success: true, enabled: seriesIds.length > 0, templateCount: seriesIds.length,
    seriesIds,
  });
}

function recurringInput(body, current = null, effectiveFrom = null) {
  const field = (key, currentKey, fallback = null) =>
    body[key] === undefined ? (current?.[currentKey] ?? fallback) : body[key];
  const sudden = field('isSudden', 'is_sudden', false);
  if (body.isSudden !== undefined && typeof body.isSudden !== 'boolean') return null;
  const version = {
    weekday: Number(field('weekday', 'weekday')),
    programId: Number(field('programId', 'program_id')),
    employeeId: null,
    startTime: field('startTime', 'start_time') || null,
    endTime: field('endTime', 'end_time') || null,
    points: Number(field('points', 'points')),
    isSudden: typeof sudden === 'boolean' ? sudden : Number(sudden) === 1,
    movedDate: body.movedDate || null,
    notes: field('notes', 'notes') || null,
    startDate: field('startDate', 'start_date', effectiveFrom),
    endDate: field('endDate', 'end_date') || null,
    effectiveFrom: effectiveFrom || field('effectiveFrom', 'effective_from'),
  };
  const validTime = value => value === null ||
    (typeof value === 'string' && TIME_RE.test(value) &&
      Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59);
  if (!Number.isInteger(version.weekday) || version.weekday < 0 || version.weekday > 6 ||
      !Number.isSafeInteger(version.programId) || version.programId < 1 ||
      !Number.isFinite(version.points) || version.points < 0 || version.points > 100 ||
      typeof version.isSudden !== 'boolean' || !validTime(version.startTime) ||
      !validTime(version.endTime) ||
      (version.startTime && version.endTime && version.startTime === version.endTime) ||
      (version.notes !== null && (typeof version.notes !== 'string' || version.notes.length > 1000)) ||
      !isValidISODate(version.startDate) ||
      (version.endDate !== null && (!isValidISODate(version.endDate) || version.endDate < version.startDate)) ||
      !isValidISODate(version.effectiveFrom) ||
      (version.movedDate !== null && !isValidISODate(version.movedDate))) return null;
  return version;
}

async function validateRecurringAssignment(env, version) {
  const program = await getProgramById(env.DB, version.programId);
  if (!program || !program.is_active) return 'Unknown or inactive task type';
  return null;
}

export async function handleAdminGetTimetable(env, session) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const entries = await getRecurringTimetable(env.DB);
  return Response.json({ entries });
}

export async function handleAdminRecurringTimetable(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid timetable action', { status: 400 });
  }

  const operation = body.operation;
  const correctionReason = parseCorrectionReason(body);
  if ((operation === 'edit' ||
       (operation === 'exception' && body.action === 'modify')) && !correctionReason) {
    return new Response('Correction reason is required (maximum 1000 characters)', { status: 400 });
  }
  if (operation === 'create') {
    const effectiveFrom = body.startDate;
    const version = recurringInput(body, null, effectiveFrom);
    if (!version) return new Response('Invalid recurring entry', { status: 400 });
    const invalid = await validateRecurringAssignment(env, version);
    if (invalid) return new Response(invalid, { status: 400 });
    const seriesId = await createRecurringSeries(env.DB, version, session.employeeId, session.email);
    return Response.json({ success: true, seriesId }, { status: 201 });
  }

  const seriesId = Number(body.seriesId);
  const cutoffDate = body.cutoffDate;
  if (!Number.isSafeInteger(seriesId) || seriesId < 1 ||
      typeof cutoffDate !== 'string' || !isValidISODate(cutoffDate)) {
    return new Response('Invalid series identifier or cutoff date', { status: 400 });
  }
  if (operation === 'end') {
    const entry = (await getRecurringTimetable(env.DB))
      .find(item => Number(item.series_id) === seriesId);
    if (!entry) return new Response('Recurring entry not found', { status: 404 });
    await endRecurringSeriesFrom(env.DB, seriesId, cutoffDate, session.email);
    return Response.json({ success: true, seriesId, cutoffDate });
  }
  const current = await getRecurringVersionAt(env.DB, seriesId, cutoffDate);
  if (!current) return new Response('Recurring entry not found for cutoff date', { status: 404 });
  if (operation === 'edit') {
    if (cutoffDate < vietnamDateISO()) {
      return new Response('Recurring schedule edits must start today or later', { status: 400 });
    }
    const version = recurringInput(body, current, cutoffDate);
    if (!version) return new Response('Invalid recurring entry', { status: 400 });
    const invalid = await validateRecurringAssignment(env, version);
    if (invalid) return new Response(invalid, { status: 400 });
    if (typeof body.replaceFutureExceptions !== 'boolean') {
      return new Response('replaceFutureExceptions must be a boolean', { status: 400 });
    }
    await updateRecurringSeriesFrom(env.DB, seriesId, current, version, cutoffDate,
      body.replaceFutureExceptions, session.employeeId, session.email, correctionReason);
    return Response.json({ success: true, seriesId, cutoffDate });
  }

  if (operation === 'exception') {
    const occurrenceDate = body.occurrenceDate;
    if (typeof occurrenceDate !== 'string' || !isValidISODate(occurrenceDate) ||
        occurrenceDate < current.start_date ||
        (current.end_date && occurrenceDate > current.end_date)) {
      return new Response('Invalid occurrence date', { status: 400 });
    }
    const displayDate = body.action === 'modify' && body.movedDate
      ? body.movedDate : occurrenceDate;
    if (!isValidISODate(displayDate)) return new Response('Invalid moved date', { status: 400 });
    const occurrence = await getRecurringOccurrenceByKey(env.DB, seriesId, occurrenceDate);
    if (!occurrence) return new Response('Recurring occurrence not found', { status: 404 });
    if (body.action === 'cancel') {
      if (occurrence.status === 'completed') {
        return new Response('Completed occurrences cannot be cancelled', { status: 409 });
      }
      if (occurrence.is_projected) {
        await setRecurringException(env.DB, seriesId, occurrenceDate, 'cancelled', null, session.employeeId);
      } else {
        await setSessionStatus(env.DB, occurrence.session_id, 'cancelled');
      }
      await logScheduleHistory(env.DB, session.email, 'cancel', 'recurring-occurrence', seriesId,
        `Cancelled series ${seriesId} occurrence ${occurrenceDate}`);
      return Response.json({ success: true, occurrenceDate });
    }
    if (body.action === 'modify') {
      if (occurrence.status === 'completed') {
        return new Response('Completed occurrences cannot be modified', { status: 409 });
      }
      const version = recurringInput({ ...body, startDate: current.start_date }, current, cutoffDate);
      if (!version) return new Response('Invalid occurrence override', { status: 400 });
      const invalid = await validateRecurringAssignment(env, version);
      if (invalid) return new Response(invalid, { status: 400 });
      await setRecurringException(env.DB, seriesId, occurrenceDate, 'modified', version, session.employeeId);
      await logScheduleHistory(env.DB, session.email, 'modify', 'recurring-occurrence', seriesId,
        `Modified series ${seriesId} occurrence ${occurrenceDate}; ` +
        `points ${Number(occurrence.points).toFixed(1)} -> ${Number(version.points).toFixed(1)}; ` +
        `reason: ${correctionReason}`);
      return Response.json({ success: true, occurrenceDate, modified: true });
    }
    return new Response('Invalid occurrence action', { status: 400 });
  }

  return new Response('Unknown timetable operation', { status: 400 });
}

/**
 * @api {post} /api/admin/schedule/assign Assign schedule session
 * @apiName AdminAssignSession
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} [employeeId] Optional initial assignee for the dated occurrence.
 * @apiBody {String} date Session date in YYYY-MM-DD format.
 * @apiBody {Number} programId Program identifier.
 * @apiBody {String} [startTime] Start time in HH:MM format.
 * @apiBody {String} [endTime] End time in HH:MM format.
 * @apiBody {Number} [points] Credited points; calculated from the program when omitted.
 * @apiBody {Boolean} [isSudden=false] Whether this is a sudden session (doubles points).
 * @apiBody {Number} [repeatWeeks=1] Also create the same session on this weekday
 *   for the next N-1 weeks. 1 = only this week; capped at 53.
 * @apiBody {String} [notes] Optional notes.
 * @apiSuccess {Boolean} success Always true when created.
 * @apiSuccess {Object} session The first created session.
 * @apiSuccess {Number} repeatedWeeks How many weeks the session was created for.
 * @apiError 400 Invalid assignment payload.
 * @apiError 403 Admin access required.
 */
export async function handleAdminAssignSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid assignment payload', { status: 400 });
  }

  const {
    employeeId: requestedEmployeeId,
    date, programId, startTime, endTime, points, isSudden, notes,
    repeatWeeks,
  } = body;
  const employeeId = requestedEmployeeId == null || requestedEmployeeId === ''
    ? null
    : Number(requestedEmployeeId);
  const parsedProgramId = Number(programId);
  const sessionDate = typeof date === 'string' ? date : '';
  const invalidFields = [];
  if (employeeId !== null && (!Number.isSafeInteger(employeeId) || employeeId < 1)) {
    invalidFields.push('employeeId');
  }
  if (!Number.isSafeInteger(parsedProgramId) || parsedProgramId < 1) {
    invalidFields.push('programId');
  }
  if (!isValidISODate(sessionDate)) {
    invalidFields.push('date');
  }
  if (invalidFields.length) {
    return new Response(
      `Invalid assignment payload: ${invalidFields.join(', ')}`,
      { status: 400 }
    );
  }
  const validOptionalTime = value => value == null || value === '' ||
    (typeof value === 'string' && TIME_RE.test(value) &&
      Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59);
  if (!validOptionalTime(startTime)) return new Response('Invalid start time', { status: 400 });
  if (!validOptionalTime(endTime)) return new Response('Invalid end time', { status: 400 });
  if (startTime && endTime && endTime === startTime) {
    return new Response('Start and end times must be different', { status: 400 });
  }
  if (employeeId !== null) {
    const employee = await env.DB.prepare(
      `SELECT employee_id, is_active FROM employees WHERE employee_id = ?`
    ).bind(employeeId).first();
    if (!employee || !employee.is_active) {
      return new Response('Unknown or inactive employee', { status: 400 });
    }
  }

  let repeat = Number(repeatWeeks);
  if (!Number.isInteger(repeat) || repeat < 1) repeat = 1;
  if (repeat > MAX_REPEAT_WEEKS) repeat = MAX_REPEAT_WEEKS;

  // Automatic point calculation: derive from the program default when not provided
  let pts = Number(points);
  if (!Number.isFinite(pts)) {
    const prog = await env.DB.prepare(
      'SELECT default_points FROM programs WHERE program_id = ?'
    ).bind(parsedProgramId).first();
    pts = Number(prog?.default_points || 0) * (isSudden ? 2 : 1);
  }
  if (!Number.isFinite(pts) || pts < 0 || pts > 100) {
    return new Response('Invalid points', { status: 400 });
  }

  // Create one session per week: this week + repeat-1 subsequent weeks.
  // Every week is a real row, so the task is visible when browsing later
  // weeks in both the plan board and the schedule table.
  const createdIds = [];
  for (let i = 0; i < repeat; i++) {
    const repeatDate = addDaysISO(sessionDate, i * 7);
    const result = await createSession(env.DB, {
      sessionDate: repeatDate, programId: parsedProgramId, employeeId,
      startTime, endTime, points: pts,
      isSudden: !!isSudden, notes, createdBy: session.employeeId,
    });
    createdIds.push(result.meta.last_row_id);
  }

  const sessionId = createdIds[0];
  const created = await getSessionById(env.DB, sessionId);
  const who = created?.first_name
    ? `${created.first_name} ${created.last_name}`
    : 'no person yet';
  await logScheduleHistory(
    env.DB, session.email, 'add', 'session', sessionId,
    `Added "${created?.program_name ?? parsedProgramId}" on ${sessionDate}` +
    ` (${startTime || '—'}–${endTime || '—'}) for ${pts} points` +
    `${isSudden ? ' [sudden]' : ''} — ${who}` +
    (repeat > 1 ? ` — repeated for ${repeat} week(s) (same weekday)` : '')
  );
  return Response.json({
    success: true,
    session: created,
    repeatedWeeks: repeat,
  });
}

/**
 * @api {post} /api/admin/schedule/update Update one scheduled session
 * @apiName AdminUpdateSession
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} sessionId Session identifier.
 * @apiBody {Number} programId Task type identifier.
 * @apiBody {String} sessionDate Date in YYYY-MM-DD format.
 * @apiBody {String} [startTime] Start time in HH:MM format.
 * @apiBody {String} [endTime] End time in HH:MM format.
 * @apiBody {Number} points Credited points from 0 to 100.
 * @apiBody {Boolean} isSudden Whether this is a sudden session.
 * @apiBody {String} correctionReason Required reason for editing the session (1-1000 characters).
 * @apiBody {String} [notes] Optional notes.
 * @apiSuccess {Boolean} success Always true when updated.
 * @apiError 400 Invalid update payload.
 * @apiError 403 Admin access required.
 * @apiError 404 Session or task type not found.
 */
export async function handleAdminUpdateSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const sessionId = Number(body?.sessionId);
  const programId = Number(body?.programId);
  const sessionDate = body?.sessionDate;
  const startTime = body?.startTime || null;
  const endTime = body?.endTime || null;
  const points = Number(body?.points);
  const isSudden = body?.isSudden;
  const notes = body?.notes == null ? null : String(body.notes);
  const correctionReason = parseCorrectionReason(body);
  if (!Number.isSafeInteger(sessionId) || sessionId < 1 ||
      !Number.isSafeInteger(programId) || programId < 1 ||
      typeof sessionDate !== 'string' || !isValidISODate(sessionDate) ||
      (startTime !== null && (typeof startTime !== 'string' || !TIME_RE.test(startTime))) ||
      (endTime !== null && (typeof endTime !== 'string' || !TIME_RE.test(endTime))) ||
      (startTime && endTime && startTime === endTime) ||
      !Number.isFinite(points) || points < 0 || points > 100 ||
      typeof isSudden !== 'boolean') {
    return new Response('Invalid update payload', { status: 400 });
  }
  if (!correctionReason) {
    return new Response('Correction reason is required (maximum 1000 characters)', { status: 400 });
  }

  const before = await getSessionById(env.DB, sessionId);
  if (!before) return new Response('Session not found', { status: 404 });
  if (before.recurring_series_id != null) {
    return new Response('Use the recurring timetable endpoint to edit recurring sessions', { status: 400 });
  }
  const program = await getProgramById(env.DB, programId);
  if (!program) return new Response('Task type not found', { status: 404 });

  await updateSession(env.DB, sessionId, {
    sessionDate, programId, startTime, endTime, points, isSudden, notes,
  });
  const updated = await getSessionById(env.DB, sessionId);
  await logScheduleHistory(
    env.DB, session.email, 'update', 'session', sessionId,
    `Updated "${before.program_name}" ${before.session_date} to ` +
    `"${updated.program_name}" ${sessionDate} (${startTime || '—'}–${endTime || '—'}); ` +
    `points ${Number(before.points).toFixed(1)} -> ${Number(updated.points).toFixed(1)}; ` +
    `reason: ${correctionReason}`
  );
  return Response.json({ success: true, session: updated });
}

/**
 * @api {post} /api/admin/schedule/clone Clone a session to other weekdays
 * @apiName AdminCloneSession
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} sessionId Source session identifier.
 * @apiBody {String[]} dates One or more other dates in the same Monday-Sunday week.
 * @apiSuccess {Boolean} success Always true when cloned.
 * @apiSuccess {Number} clonedCount Number of new sessions.
 * @apiError 400 Invalid dates or source session.
 * @apiError 403 Admin access required.
 * @apiError 404 Session not found.
 */
export async function handleAdminCloneSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const sessionId = Number(body?.sessionId);
  const dates = body?.dates;
  if (!Number.isSafeInteger(sessionId) || sessionId < 1 || !Array.isArray(dates) ||
      dates.length < 1 || dates.length > 6 || dates.some(date => !isValidISODate(date))) {
    return new Response('Invalid clone payload', { status: 400 });
  }
  const source = await getSessionById(env.DB, sessionId);
  if (!source) return new Response('Session not found', { status: 404 });
  if (new Set(dates).size !== dates.length || dates.some(date =>
      date === source.session_date || weekStartFrom(date) !== weekStartFrom(source.session_date))) {
    return new Response('Clone dates must be unique other weekdays in the same week', { status: 400 });
  }

  const cloned = [];
  for (const date of dates) {
    const result = await createSession(env.DB, {
      sessionDate: date,
      programId: source.program_id,
      employeeIds: source.employee_ids,
      startTime: source.start_time,
      endTime: source.end_time,
      points: source.points,
      isSudden: source.is_sudden === 1,
      notes: source.notes,
      createdBy: session.employeeId,
    });
    const created = await getSessionById(env.DB, result.meta.last_row_id);
    cloned.push(created);
    await logScheduleHistory(
      env.DB, session.email, 'add', 'session', created.session_id,
      `Cloned "${created.program_name}" from ${source.session_date} to ${date}`
    );
  }
  return Response.json({ success: true, clonedCount: cloned.length, sessions: cloned });
}

/**
 * @api {post} /api/admin/schedule/copy-week Copy a week to the following week
 * @apiName AdminCopyScheduleWeek
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {String} weekStart Monday date in YYYY-MM-DD format.
 * @apiSuccess {Boolean} success Always true when copied.
 * @apiSuccess {String} targetWeekStart The following Monday.
 * @apiSuccess {Number} createdCount Number of sessions created.
 * @apiSuccess {Number} skippedCount Existing matching sessions not duplicated.
 * @apiError 400 Invalid Monday date.
 * @apiError 403 Admin access required.
 */
export async function handleAdminCopyScheduleWeek(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const weekStart = body?.weekStart;
  if (typeof weekStart !== 'string' || !isValidISODate(weekStart) ||
      weekStartFrom(weekStart) !== weekStart) {
    return new Response('weekStart must be a valid Monday date', { status: 400 });
  }

  const targetWeekStart = addDaysISO(weekStart, 7);
  const [sourceSessions, targetSessions] = await Promise.all([
    getSessionsBetween(env.DB, weekStart, addDaysISO(weekStart, 6)),
    getSessionsBetween(env.DB, targetWeekStart, addDaysISO(targetWeekStart, 6)),
  ]);
  const eligible = sourceSessions.filter(s => s.status !== 'cancelled');
  const sessionKey = (s, date) => JSON.stringify([
    date, s.program_id, [...(s.employee_ids || (s.employee_id == null ? [] : [s.employee_id]))]
      .map(Number).sort((a, b) => a - b), s.start_time?.slice(0, 5) ?? null,
    s.end_time?.slice(0, 5) ?? null, Number(s.points), !!s.is_sudden, s.notes ?? null,
  ]);
  const desired = new Map();
  for (const source of eligible) {
    const key = sessionKey(source, addDaysISO(source.session_date, 7));
    const group = desired.get(key) || { source, count: 0 };
    group.count++;
    desired.set(key, group);
  }
  const existingCounts = new Map();
  for (const target of targetSessions) {
    if (target.status === 'cancelled') continue;
    const key = sessionKey(target, target.session_date);
    existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
  }

  let createdCount = 0;
  for (const [key, group] of desired) {
    const needed = Math.max(0, group.count - (existingCounts.get(key) || 0));
    for (let i = 0; i < needed; i++) {
      const source = group.source;
      await createSession(env.DB, {
        sessionDate: addDaysISO(source.session_date, 7),
        programId: source.program_id,
        employeeIds: source.employee_ids,
        startTime: source.start_time,
        endTime: source.end_time,
        points: source.points,
        isSudden: !!source.is_sudden,
        notes: source.notes,
        createdBy: session.employeeId,
      });
      createdCount++;
    }
  }

  const skippedCount = eligible.length - createdCount;
  await logScheduleHistory(
    env.DB, session.email, 'clone', 'week', null,
    `Copied schedule week ${weekStart} to ${targetWeekStart}: ` +
    `${createdCount} created, ${skippedCount} matching sessions skipped`
  );
  return Response.json({
    success: true, sourceWeekStart: weekStart, targetWeekStart,
    createdCount, skippedCount,
  });
}

/**
 * @api {post} /api/admin/schedule/reassign Change the person of a session
 * @apiName AdminReassignSession
 * @apiGroup AdminSchedule
 * @apiDescription Adds or removes one employee from a dated occurrence. Recurring
 *   occurrences are addressed by series ID and occurrence date; one-offs use session ID.
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} [sessionId] One-off session identifier.
 * @apiBody {Number} [seriesId] Recurring series identifier.
 * @apiBody {String} [occurrenceDate] Recurring occurrence date.
 * @apiBody {Number} employeeId Employee identifier to add or remove.
 * @apiBody {Boolean} [assigned=true] Whether to assign or unassign that employee.
 * @apiSuccess {Boolean} success Always true when updated.
 * @apiError 400 Invalid payload or unknown employee.
 * @apiError 403 Admin access required.
 * @apiError 404 Session not found.
 */
export async function handleAdminReassignSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const sessionId = Number.isSafeInteger(body?.sessionId) ? body.sessionId : null;
  const seriesId = Number.isSafeInteger(body?.seriesId) ? body.seriesId : null;
  const occurrenceDate = body?.occurrenceDate;
  const employeeId = Number(body?.employeeId);
  const assigned = body?.assigned === undefined ? true : body.assigned;
  const recurringKey = seriesId !== null && typeof occurrenceDate === 'string' &&
    isValidISODate(occurrenceDate);
  if ((!Number.isSafeInteger(employeeId) || employeeId < 1) || typeof assigned !== 'boolean' ||
      (sessionId !== null && sessionId < 1) || (seriesId !== null && seriesId < 1) ||
      (sessionId === null && !recurringKey) || (sessionId !== null && recurringKey) ||
      body?.applyFollowing === true) {
    return new Response('Invalid reassign payload', { status: 400 });
  }
  const employee = await env.DB.prepare(
    `SELECT employee_id, is_active, first_name, last_name
     FROM employees WHERE employee_id = ?`
  ).bind(employeeId).first();
  if (!employee || (assigned && !employee.is_active)) {
    return new Response('Unknown or inactive employee', { status: 400 });
  }
  const before = recurringKey
    ? await getRecurringOccurrenceByKey(env.DB, seriesId, occurrenceDate)
    : await getSessionById(env.DB, sessionId);
  if (!before) return new Response('Session not found', { status: 404 });
  if (!recurringKey && before.recurring_series_id != null) {
    return new Response('Use seriesId and occurrenceDate for a recurring occurrence', { status: 400 });
  }
  await setOccurrenceAssignment(env.DB, {
    sessionId, seriesId, occurrenceDate, employeeId, assigned, assignedBy: session.employeeId,
  });
  await logScheduleHistory(
    env.DB, session.email, assigned ? 'assign' : 'unassign',
    recurringKey ? 'recurring-occurrence' : 'session',
    recurringKey ? seriesId : sessionId,
    `"${before.program_name}" ${before.session_date}: employee ${employeeId} ` +
    `${assigned ? 'assigned to' : 'unassigned from'} this occurrence`
  );
  return Response.json({ success: true, assigned });
}

/**
 * @api {post} /api/admin/schedule/status Change session status
 * @apiName AdminSessionStatus
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} sessionId Session identifier.
 * @apiBody {String} status One of scheduled, completed, or cancelled.
 * @apiSuccess {Boolean} success Always true when updated.
 * @apiError 400 Invalid status change.
 * @apiError 403 Admin access required.
 * @apiError 404 Session not found.
 */
export async function handleAdminSessionStatus(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { sessionId, status, seriesId, occurrenceDate, occurrenceNotes } = body;
  if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
    return new Response('Invalid status change', { status: 400 });
  }
  if (Number.isSafeInteger(seriesId) && typeof occurrenceDate === 'string' &&
      isValidISODate(occurrenceDate)) {
    let occurrence = await getRecurringOccurrenceByKey(env.DB, seriesId, occurrenceDate);
    if (!occurrence) return new Response('Recurring occurrence not found', { status: 404 });
    if (status === 'scheduled' && occurrence.is_projected && occurrence.status === 'scheduled') {
      return Response.json({ success: true });
    }
    let restoreAsException = false;
    if (status === 'scheduled') {
      if (occurrence.is_projected && occurrence.status === 'cancelled') {
        restoreAsException = true;
        await setRecurringException(env.DB, seriesId, occurrenceDate, 'modified', {
          movedDate: occurrence.session_date,
          programId: occurrence.program_id,
          employeeId: occurrence.employee_id,
          startTime: occurrence.start_time,
          endTime: occurrence.end_time,
          points: Number(occurrence.points),
          isSudden: !!occurrence.is_sudden,
          notes: occurrence.notes || null,
        }, session.employeeId);
      } else {
        await clearRecurringException(env.DB, seriesId, occurrenceDate);
      }
      occurrence = await getRecurringOccurrenceByKey(env.DB, seriesId, occurrenceDate);
    }
    if (status === 'cancelled' && occurrence.is_projected) {
      await setRecurringException(env.DB, seriesId, occurrenceDate, 'cancelled', null, session.employeeId);
    } else if (!restoreAsException) {
      await saveRecurringOccurrence(env.DB, occurrence, status, occurrenceNotes);
    }
    await logScheduleHistory(env.DB, session.email, 'status', 'recurring-occurrence', seriesId,
      `Series ${seriesId} occurrence ${occurrenceDate}: ${occurrence.status} -> ${status}`);
    return Response.json({ success: true });
  }
  if (!Number.isInteger(sessionId)) return new Response('Invalid status change', { status: 400 });
  const before = await getSessionById(env.DB, sessionId);
  if (!before) return new Response('Session not found', { status: 404 });

  const result = await setSessionStatus(env.DB, sessionId, status);
  if (result.meta.changes === 0) return new Response('Session not found', { status: 404 });

  await logScheduleHistory(
    env.DB, session.email, 'status', 'session', sessionId,
    `"${before.program_name}" ${before.session_date} ` +
    `(${before.first_name} ${before.last_name}): ${before.status} -> ${status}`
  );
  return Response.json({ success: true });
}

/**
 * @api {post} /api/admin/schedule/delete Delete schedule session
 * @apiName AdminDeleteSession
 * @apiGroup AdminSchedule
 * @apiDescription Cancels one recurring occurrence or deletes one one-off
 *   session. Ending a recurring series uses the timetable endpoint and a cutoff date.
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} sessionId Session identifier.
 * @apiSuccess {Boolean} success Always true when deleted.
 * @apiSuccess {Number} deletedCount How many sessions were removed.
 * @apiSuccess {Boolean} deletedFollowing Whether the series tail was removed.
 * @apiError 400 Invalid session ID.
 * @apiError 403 Admin access required.
 * @apiError 404 Session not found.
 */
export async function handleAdminDeleteSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid delete payload', { status: 400 });
  }

  const { sessionId, seriesId, occurrenceDate } = body;
  if (body.deleteFollowing === true) {
    return new Response('End recurring series through the timetable endpoint', { status: 400 });
  }
  if (Number.isSafeInteger(seriesId) && typeof occurrenceDate === 'string' &&
      isValidISODate(occurrenceDate)) {
    const occurrence = await getRecurringOccurrenceByKey(env.DB, seriesId, occurrenceDate);
    if (!occurrence) return new Response('Recurring occurrence not found', { status: 404 });
    if (occurrence.status === 'completed') {
      return new Response('Completed occurrences cannot be deleted', { status: 409 });
    }
    if (occurrence.is_projected) {
      await setRecurringException(env.DB, seriesId, occurrenceDate, 'cancelled', null, session.employeeId);
    } else {
      await setSessionStatus(env.DB, occurrence.session_id, 'cancelled');
    }
    await logScheduleHistory(env.DB, session.email, 'cancel', 'recurring-occurrence', seriesId,
      `Cancelled series ${seriesId} occurrence ${occurrenceDate}`);
    return Response.json({ success: true, deletedCount: 1 });
  }
  if (!Number.isInteger(sessionId)) return new Response('Invalid session id', { status: 400 });
  const before = await getSessionById(env.DB, sessionId);
  if (!before) return new Response('Session not found', { status: 404 });

  if (before.recurring_series_id != null) {
    if (before.status === 'completed') {
      return new Response('Completed occurrences cannot be deleted', { status: 409 });
    }
    await setSessionStatus(env.DB, sessionId, 'cancelled');
    await logScheduleHistory(
      env.DB, session.email, 'cancel', 'recurring-occurrence', before.recurring_series_id,
      `Cancelled series ${before.recurring_series_id} occurrence ${before.recurrence_date}`
    );
    return Response.json({ success: true, deletedCount: 1 });
  }

  await deleteSession(env.DB, sessionId);
  await logScheduleHistory(
    env.DB, session.email, 'remove', 'session', sessionId,
    `Deleted "${before.program_name}" ${before.session_date} ` +
    `(${before.first_name} ${before.last_name}, was ${before.status})`
  );
  return Response.json({ success: true, deletedCount: 1 });
}

/**
 * @api {get} /api/admin/schedule/monthly Get monthly schedule summary
 * @apiName AdminMonthlySummary
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiQuery {Number} [year] Vietnam summary year; defaults to the current year.
 * @apiQuery {Number} [month] Summary month from 1 to 12; defaults to the current month.
 * @apiSuccess {Number} year Summary year.
 * @apiSuccess {Number} month Summary month.
 * @apiSuccess {Object[]} rows Employee summary rows with completed and estimated points and task counts
 *   for days 1–10, 11–20, and 21–month-end, monthly totals, shared default/override target,
 *   target_is_override, variance, and points above goal.
 * @apiError 400 Invalid year or month.
 * @apiDescription Read-only report available to all active employees.
 */
export async function handleAdminMonthlySummary(env, session, url) {
  const today = vietnamDateParts();
  const year = parseInt(url.searchParams.get('year'), 10) || today.year;
  const month = parseInt(url.searchParams.get('month'), 10) || today.month;
  if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12) {
    return new Response('Invalid year or month', { status: 400 });
  }
  const rows = await getMonthlySummary(env.DB, year, month);
  return Response.json({ year, month, rows });
}

export async function handleAdminQuarterlySummary(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const year = Number(url.searchParams.get('year'));
  const quarter = Number(url.searchParams.get('quarter'));
  const employeeId = Number(url.searchParams.get('employeeId'));
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(quarter) || quarter < 1 || quarter > 4 ||
      !Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid quarterly report selection', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  const firstMonth = (quarter - 1) * 3 + 1;
  const monthlyRows = await Promise.all([0, 1, 2].map(async offset => {
    const month = firstMonth + offset;
    const [row] = await getMonthlySummary(env.DB, year, month, employeeId);
    return {
      month,
      completed_points: Number(row?.completed_points) || 0,
      target_points: Number(row?.target_points) || 0,
      completed_sessions: Number(row?.completed_sessions) || 0,
    };
  }));
  const totals = monthlyRows.reduce((result, month) => ({
    completed_points: result.completed_points + month.completed_points,
    target_points: result.target_points + month.target_points,
    completed_sessions: result.completed_sessions + month.completed_sessions,
  }), { completed_points: 0, target_points: 0, completed_sessions: 0 });
  return Response.json({
    year, quarter, employee,
    months: monthlyRows,
    totals: {
      ...totals,
      goal_variance: totals.completed_points - totals.target_points,
    },
  });
}

export async function handleAdminMonthlySessions(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const year = Number(url.searchParams.get('year'));
  const month = Number(url.searchParams.get('month'));
  const employeeId = Number(url.searchParams.get('employeeId'));
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid monthly session selection', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  const sessions = await getMonthlySessions(env.DB, year, month, employeeId);
  return Response.json({ year, month, employee, sessions });
}

export async function handleAdminListEmployees(env, session) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const employees = await getEmployeeDirectory(env.DB);
  return Response.json({ employees });
}

export async function handleAdminCreateEmployee(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid employee', { status: 400 });
  }
  const employeeCode = typeof body.employeeCode === 'string' ? body.employeeCode.trim() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!employeeCode || employeeCode.length > 32 ||
      !firstName || firstName.length > 100 ||
      !lastName || lastName.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Invalid employee', { status: 400 });
  }
  if (await findEmployeeByCodeOrEmail(env.DB, employeeCode, email)) {
    return new Response('Employee code or email already exists', { status: 409 });
  }

  const result = await createEmployee(env.DB, { employeeCode, firstName, lastName, email });
  const employee = await getManagedEmployee(env.DB, result.meta.last_row_id);
  await logScheduleHistory(
    env.DB, session.email, 'create', 'employee', employee.employee_id,
    `Added ${employee.first_name} ${employee.last_name} (${employee.employee_code})`
  );
  return Response.json({ employee }, { status: 201 });
}

export async function handleAdminDeactivateEmployee(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const employeeId = Number(body?.employeeId);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid employee identifier', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  if (employee.is_admin === 1) {
    return new Response('Administrator accounts cannot be deactivated', { status: 409 });
  }
  if (!employee.is_active) return new Response('Employee is already inactive', { status: 409 });

  const result = await deactivateEmployee(env.DB, employeeId);
  if (result.meta.changes === 0) {
    const current = await getManagedEmployee(env.DB, employeeId);
    if (!current) return new Response('Employee not found', { status: 404 });
    if (current.is_admin === 1) {
      return new Response('Administrator accounts cannot be deactivated', { status: 409 });
    }
    return new Response('Employee is already inactive', { status: 409 });
  }
  await logScheduleHistory(
    env.DB, session.email, 'deactivate', 'employee', employeeId,
    `Deactivated ${employee.first_name} ${employee.last_name} (${employee.employee_code}); work records retained`
  );
  return Response.json({ success: true });
}

export async function handleAdminReactivateEmployee(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const employeeId = Number(body?.employeeId);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid employee identifier', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  if (employee.is_admin === 1) {
    return new Response('Administrator accounts cannot be reactivated through this endpoint', { status: 409 });
  }
  if (employee.is_active) return new Response('Employee is already active', { status: 409 });

  const result = await reactivateEmployee(env.DB, employeeId);
  if (result.meta.changes === 0) {
    const current = await getManagedEmployee(env.DB, employeeId);
    if (!current) return new Response('Employee not found', { status: 404 });
    if (current.is_admin === 1) {
      return new Response('Administrator accounts cannot be reactivated through this endpoint', { status: 409 });
    }
    return new Response('Employee is already active', { status: 409 });
  }
  await logScheduleHistory(
    env.DB, session.email, 'reactivate', 'employee', employeeId,
    `Reactivated ${employee.first_name} ${employee.last_name} (${employee.employee_code})`
  );
  return Response.json({ success: true });
}

export async function handleGetScheduleHistory(env, url) {
  const hasBefore = url.searchParams.has('before');
  const hasAfter = url.searchParams.has('after');
  const before = url.searchParams.has('before')
    ? Number(url.searchParams.get('before'))
    : null;
  const after = hasAfter ? Number(url.searchParams.get('after')) : null;
  const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 50;
  const page = url.searchParams.has('page') ? Number(url.searchParams.get('page')) : 1;
  const staff = (url.searchParams.get('staff') || '').trim();
  const record = (url.searchParams.get('record') || '').trim();
  const fromDate = url.searchParams.get('from') || '';
  const toDate = url.searchParams.get('to') || '';
  if ((hasBefore && hasAfter) ||
      (before !== null && (!Number.isSafeInteger(before) || before < 1)) ||
      (after !== null && (!Number.isSafeInteger(after) || after < 0)) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      staff.length > 254 || record.length > 120 ||
      (fromDate && !isValidISODate(fromDate)) ||
      (toDate && !isValidISODate(toDate)) ||
      (fromDate && toDate && fromDate > toDate)) {
    return new Response('Invalid history pagination', { status: 400 });
  }
  const { entries, total, page: currentPage } = await getScheduleHistory(env.DB, {
    beforeId: before, afterId: after, page,
    limit: after !== null || before !== null ? limit + 1 : limit,
    staff, record, fromDate, toDate,
  });
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return Response.json({
    entries: entries.slice(0, limit),
    hasMore: after !== null || before !== null
      ? entries.length > limit
      : currentPage < pageCount,
    page: currentPage,
    pageCount,
    total,
  });
}

/**
 * @api {post} /api/admin/schedule/target Set monthly points target
 * @apiName AdminSetTarget
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} employeeId Employee identifier.
 * @apiBody {Number} year Target year.
 * @apiBody {Number} month Target month from 1 to 12.
 * @apiBody {Number} [targetPoints] Override points from 0 to 10000.
 * @apiBody {Boolean} [useDefault=false] Remove the person's monthly override and use the shared goal.
 * @apiSuccess {Boolean} success Always true when saved.
 * @apiError 400 Invalid target payload or points.
 * @apiError 403 Admin access required.
 */
export async function handleAdminSetTarget(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { employeeId, year, month, targetPoints, useDefault = false } = body;
  if (!Number.isInteger(employeeId) || !Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12 || typeof useDefault !== 'boolean') {
    return new Response('Invalid target payload', { status: 400 });
  }

  let details;
  if (useDefault) {
    await clearMonthlyTarget(env.DB, employeeId, year, month);
    details = `Monthly target for ${year}-${String(month).padStart(2, '0')} reset to shared default`;
  } else {
    const pts = Number(targetPoints);
    if (!Number.isFinite(pts) || pts < 0 || pts > 10000) {
      return new Response('Invalid target points', { status: 400 });
    }
    await setMonthlyTarget(env.DB, employeeId, year, month, pts);
    details = `Monthly target for ${year}-${String(month).padStart(2, '0')} set to ${pts} points`;
  }

  await logScheduleHistory(env.DB, session.email, 'target', 'employee', employeeId, details);
  return Response.json({ success: true, usingDefault: useDefault });
}