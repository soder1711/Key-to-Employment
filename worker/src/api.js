import {
  getEmployeeTasks, getTaskDetail, updateAssignmentProgress,
  getAllTasks, getAnyTaskDetail, updateAssignmentProgressAsAdmin,
  weekStartFrom, weekDates, getPrograms, getActiveEmployees,
  getSessionsBetween, getSessionById, createSession, setSessionStatus,
  deleteSession, logScheduleHistory, getMonthlySummary, setMonthlyTarget,
  reassignSession, getAllPrograms, getProgramById, getProgramByCode,
  createProgram, deactivateProgram, hardDeleteProgram, countProgramSessions,
  findSeriesSessionsFrom,
} from './db.js';

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
 * @api {post} /api/progress Update my task progress
 * @apiName UpdateMyProgress
 * @apiGroup Tasks
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiBody {Number} assignmentId Assignment identifier.
 * @apiBody {Number} percentage Completion percentage from 0 to 100.
 * @apiBody {String} [notes] Optional progress notes.
 * @apiSuccess {Boolean} success Always true when the update succeeds.
 * @apiError 400 Invalid percentage.
 * @apiError 404 Assignment not found or not owned by the employee.
 */
export async function handleUpdateProgress(env, session, body) {
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
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiQuery {String} [status] Filter by task status.
 * @apiQuery {Number} [employeeId] Filter by assigned employee.
 * @apiSuccess {Object[]} tasks All matching tasks and assignments.
 * @apiError 403 Admin access required.
 */
export async function handleAdminGetAllTasks(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;

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
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiParam {Number} taskId Task identifier.
 * @apiSuccess {Object} task Task details and assignment data.
 * @apiError 403 Admin access required.
 * @apiError 404 Task not found.
 */
export async function handleAdminGetTask(env, session, taskId) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const task = await getAnyTaskDetail(env.DB, taskId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

/**
 * @api {get} /api/admin/programs List all task types
 * @apiName AdminListPrograms
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiSuccess {Object[]} programs All task types, including deleted ones.
 * @apiError 403 Admin access required.
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
      !validTime(defaultStart) || !validTime(defaultEnd)) {
    return new Response('Invalid task type', { status: 400 });
  }
  if (await getProgramByCode(env.DB, code)) {
    return new Response('Task code already exists', { status: 409 });
  }

  const result = await createProgram(env.DB, {
    code, name, category, defaultPoints, defaultStart, defaultEnd,
  });
  const program = await getProgramById(env.DB, result.meta.last_row_id);
  return Response.json({ program }, { status: 201 });
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
  if (!await getProgramById(env.DB, programId)) {
    return new Response('Task type not found', { status: 404 });
  }

  if (await countProgramSessions(env.DB, programId)) {
    await deactivateProgram(env.DB, programId);
  } else {
    await hardDeleteProgram(env.DB, programId);
  }
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

// Repeat caps: one year of weekly repeats, max.
const MAX_REPEAT_WEEKS = 53;
// Empty weeks box in the UI = fixed weekly schedule -> materialized for one year.
const FIXED_REPEAT_WEEKS = 53;

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
 * @apiSuccess {Object[]} sessions Sessions assigned to the employee.
 * @apiSuccess {Object} summary Monthly progress summary, or null.
 */
export async function handleGetMySchedule(env, session, url) {
  const start = weekStartFrom(url.searchParams.get('start'));
  const dates = weekDates(start);
  const sessions = await getSessionsBetween(env.DB, dates[0], dates[6], session.employeeId);

  // Explicit ?year=&month= wins; otherwise use the month of the week's Thursday
  let year = parseInt(url.searchParams.get('year'), 10);
  let month = parseInt(url.searchParams.get('month'), 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const mid = new Date(dates[3] + 'T00:00:00Z');
    year = mid.getUTCFullYear();
    month = mid.getUTCMonth() + 1;
  }
  const rows = await getMonthlySummary(env.DB, year, month, session.employeeId);

  return Response.json({
    weekStart: start, dates, sessions,
    summary: rows[0] || null,
    summaryMonth: { year, month },
  });
}

/**
 * @api {get} /api/admin/schedule Get admin weekly schedule
 * @apiName AdminGetSchedule
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiQuery {String} [start] Any date in the requested week; normalized to Monday.
 * @apiSuccess {String} weekStart Monday for the requested week.
 * @apiSuccess {String[]} dates Seven dates in the week.
 * @apiSuccess {Object[]} sessions All sessions in the week.
 * @apiSuccess {Object[]} employees Active employees.
 * @apiSuccess {Object[]} programs Available programs.
 * @apiError 403 Admin access required.
 */
export async function handleAdminGetSchedule(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const start = weekStartFrom(url.searchParams.get('start'));
  const dates = weekDates(start);
  const [sessions, employees, programs] = await Promise.all([
    getSessionsBetween(env.DB, dates[0], dates[6]),
    getActiveEmployees(env.DB),
    getPrograms(env.DB),
  ]);
  return Response.json({ weekStart: start, dates, sessions, employees, programs });
}

/**
 * @api {post} /api/admin/schedule/assign Assign schedule session
 * @apiName AdminAssignSession
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} [employeeId] Employee identifier, or null for an unassigned task.
 * @apiBody {String} date Session date in YYYY-MM-DD format.
 * @apiBody {Number} programId Program identifier.
 * @apiBody {String} [startTime] Start time in HH:MM format.
 * @apiBody {String} [endTime] End time in HH:MM format.
 * @apiBody {Number} [points] Credited points; calculated from the program when omitted.
 * @apiBody {Boolean} [isSudden=false] Whether this is a sudden session (doubles points).
 * @apiBody {Number} [repeatWeeks=1] Also create the same session on this weekday
 *   for the next N-1 weeks. 1 = only this week; capped at 53 (one year).
 * @apiBody {Boolean} [repeatFixed=false] Empty weeks box in the UI: fixed weekly
 *   schedule — same as repeatWeeks = 53 (one year), regardless of repeatWeeks.
 * @apiBody {String} [notes] Optional notes.
 * @apiSuccess {Boolean} success Always true when created.
 * @apiSuccess {Object} session The first created session.
 * @apiSuccess {Number} repeatedWeeks How many weeks the session was created for.
 * @apiSuccess {Boolean} repeatFixed Whether it was created as a fixed schedule.
 * @apiError 400 Invalid assignment payload.
 * @apiError 403 Admin access required.
 */
export async function handleAdminAssignSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const {
    employeeId: requestedEmployeeId,
    date, programId, startTime, endTime, points, isSudden, notes,
    repeatWeeks, repeatFixed,
  } = body;
  const employeeId = requestedEmployeeId == null || requestedEmployeeId === ''
    ? null
    : Number(requestedEmployeeId);
  const parsedProgramId = Number(programId);
  const sessionDate = typeof date === 'string' ? date.slice(0, 10) : '';
  const invalidFields = [];
  if (employeeId !== null && (!Number.isSafeInteger(employeeId) || employeeId < 1)) {
    invalidFields.push('employeeId');
  }
  if (!Number.isSafeInteger(parsedProgramId) || parsedProgramId < 1) {
    invalidFields.push('programId');
  }
  if (!DATE_RE.test(sessionDate)) {
    invalidFields.push('date');
  }
  if (invalidFields.length) {
    return new Response(
      `Invalid assignment payload: ${invalidFields.join(', ')}`,
      { status: 400 }
    );
  }
  if (startTime && !TIME_RE.test(startTime)) return new Response('Invalid start time', { status: 400 });
  if (endTime && !TIME_RE.test(endTime)) return new Response('Invalid end time', { status: 400 });

  // Repeat check:
  //   repeatWeeks = 1        -> only this week (default, old behaviour)
  //   repeatWeeks = N (>1)   -> same weekday/time for N weeks, capped at 53
  //   repeatFixed = true      -> empty weeks box: fixed weekly schedule,
  //                              materialized for one year (FIXED_REPEAT_WEEKS)
  let repeat = 1;
  if (repeatFixed === true) {
    repeat = FIXED_REPEAT_WEEKS;
  } else {
    repeat = Number(repeatWeeks);
    if (!Number.isInteger(repeat) || repeat < 1) repeat = 1;
    if (repeat > MAX_REPEAT_WEEKS) repeat = MAX_REPEAT_WEEKS;
  }

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
  // Every week is a real row, so the task is visible when browsing later weeks.
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
    env.DB, session.email, 'create', 'session', sessionId,
    `Added "${created?.program_name ?? parsedProgramId}" on ${sessionDate}` +
    ` (${startTime || '—'}–${endTime || '—'}) for ${pts} points` +
    `${isSudden ? ' [sudden]' : ''} — ${who}` +
    (repeat > 1 ? ` — repeated for ${repeat} week(s) (same weekday)` : '')
  );
  return Response.json({
    success: true,
    session: created,
    repeatedWeeks: repeat,
    repeatFixed: repeatFixed === true,
  });
}

/**
 * @api {post} /api/admin/schedule/reassign Change the person of a session
 * @apiName AdminReassignSession
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} sessionId Session identifier.
 * @apiBody {Number} employeeId New employee identifier.
 * @apiSuccess {Boolean} success Always true when updated.
 * @apiError 400 Invalid payload or unknown employee.
 * @apiError 403 Admin access required.
 * @apiError 404 Session not found.
 */
export async function handleAdminReassignSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { sessionId, employeeId } = body;
  if (!Number.isInteger(sessionId) || !Number.isInteger(employeeId)) {
    return new Response('Invalid reassign payload', { status: 400 });
  }
  const employee = await env.DB.prepare(
    `SELECT employee_id, is_active, first_name, last_name
     FROM employees WHERE employee_id = ?`
  ).bind(employeeId).first();
  if (!employee || !employee.is_active) {
    return new Response('Unknown or inactive employee', { status: 400 });
  }
  const before = await getSessionById(env.DB, sessionId);
  if (!before) return new Response('Session not found', { status: 404 });

  const result = await reassignSession(env.DB, sessionId, employeeId);
  if (result.meta.changes === 0) return new Response('Session not found', { status: 404 });

  await logScheduleHistory(
    env.DB, session.email, 'reassign', 'session', sessionId,
    `"${before.program_name}" ${before.session_date}: ` +
    `${before.first_name ? before.first_name + ' ' + before.last_name : 'unassigned'}` +
    ` -> ${employee.first_name} ${employee.last_name}`
  );
  return Response.json({ success: true });
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

  const { sessionId, status } = body;
  if (!Number.isInteger(sessionId) ||
      !['scheduled', 'completed', 'cancelled'].includes(status)) {
    return new Response('Invalid status change', { status: 400 });
  }
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
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} sessionId Session identifier.
 * @apiBody {Boolean} [deleteFollowing=false] Also delete every subsequent
 *   occurrence of the same weekly series (same task, person, start/end time
 *   and weekday) from this date onward. Weeks before this date are never
 *   touched; completed later sessions are kept so points/history survive.
 * @apiSuccess {Boolean} success Always true when deleted.
 * @apiSuccess {Number} deletedCount How many sessions were removed.
 * @apiSuccess {Boolean} deletedFollowing Whether the whole series tail was removed.
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

  const { sessionId, deleteFollowing } = body;
  if (!Number.isInteger(sessionId)) return new Response('Invalid session id', { status: 400 });
  const before = await getSessionById(env.DB, sessionId);
  if (!before) return new Response('Session not found', { status: 404 });

  if (deleteFollowing === true) {
    // Delete this session AND all later occurrences of the same weekly series
    // (same task, person, start/end time, weekday) from this date onward.
    // Earlier weeks are untouched. Completed sessions are kept (points/history),
    // except the session that started the deletion itself.
    const following = await findSeriesSessionsFrom(env.DB, before);
    for (const row of following) {
      await deleteSession(env.DB, row.session_id);
    }
    await logScheduleHistory(
      env.DB, session.email, 'delete', 'session', sessionId,
      `Deleted "${before.program_name}" ${before.session_date} ` +
      `(${before.first_name} ${before.last_name}, was ${before.status}) ` +
      `plus ${Math.max(0, following.length - 1)} subsequent weekly occurrence(s) ` +
      `from this date onward`
    );
    return Response.json({
      success: true,
      deletedCount: following.length,
      deletedFollowing: true,
    });
  }

  await deleteSession(env.DB, sessionId);
  await logScheduleHistory(
    env.DB, session.email, 'delete', 'session', sessionId,
    `Deleted "${before.program_name}" ${before.session_date} ` +
    `(${before.first_name} ${before.last_name}, was ${before.status})`
  );
  return Response.json({ success: true, deletedCount: 1 });
}

