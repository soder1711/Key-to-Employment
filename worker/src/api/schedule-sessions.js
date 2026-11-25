import {
  weekStartFrom, getSessionsBetween, getRecurringOccurrenceByKey, clearRecurringException, getSessionById, createSession, updateSession, setSessionStatus, deleteSession, logScheduleHistory, setRecurringException, saveRecurringOccurrence, setOccurrenceAssignment, getProgramById
} from '../db.js';
import { requireAdmin } from './authorization.js';
import { TIME_RE } from './schedule-validation.js';
import { MAX_REPEAT_WEEKS } from './schedule-validation.js';
import { parseCorrectionReason } from './schedule-validation.js';
import { isValidISODate } from './schedule-validation.js';
import { addDaysISO } from './schedule-validation.js';

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
 * @apiBody {String} [correctionReason] Optional reason for editing the session (maximum 1000 characters).
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
  if (correctionReason === null) {
    return new Response('Invalid correction reason (maximum 1000 characters)', { status: 400 });
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
    (correctionReason ? `reason: ${correctionReason}` : 'reason not provided')
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

