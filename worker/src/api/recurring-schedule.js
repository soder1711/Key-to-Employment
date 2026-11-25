import {
  weekStartFrom, getScheduleBetween, getRecurringOccurrenceByKey, setSessionStatus, logScheduleHistory, getRecurringTimetable, getRecurringVersionAt, createRecurringSeries, createRecurringSeriesBatch, updateRecurringSeriesFrom, endRecurringSeriesFrom, endRecurringTimetableFrom, setRecurringException, getProgramById
} from '../db.js';
import { requireAdmin } from './authorization.js';
import { vietnamDateISO } from '../date.js';
import { TIME_RE } from './schedule-validation.js';
import { parseCorrectionReason } from './schedule-validation.js';
import { isValidISODate } from './schedule-validation.js';
import { addDaysISO } from './schedule-validation.js';

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
  if (correctionReason === null) {
    return new Response('Invalid correction reason (maximum 1000 characters)', { status: 400 });
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
        (correctionReason ? `reason: ${correctionReason}` : 'reason not provided'));
      return Response.json({ success: true, occurrenceDate, modified: true });
    }
    return new Response('Invalid occurrence action', { status: 400 });
  }

  return new Response('Unknown timetable operation', { status: 400 });
}