/**
 * @api {get} /api/admin/schedule/monthly Get monthly schedule summary
 * @apiName AdminMonthlySummary
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiQuery {Number} [year] UTC summary year; defaults to the current year.
 * @apiQuery {Number} [month] Summary month from 1 to 12; defaults to the current month.
 * @apiSuccess {Number} year Summary year.
 * @apiSuccess {Number} month Summary month.
 * @apiSuccess {Object[]} rows Employee summary rows.
 * @apiError 400 Invalid month.
 * @apiError 403 Admin access required.
 */
export async function handleAdminMonthlySummary(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const now = new Date();
  const year = parseInt(url.searchParams.get('year'), 10) || now.getUTCFullYear();
  const month = parseInt(url.searchParams.get('month'), 10) || now.getUTCMonth() + 1;
  if (month < 1 || month > 12) return new Response('Invalid month', { status: 400 });
  const rows = await getMonthlySummary(env.DB, year, month);
  return Response.json({ year, month, rows });
}

/**
 * @api {post} /api/admin/schedule/target Set monthly points target
 * @apiName AdminSetTarget
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} employeeId Employee identifier.
 * @apiBody {Number} year Target year.
 * @apiBody {Number} month Target month from 1 to 12.
 * @apiBody {Number} targetPoints Target points from 0 to 10000.
 * @apiSuccess {Boolean} success Always true when saved.
 * @apiError 400 Invalid target payload or points.
 * @apiError 403 Admin access required.
 */
export async function handleAdminSetTarget(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { employeeId, year, month, targetPoints } = body;
  if (!Number.isInteger(employeeId) || !Number.isInteger(year) ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    return new Response('Invalid target payload', { status: 400 });
  }
  const pts = Number(targetPoints);
  if (!Number.isFinite(pts) || pts < 0 || pts > 10000) {
    return new Response('Invalid target points', { status: 400 });
  }

  await setMonthlyTarget(env.DB, employeeId, year, month, pts);
  await logScheduleHistory(
    env.DB, session.email, 'target', 'employee', employeeId,
    `Monthly target for ${year}-${String(month).padStart(2, '0')} set to ${pts} points`
  );
  return Response.json({ success: true });
}