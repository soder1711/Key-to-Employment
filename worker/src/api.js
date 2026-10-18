import {
  getEmployeeTasks, getTaskDetail, updateAssignmentProgress,
  getAllTasks, getAnyTaskDetail, updateAssignmentProgressAsAdmin,
  weekStartFrom, weekDates, getPrograms, getActiveEmployees,
  getSessionsBetween, getSessionById, createSession, setSessionStatus,
  deleteSession, logScheduleHistory, getMonthlySummary, setMonthlyTarget,
} from './db.js';

export async function handleGetMyTasks(env, session) {
  const tasks = await getEmployeeTasks(env.DB, session.employeeId);
  return Response.json({ tasks });
}

export async function handleGetTask(env, session, taskId) {
  const task = await getTaskDetail(env.DB, taskId, session.employeeId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

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

export async function handleAdminGetAllTasks(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const status = url.searchParams.get('status');
  const employeeIdParam = url.searchParams.get('employeeId');
  const employeeId = employeeIdParam ? parseInt(employeeIdParam, 10) : null;

  const tasks = await getAllTasks(env.DB, { status, employeeId });
  return Response.json({ tasks });
}

export async function handleAdminGetTask(env, session, taskId) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const task = await getAnyTaskDetail(env.DB, taskId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

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

export async function handleAdminAssignSession(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { employeeId, date, programId, startTime, endTime, points, isSudden, notes } = body;
  if (!Number.isInteger(employeeId) || !Number.isInteger(programId) || !DATE_RE.test(date || '')) {
    return new Response('Invalid assignment payload', { status: 400 });
  }
  if (startTime && !TIME_RE.test(startTime)) return new Response('Invalid start time', { status: 400 });
  if (endTime && !TIME_RE.test(endTime)) return new Response('Invalid end time', { status: 400 });
  const pts = Number(points);
  if (!Number.isFinite(pts) || pts < 0 || pts > 100) {
    return new Response('Invalid points', { status: 400 });
  }

  const result = await createSession(env.DB, {
    sessionDate: date, programId, employeeId,
    startTime, endTime, points: pts,
    isSudden: !!isSudden, notes, createdBy: session.employeeId,
  });

  const sessionId = result.meta.last_row_id;
  const created = await getSessionById(env.DB, sessionId);
  await logScheduleHistory(
    env.DB, session.email, 'create', 'session', sessionId,
    `Assigned "${created?.program_name ?? programId}" on ${date}` +
    ` (${startTime || '—'}–${endTime || '—'}) to ` +
    `${created ? created.first_name + ' ' + created.last_name : 'employee ' + employeeId}` +
    ` for ${pts} points${isSudden ? ' [sudden]' : ''}`
  );
  return Response.json({ success: true, session: created });
}

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