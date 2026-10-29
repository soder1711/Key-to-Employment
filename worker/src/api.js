import {
  getEmployeeTasks, getTaskDetail, updateAssignmentProgress,
  getAllTasks, getAnyTaskDetail, updateAssignmentProgressAsAdmin,
  weekStartFrom, weekDates, getPrograms, getActiveEmployees,
  getSessionsBetween, getSessionById, createSession, setSessionStatus,
  deleteSession, logScheduleHistory, getMonthlySummary, setMonthlyTarget,
  reassignSession,
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
 * @apiBody {String} [notes] Optional notes.
 * @apiSuccess {Boolean} success Always true when created.
 * @apiSuccess {Object} session Created session.
 * @apiError 400 Invalid assignment payload.
 * @apiError 403 Admin access required.
 */
export async function handleAdminAssignSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const {
    employeeId: requestedEmployeeId,
    date, programId, startTime, endTime, points, isSudden, notes,
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

  // Automatic point calculation: derive from the program default when not provided
  let pts = Number(points);
  if (!Number.isFinite(pts)) {
    const prog = await env.DB.prepare(
      'SELECT default_points FROM programs WHERE program_id = ?'
    ).bind(programId).first();
    pts = Number(prog?.default_points || 0) * (isSudden ? 2 : 1);
  }
  if (!Number.isFinite(pts) || pts < 0 || pts > 100) {
    return new Response('Invalid points', { status: 400 });
  }

  const result = await createSession(env.DB, {
    sessionDate, programId: parsedProgramId, employeeId,
    startTime, endTime, points: pts,
    isSudden: !!isSudden, notes, createdBy: session.employeeId,
  });

  const sessionId = result.meta.last_row_id;
  const created = await getSessionById(env.DB, sessionId);
  const who = created?.first_name
    ? `${created.first_name} ${created.last_name}`
    : 'no person yet';
  await logScheduleHistory(
    env.DB, session.email, 'create', 'session', sessionId,
    `Added "${created?.program_name ?? parsedProgramId}" on ${sessionDate}` +
    ` (${startTime || '—'}–${endTime || '—'}) for ${pts} points` +
    `${isSudden ? ' [sudden]' : ''} — ${who}`
  );
  return Response.json({ success: true, session: created });
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
 * @apiSuccess {Boolean} success Always true when deleted.
 * @apiError 400 Invalid session ID.
 * @apiError 403 Admin access required.
 * @apiError 404 Session not found.
 */
export async function handleAdminDeleteSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { sessionId } = body;
  if (!Number.isInteger(sessionId)) return new Response('Invalid session id', { status: 400 });
  const before = await getSessionById(env.DB, sessionId);
  if (!before) return new Response('Session not found', { status: 404 });

  await deleteSession(env.DB, sessionId);
  await logScheduleHistory(
    env.DB, session.email, 'delete', 'session', sessionId,
    `Deleted "${before.program_name}" ${before.session_date} ` +
    `(${before.first_name} ${before.last_name}, was ${before.status})`
  );
  return Response.json({ success: true });
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