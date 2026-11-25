import { monthlyDateRange } from '../monthly-summary.js';
import { expandRecurringOccurrences } from '../recurrence.js';
import { vietnamDateISO } from '../date.js';

export function weekStartFrom(dateStr) {
  const base = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr
    : vietnamDateISO();
  const d = new Date(base + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day)); // Monday start
  return d.toISOString().slice(0, 10);
}

export function weekDates(weekStart) {
  const d = new Date(weekStart + 'T00:00:00Z');
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

export async function getActiveEmployees(db) {
  const { results } = await db.prepare(
    `SELECT employee_id, first_name, last_name, email, department
     FROM employees WHERE is_active = 1 ORDER BY first_name, last_name`
  ).all();
  return results;
}

// LEFT JOIN so sessions without a person yet still appear (Plan board).
// program_id is selected so series matching can key off it.
const SESSION_SELECT = `
  SELECT s.session_id, s.program_id, s.session_date, s.start_time, s.end_time, s.status,
         s.points, s.is_sudden, s.notes, s.occurrence_notes, s.employee_id,
         s.template_id, s.template_date, s.recurring_series_id, s.recurrence_date,
         (SELECT json_group_array(json_object(
            'employee_id', oa.employee_id, 'first_name', ae.first_name,
            'last_name', ae.last_name, 'email', ae.email))
          FROM schedule_occurrence_assignments oa
          JOIN employees ae ON ae.employee_id = oa.employee_id
          WHERE (s.recurring_series_id IS NOT NULL
                 AND oa.recurring_series_id = s.recurring_series_id
                 AND oa.occurrence_date = s.recurrence_date)
             OR (s.recurring_series_id IS NULL AND oa.session_id = s.session_id)
         ) AS assignees_json,
         rs.ended_from AS series_ended_from,
         p.code AS program_code, p.name AS program_name, p.category,
         p.is_active AS program_is_active, p.default_points AS program_default_points,
         e.first_name, e.last_name, e.email AS employee_email
  FROM schedule_sessions s
  JOIN programs p ON p.program_id = s.program_id
  LEFT JOIN employees e ON e.employee_id = s.employee_id
  LEFT JOIN recurring_schedule_series rs ON rs.series_id = s.recurring_series_id`;

function addSessionAssignees(row) {
  const explicit = JSON.parse(row.assignees_json || '[]')
    .filter(person => person.employee_id != null);
  const assignees = explicit.length ? explicit : row.employee_id == null ? [] : [{
    employee_id: row.employee_id, first_name: row.first_name,
    last_name: row.last_name, email: row.employee_email,
  }];
  return {
    ...row,
    assignees,
    employee_ids: assignees.map(person => Number(person.employee_id)),
    ...(assignees.length === 1 ? assignees[0] : {
      employee_id: null, first_name: null, last_name: null, employee_email: null,
    }),
  };
}

export async function getSessionsBetween(db, startDate, endDate, employeeId = null) {
  const sql = SESSION_SELECT + `
    WHERE s.session_date >= ? AND s.session_date <= ?
    ${employeeId ? `AND (s.employee_id = ? OR EXISTS (
      SELECT 1 FROM schedule_occurrence_assignments oa
      WHERE oa.employee_id = ? AND (
        oa.session_id = s.session_id OR
        (s.recurring_series_id IS NOT NULL
         AND oa.recurring_series_id = s.recurring_series_id
         AND oa.occurrence_date = s.recurrence_date)
      )
    ))` : ''}
    ORDER BY s.session_date, s.start_time, s.session_id`;
  const stmt = db.prepare(sql);
  const { results } = employeeId
    ? await stmt.bind(startDate, endDate, employeeId, employeeId).all()
    : await stmt.bind(startDate, endDate).all();
  return results.map(addSessionAssignees);
}

async function getRecurringAssignmentMap(db, startDate, endDate) {
  const { results } = await db.prepare(`
    SELECT oa.recurring_series_id, oa.occurrence_date, oa.employee_id,
           e.first_name, e.last_name, e.email AS employee_email
    FROM schedule_occurrence_assignments oa
    JOIN employees e ON e.employee_id = oa.employee_id
    WHERE oa.recurring_series_id IS NOT NULL
      AND ((oa.occurrence_date >= ? AND oa.occurrence_date <= ?)
        OR EXISTS (
          SELECT 1 FROM recurring_schedule_exceptions x
          WHERE x.series_id = oa.recurring_series_id
            AND x.occurrence_date = oa.occurrence_date
            AND x.moved_date >= ? AND x.moved_date <= ?
        ))
    ORDER BY e.first_name, e.last_name
  `).bind(startDate, endDate, startDate, endDate).all();
  const assignments = new Map();
  for (const row of results) {
    const key = `${row.recurring_series_id}:${row.occurrence_date}`;
    const list = assignments.get(key) || [];
    list.push({ employee_id: row.employee_id, first_name: row.first_name,
      last_name: row.last_name, email: row.employee_email });
    assignments.set(key, list);
  }
  return assignments;
}

function attachRecurringAssignees(occurrences, assignments) {
  return occurrences.map(row => {
    const assignees = assignments.get(`${row.recurring_series_id}:${row.recurrence_date}`)
      || row.assignees || (row.employee_id == null ? [] : [{
        employee_id: row.employee_id, first_name: row.first_name,
        last_name: row.last_name, email: row.employee_email,
      }]);
    return {
      ...row,
      assignees,
      employee_ids: assignees.map(person => Number(person.employee_id)),
      ...(assignees.length === 1 ? assignees[0] : {
        employee_id: null, first_name: null, last_name: null, employee_email: null,
      }),
    };
  });
}

export async function getRecurringOccurrencesBetween(db, startDate, endDate, employeeId = null) {
  const [versions, exceptions, sessions, assignments] = await Promise.all([
    db.prepare(`
      SELECT v.*, v.series_id, rs.ended_from, p.code AS program_code, p.name AS program_name,
             p.category, p.is_active AS program_is_active,
             p.default_points AS program_default_points,
             e.first_name, e.last_name, e.email AS employee_email
      FROM recurring_schedule_versions v
      JOIN recurring_schedule_series rs ON rs.series_id = v.series_id
      LEFT JOIN programs p ON p.program_id = v.program_id
      LEFT JOIN employees e ON e.employee_id = v.employee_id
      WHERE v.effective_from <= ?
        AND (v.effective_to IS NULL OR v.effective_to > ?)
      ORDER BY v.series_id, v.effective_from
    `).bind(endDate, startDate).all(),
    db.prepare(`
      SELECT x.series_id, x.occurrence_date, x.action, x.program_id, x.employee_id,
             x.moved_date, x.start_time, x.end_time, x.points, x.is_sudden, x.notes,
                    rs.ended_from AS series_ended_from,
             p.code AS program_code, p.name AS program_name, p.category,
             p.is_active AS program_is_active, p.default_points AS program_default_points,
             e.first_name, e.last_name, e.email AS employee_email
      FROM recurring_schedule_exceptions x
             JOIN recurring_schedule_series rs ON rs.series_id = x.series_id
      LEFT JOIN programs p ON p.program_id = x.program_id
      LEFT JOIN employees e ON e.employee_id = x.employee_id
      WHERE (x.occurrence_date >= ? AND x.occurrence_date <= ?)
         OR (x.moved_date >= ? AND x.moved_date <= ?)
    `).bind(startDate, endDate, startDate, endDate).all(),
    db.prepare(
      SESSION_SELECT + ` WHERE (s.recurrence_date >= ? AND s.recurrence_date <= ?)
        OR (s.session_date >= ? AND s.session_date <= ?)`
    ).bind(startDate, endDate, startDate, endDate).all(),
    getRecurringAssignmentMap(db, startDate, endDate),
  ]);
  return attachRecurringAssignees(expandRecurringOccurrences(
    versions.results, startDate, endDate, exceptions.results, sessions.results,
  ), assignments).filter(row => employeeId == null || row.employee_ids.includes(employeeId));
}

export async function getRecurringOccurrenceByKey(db, seriesId, occurrenceDate) {
  const [versions, exceptions, sessions, assignments] = await Promise.all([
    db.prepare(`
      SELECT v.*, rs.ended_from, p.code AS program_code, p.name AS program_name,
             p.category, p.is_active AS program_is_active,
             p.default_points AS program_default_points,
             e.first_name, e.last_name, e.email AS employee_email
      FROM recurring_schedule_versions v
      JOIN recurring_schedule_series rs ON rs.series_id = v.series_id
      LEFT JOIN programs p ON p.program_id = v.program_id
      LEFT JOIN employees e ON e.employee_id = v.employee_id
      WHERE v.series_id = ? AND v.effective_from <= ?
        AND (v.effective_to IS NULL OR v.effective_to > ?)
      ORDER BY v.effective_from DESC LIMIT 1
    `).bind(seriesId, occurrenceDate, occurrenceDate).all(),
    db.prepare(`
      SELECT x.series_id, x.occurrence_date, x.action, x.program_id, x.employee_id,
             x.moved_date, x.start_time, x.end_time, x.points, x.is_sudden, x.notes,
             rs.ended_from AS series_ended_from,
             p.code AS program_code, p.name AS program_name, p.category,
             p.is_active AS program_is_active, p.default_points AS program_default_points,
             e.first_name, e.last_name, e.email AS employee_email
      FROM recurring_schedule_exceptions x
      JOIN recurring_schedule_series rs ON rs.series_id = x.series_id
      LEFT JOIN programs p ON p.program_id = x.program_id
      LEFT JOIN employees e ON e.employee_id = x.employee_id
      WHERE x.series_id = ? AND x.occurrence_date = ?
    `).bind(seriesId, occurrenceDate).all(),
    db.prepare(
      SESSION_SELECT + ` WHERE s.recurring_series_id = ? AND s.recurrence_date = ?`
    ).bind(seriesId, occurrenceDate).all(),
    getRecurringAssignmentMap(db, occurrenceDate, occurrenceDate),
  ]);
  const [occurrence] = attachRecurringAssignees(expandRecurringOccurrences(
    versions.results, occurrenceDate, occurrenceDate, exceptions.results, sessions.results,
    { includeMovedOutsideRange: true },
  ), assignments);
  if (occurrence) return occurrence;
  const session = sessions.results[0];
  return session ? {
    ...addSessionAssignees(session), is_recurring: true,
    is_old_recurring: true, is_projected: false,
  } : null;
}

export async function getScheduleBetween(db, startDate, endDate, employeeId = null) {
  const [sessions, occurrences] = await Promise.all([
    getSessionsBetween(db, startDate, endDate, employeeId),
    getRecurringOccurrencesBetween(db, startDate, endDate, employeeId),
  ]);
  const projectedKeys = new Set(occurrences.map(row =>
    `${row.recurring_series_id}:${row.recurrence_date}`));
  const unmatchedRecords = sessions.filter(session => session.recurring_series_id != null &&
    !projectedKeys.has(`${session.recurring_series_id}:${session.recurrence_date}`) &&
    session.status !== 'scheduled' &&
    (session.status === 'completed' || !session.series_ended_from ||
      session.recurrence_date < session.series_ended_from))
    .map(session => ({ ...session, is_recurring: true,
      is_old_recurring: true, is_projected: false }));
  return [
    ...sessions.filter(session => session.recurring_series_id == null),
    ...occurrences,
    ...unmatchedRecords,
  ].sort((a, b) => a.session_date.localeCompare(b.session_date) ||
    String(a.start_time || '').localeCompare(String(b.start_time || '')) ||
    Number(typeof a.session_id === 'number' ? a.session_id : a.recurring_series_id) -
      Number(typeof b.session_id === 'number' ? b.session_id : b.recurring_series_id));
}

export async function getMonthlySessions(db, year, month, employeeId) {
  const { start, end } = monthlyDateRange(year, month);
  const sessions = await getScheduleBetween(db, start, end, employeeId);
  return sessions.filter(session =>
    (session.employee_ids || []).includes(employeeId) ||
    Number(session.employee_id) === employeeId ||
    (session.assignees || []).some(person => Number(person.employee_id) === employeeId));
}

export async function getSessionById(db, sessionId) {
  const session = await db.prepare(
    SESSION_SELECT + ` WHERE s.session_id = ? LIMIT 1`
  ).bind(sessionId).first();
  return session ? addSessionAssignees(session) : null;
}

export async function getRecurringTimetable(db, today = vietnamDateISO()) {
  const { results } = await db.prepare(`
    SELECT v.version_id, v.series_id, v.weekday, v.program_id, v.employee_id,
           v.start_time, v.end_time, v.points, v.is_sudden, v.notes,
           v.start_date, v.end_date, v.effective_from,
           p.code AS program_code, p.name AS program_name, p.category,
           p.is_active AS program_is_active, p.default_points AS program_default_points,
           e.first_name, e.last_name
    FROM recurring_schedule_versions v
    JOIN recurring_schedule_series rs ON rs.series_id = v.series_id
    LEFT JOIN programs p ON p.program_id = v.program_id
    LEFT JOIN employees e ON e.employee_id = v.employee_id
    WHERE v.effective_to IS NULL AND rs.ended_from IS NULL
      AND (v.end_date IS NULL OR v.end_date >= ?)
    ORDER BY v.weekday, v.start_time, v.series_id
  `).bind(today).all();
  return results;
}

export async function getRecurringVersionAt(db, seriesId, date) {
  return await db.prepare(`
    SELECT * FROM recurring_schedule_versions
    WHERE series_id = ? AND effective_from <= ?
      AND (effective_to IS NULL OR effective_to > ?)
    ORDER BY effective_from DESC LIMIT 1
  `).bind(seriesId, date, date).first();
}

const RECURRING_VERSION_COLUMNS = `
  weekday, program_id, employee_id, start_time, end_time, points, is_sudden,
  notes, start_date, end_date, effective_from, created_by`;
