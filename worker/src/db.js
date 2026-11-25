import { aggregateMonthlyRows, monthlyDateRange } from './monthly-summary.js';
import { expandRecurringOccurrences } from './recurrence.js';
import { vietnamDateISO } from './date.js';

// All queries use parameter binding — never string concatenation
export async function getEmployeeAuth(db, employeeId) {
  return await db.prepare(`
    SELECT employee_id, email, is_active, is_admin, picture_url
    FROM employees
    WHERE employee_id = ?
    LIMIT 1
  `).bind(employeeId).first();
}

export async function getEmployeeDirectory(db) {
  const { results } = await db.prepare(`
    SELECT employee_id, employee_code, first_name, last_name, email, is_active, is_admin
    FROM employees
    ORDER BY is_active DESC, first_name, last_name
  `).all();
  return results;
}

export async function getManagedEmployee(db, employeeId) {
  return await db.prepare(`
    SELECT employee_id, employee_code, first_name, last_name, email, is_active, is_admin
    FROM employees
    WHERE employee_id = ?
    LIMIT 1
  `).bind(employeeId).first();
}

export async function findEmployeeByCodeOrEmail(db, employeeCode, email) {
  return await db.prepare(`
    SELECT employee_id
    FROM employees
    WHERE employee_code = ? OR email = ?
    LIMIT 1
  `).bind(employeeCode, email).first();
}

export async function createEmployee(db, employee) {
  return await db.prepare(`
    INSERT INTO employees (employee_code, first_name, last_name, email, is_admin, is_active)
    VALUES (?, ?, ?, ?, 0, 1)
  `).bind(
    employee.employeeCode,
    employee.firstName,
    employee.lastName,
    employee.email,
  ).run();
}

export async function deactivateEmployee(db, employeeId) {
  return await db.prepare(`
    UPDATE employees
    SET is_active = 0
    WHERE employee_id = ? AND is_admin = 0 AND is_active = 1
  `).bind(employeeId).run();
}

export async function reactivateEmployee(db, employeeId) {
  return await db.prepare(`
    UPDATE employees
    SET is_active = 1
    WHERE employee_id = ? AND is_admin = 0 AND is_active = 0
  `).bind(employeeId).run();
}

export async function getScheduleHistory(db, {
  beforeId = null, afterId = null, page = 1, limit = 50,
  staff = '', record = '', fromDate = '', toDate = '',
} = {}) {
  const clauses = [];
  const bindings = [];
  if (staff) {
    clauses.push('LOWER(actor_email) LIKE ?');
    bindings.push(`%${staff.toLowerCase()}%`);
  }
  if (record) {
    clauses.push('(LOWER(entity) LIKE ? OR CAST(entity_id AS TEXT) LIKE ?)');
    bindings.push(`%${record.toLowerCase()}%`, `%${record.toLowerCase()}%`);
  }
  if (fromDate) {
    clauses.push("date(datetime(acted_at, '+7 hours')) >= ?");
    bindings.push(fromDate);
  }
  if (toDate) {
    clauses.push("date(datetime(acted_at, '+7 hours')) <= ?");
    bindings.push(toDate);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const count = await db.prepare(
    `SELECT COUNT(*) AS total FROM schedule_history ${where}`
  ).bind(...bindings).first();
  const total = Number(count?.total) || 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  page = Math.min(page, pageCount);
  const cursorCondition = afterId !== null
    ? 'history_id > ?'
    : beforeId !== null ? 'history_id < ?' : '';
  const cursorClause = cursorCondition
    ? `${where ? ' AND' : 'WHERE'} ${cursorCondition}`
    : '';
  const cursorBindings = afterId !== null ? [afterId] : beforeId !== null ? [beforeId] : [];
  const direction = afterId !== null ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;
  const query = `SELECT history_id, acted_at, actor_email, action, entity, entity_id, details
    FROM schedule_history ${where}${cursorClause}
    ORDER BY history_id ${direction} LIMIT ?${afterId !== null || beforeId !== null ? '' : ' OFFSET ?'}`;
  const result = await db.prepare(query).bind(
    ...bindings, ...cursorBindings, limit,
    ...(afterId !== null || beforeId !== null ? [] : [offset]),
  ).all();
  return { entries: result.results, total, page };
}

export async function getEmployeeTasks(db, employeeId) {
  const { results } = await db.prepare(`
    SELECT
      t.task_id, t.task_code, t.title, t.description,
      t.priority, t.status, t.deadline, t.estimated_hours,
      ta.assignment_id, ta.allocated_hours, ta.actual_hours,
      ta.status AS assignment_status,
      ta.completion_percentage, ta.notes
    FROM task_assignments ta
    JOIN tasks t ON ta.task_id = t.task_id
    WHERE ta.employee_id = ?
      AND ta.status NOT IN ('cancelled')
    ORDER BY
      CASE t.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      t.deadline ASC
  `).bind(employeeId).all();
  return results;
}

export async function getTaskDetail(db, taskId, employeeId) {
  // Ensure the employee is actually assigned to this task
  return await db.prepare(`
    SELECT t.*, ta.*
    FROM task_assignments ta
    JOIN tasks t ON ta.task_id = t.task_id
    WHERE ta.task_id = ? AND ta.employee_id = ?
    LIMIT 1
  `).bind(taskId, employeeId).first();
}

export async function updateAssignmentProgress(db, assignmentId, employeeId, percentage, notes) {
  // WHERE clause includes employee_id to prevent IDOR (user editing someone else's task)
  return await db.prepare(`
    UPDATE task_assignments
    SET completion_percentage = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE assignment_id = ? AND employee_id = ?
  `).bind(percentage, notes, assignmentId, employeeId).run();
}

export async function logTimeEntry(db, assignmentId, employeeId, taskId, hours, description) {
  return await db.prepare(`
    INSERT INTO time_entries
      (assignment_id, employee_id, task_id, entry_date, hours_worked, description)
    VALUES (?, ?, ?, DATE('now'), ?, ?)
  `).bind(assignmentId, employeeId, taskId, hours, description).run();
}

export async function getAllTasks(db, { status, employeeId } = {}) {
  let sql = `
    SELECT
      t.task_id, t.task_code, t.title, t.description,
      t.priority, t.complexity, t.status, t.deadline, t.estimated_hours,
      ta.assignment_id, ta.employee_id, ta.allocated_hours, ta.actual_hours,
      ta.status AS assignment_status, ta.completion_percentage, ta.notes,
      e.email AS employee_email, e.first_name, e.last_name, e.department
    FROM tasks t
    LEFT JOIN task_assignments ta
      ON ta.task_id = t.task_id
     AND ta.status NOT IN ('cancelled')
    LEFT JOIN employees e ON e.employee_id = ta.employee_id
    WHERE 1 = 1
  `;
  const params = [];

  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  if (employeeId) {
    sql += ' AND ta.employee_id = ?';
    params.push(employeeId);
  }

  sql += `
    ORDER BY
      CASE t.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      t.deadline ASC
    LIMIT 500
  `;

  const stmt = db.prepare(sql);
  const { results } = params.length
    ? await stmt.bind(...params).all()
    : await stmt.all();
  return results;
}

export async function getAnyTaskDetail(db, taskId) {
  return await db.prepare(`
    SELECT t.*, ta.*
    FROM tasks t
    LEFT JOIN task_assignments ta ON ta.task_id = t.task_id
    WHERE t.task_id = ?
    LIMIT 1
  `).bind(taskId).first();
}

// Admin override: no employee_id filter
export async function updateAssignmentProgressAsAdmin(
  db, assignmentId, percentage, notes
) {
  return await db.prepare(`
    UPDATE task_assignments
    SET completion_percentage = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE assignment_id = ?
  `).bind(percentage, notes, assignmentId).run();
}

// ---------- Weekly schedule (VOV sessions) ----------

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

export async function getPrograms(db) {
  const { results } = await db.prepare(
    `SELECT program_id, code, name, category, default_points, default_start, default_end
     FROM programs WHERE is_active = 1 ORDER BY category, name`
  ).all();
  return results;
}

// ---------- Task types (programs) — create / list / delete ----------

export async function getAllPrograms(db) {
  const { results } = await db.prepare(
    `SELECT program_id, code, name, category, default_points, default_start, default_end, is_active
     FROM programs ORDER BY is_active DESC, category, name`
  ).all();
  return results;
}

export async function getProgramById(db, programId) {
  return await db.prepare(
    `SELECT program_id, code, name, category, default_points, default_start, default_end, is_active
     FROM programs WHERE program_id = ? LIMIT 1`
  ).bind(programId).first();
}

export async function getProgramByCode(db, code) {
  return await db.prepare(
    `SELECT program_id FROM programs WHERE code = ? LIMIT 1`
  ).bind(code).first();
}

export async function createProgram(db, p) {
  return await db.prepare(
    `INSERT INTO programs
       (code, name, category, default_points, default_start, default_end, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(p.code, p.name, p.category, p.defaultPoints,
         p.defaultStart || null, p.defaultEnd || null).run();
}

export async function updateProgram(db, programId, p) {
  return await db.prepare(
    `UPDATE programs
     SET name = ?, default_points = ?, default_start = ?, default_end = ?
     WHERE program_id = ?`
  ).bind(p.name, p.defaultPoints, p.defaultStart || null, p.defaultEnd || null, programId).run();
}

// Soft delete: hides the task from pickers but keeps existing sessions intact
export async function deactivateProgram(db, programId) {
  const result = await db.prepare(
    `UPDATE programs SET is_active = 0 WHERE program_id = ?`
  ).bind(programId).run();
  await db.prepare(
    `UPDATE weekly_schedule_templates SET is_active = 0 WHERE program_id = ?`
  ).bind(programId).run();
  return result;
}

export async function reactivateProgram(db, programId) {
  const result = await db.prepare(
    `UPDATE programs SET is_active = 1 WHERE program_id = ? AND is_active = 0`
  ).bind(programId).run();
  if (result.meta.changes > 0) {
    await db.prepare(
      `UPDATE weekly_schedule_templates SET is_active = 1 WHERE program_id = ?`
    ).bind(programId).run();
  }
  return result;
}

// Hard delete: only used when no session references the task
export async function hardDeleteProgram(db, programId) {
  return await db.prepare(
    `DELETE FROM programs WHERE program_id = ?`
  ).bind(programId).run();
}

export async function countProgramReferences(db, programId) {
  const row = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM schedule_sessions WHERE program_id = ?) +
       (SELECT COUNT(*) FROM weekly_schedule_templates WHERE program_id = ?) +
       (SELECT COUNT(*) FROM recurring_schedule_versions WHERE program_id = ?) +
       (SELECT COUNT(*) FROM recurring_schedule_exceptions WHERE program_id = ?) AS n`
  ).bind(programId, programId, programId, programId).first();
  return row?.n ?? 0;
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
  return session ? { ...addSessionAssignees(session), is_recurring: true, is_projected: false } : null;
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
    (session.status === 'completed' || !session.series_ended_from ||
      session.recurrence_date < session.series_ended_from))
    .map(session => ({ ...session, is_recurring: true, is_projected: false }));
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

function recurringVersionValues(version, createdBy) {
  return [version.weekday, version.programId, version.employeeId,
    version.startTime, version.endTime, version.points, version.isSudden ? 1 : 0,
    version.notes, version.startDate, version.endDate, version.effectiveFrom, createdBy];
}

export async function createRecurringSeries(db, version, createdBy, actorEmail) {
  const [seriesId] = await createRecurringSeriesBatch(
    db, [version], createdBy, actorEmail,
    `Created one weekly series effective ${version.effectiveFrom}`,
  );
  return seriesId;
}

export async function createRecurringSeriesBatch(db, versions, createdBy, actorEmail, details) {
  if (!versions.length) return [];
  const statements = [];
  versions.forEach(version => {
    statements.push(db.prepare(
      `INSERT INTO recurring_schedule_series (created_by) VALUES (?)`
    ).bind(createdBy));
    statements.push(db.prepare(
      `INSERT INTO recurring_schedule_versions (series_id, ${RECURRING_VERSION_COLUMNS})
       SELECT last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`
    ).bind(...recurringVersionValues(version, createdBy)));
  });
  statements.push(db.prepare(
    `INSERT INTO schedule_history (actor_email, action, entity, entity_id, details)
     VALUES (?, 'create', 'recurring-timetable', NULL, ?)`
  ).bind(actorEmail, details));
  const results = await db.batch(statements);
  return versions.map((_, index) => results[index * 2].meta.last_row_id);
}

export async function updateRecurringSeriesFrom(
  db, seriesId, currentVersion, version, cutoffDate, replaceFutureExceptions, createdBy, actorEmail,
  correctionReason
) {
  const statements = [];
  if (cutoffDate > currentVersion.effective_from) {
    statements.push(db.prepare(
      `UPDATE recurring_schedule_versions SET effective_to = ?
       WHERE version_id = ?`
    ).bind(cutoffDate, currentVersion.version_id));
    statements.push(db.prepare(
      `DELETE FROM recurring_schedule_versions
       WHERE series_id = ? AND effective_from >= ?`
    ).bind(seriesId, cutoffDate));
    statements.push(db.prepare(
      `INSERT INTO recurring_schedule_versions (series_id, ${RECURRING_VERSION_COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(seriesId, ...recurringVersionValues({
      ...version,
      startDate: currentVersion.start_date,
      effectiveFrom: cutoffDate,
    }, createdBy)));
  } else {
    statements.push(db.prepare(
      `UPDATE recurring_schedule_versions
       SET weekday = ?, program_id = ?, employee_id = ?, start_time = ?, end_time = ?,
           points = ?, is_sudden = ?, notes = ?, start_date = ?, end_date = ?, effective_to = NULL
       WHERE version_id = ?`
    ).bind(version.weekday, version.programId, version.employeeId, version.startTime,
      version.endTime, version.points, version.isSudden ? 1 : 0, version.notes,
      currentVersion.start_date, version.endDate, currentVersion.version_id));
    statements.push(db.prepare(
      `DELETE FROM recurring_schedule_versions
       WHERE series_id = ? AND effective_from > ?`
    ).bind(seriesId, cutoffDate));
  }
  if (replaceFutureExceptions) {
    statements.push(db.prepare(
      `DELETE FROM recurring_schedule_exceptions
       WHERE series_id = ? AND occurrence_date >= ?`
    ).bind(seriesId, cutoffDate));
  }
  statements.push(db.prepare(
    `INSERT INTO schedule_history (actor_email, action, entity, entity_id, details)
     VALUES (?, 'update', 'recurring-series', ?, ?)`
  ).bind(actorEmail, seriesId,
    `Updated series from ${cutoffDate}; ` +
    `points ${Number(currentVersion.points).toFixed(1)} -> ${Number(version.points).toFixed(1)}; ` +
    `${correctionReason ? `reason: ${correctionReason}; ` : 'reason not provided; '}` +
    `occurrence exceptions from cutoff ${replaceFutureExceptions ? 'replaced' : 'preserved'}`));
  await db.batch(statements);
}

export async function endRecurringSeriesFrom(db, seriesId, cutoffDate, actorEmail) {
  await db.batch([
    db.prepare(`UPDATE recurring_schedule_series
      SET ended_from = CASE WHEN ended_from IS NULL OR ended_from > ? THEN ? ELSE ended_from END
      WHERE series_id = ?`).bind(cutoffDate, cutoffDate, seriesId),
    db.prepare(`UPDATE recurring_schedule_versions SET effective_to = ?
      WHERE series_id = ? AND effective_from < ?
        AND (effective_to IS NULL OR effective_to > ?)`)
      .bind(cutoffDate, seriesId, cutoffDate, cutoffDate),
    db.prepare(`DELETE FROM recurring_schedule_versions
      WHERE series_id = ? AND effective_to IS NULL AND effective_from >= ?`)
      .bind(seriesId, cutoffDate),
    db.prepare(`INSERT INTO schedule_history
      (actor_email, action, entity, entity_id, details)
      VALUES (?, 'end', 'recurring-series', ?, ?)`)
      .bind(actorEmail, seriesId, `Ended series from ${cutoffDate}`),
  ]);
}

export async function endRecurringTimetableFrom(db, cutoffDate, actorEmail) {
  await db.batch([
    db.prepare(`UPDATE recurring_schedule_series
      SET ended_from = CASE WHEN ended_from IS NULL OR ended_from > ? THEN ? ELSE ended_from END
      WHERE ended_from IS NULL OR ended_from > ?`)
      .bind(cutoffDate, cutoffDate, cutoffDate),
    db.prepare(`UPDATE recurring_schedule_versions SET effective_to = ?
      WHERE effective_from < ? AND (effective_to IS NULL OR effective_to > ?)`)
      .bind(cutoffDate, cutoffDate, cutoffDate),
    db.prepare(`DELETE FROM recurring_schedule_versions
      WHERE effective_to IS NULL AND effective_from >= ?`)
      .bind(cutoffDate),
    db.prepare(`INSERT INTO schedule_history
      (actor_email, action, entity, entity_id, details)
      VALUES (?, 'end', 'recurring-timetable', NULL, ?)`)
      .bind(actorEmail, `Ended all weekly series from ${cutoffDate}`),
  ]);
}

export async function setRecurringException(db, seriesId, date, action, override, createdBy) {
  if (action === 'cancelled') {
    return await db.prepare(`
      INSERT INTO recurring_schedule_exceptions
        (series_id, occurrence_date, moved_date, action, created_by)
      VALUES (?, ?, NULL, 'cancelled', ?)
      ON CONFLICT(series_id, occurrence_date) DO UPDATE SET
        action = 'cancelled', moved_date = NULL, program_id = NULL, employee_id = NULL,
        start_time = NULL, end_time = NULL, points = NULL, is_sudden = NULL,
        notes = NULL, created_by = excluded.created_by, created_at = CURRENT_TIMESTAMP
    `).bind(seriesId, date, createdBy).run();
  }
  return await db.prepare(`
    INSERT INTO recurring_schedule_exceptions
      (series_id, occurrence_date, moved_date, action, program_id, employee_id, start_time,
       end_time, points, is_sudden, notes, created_by)
    VALUES (?, ?, ?, 'modified', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(series_id, occurrence_date) DO UPDATE SET
      action = 'modified', moved_date = excluded.moved_date, program_id = excluded.program_id,
      employee_id = excluded.employee_id, start_time = excluded.start_time,
      end_time = excluded.end_time, points = excluded.points,
      is_sudden = excluded.is_sudden, notes = excluded.notes,
      created_by = excluded.created_by, created_at = CURRENT_TIMESTAMP
  `).bind(seriesId, date, override.movedDate || null, override.programId, override.employeeId,
    override.startTime, override.endTime, override.points,
    override.isSudden ? 1 : 0, override.notes, createdBy).run();
}

export async function clearRecurringException(db, seriesId, date) {
  return await db.prepare(`
    DELETE FROM recurring_schedule_exceptions
    WHERE series_id = ? AND occurrence_date = ?
  `).bind(seriesId, date).run();
}

export async function saveRecurringOccurrence(db, occurrence, status, occurrenceNotes) {
  return await db.prepare(`
    INSERT INTO schedule_sessions
      (session_date, program_id, employee_id, start_time, end_time, status,
       points, is_sudden, notes, occurrence_notes, created_by,
       recurring_series_id, recurrence_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)
    ON CONFLICT(recurring_series_id, recurrence_date) DO UPDATE SET
      status = excluded.status,
      occurrence_notes = COALESCE(excluded.occurrence_notes, schedule_sessions.occurrence_notes)
  `).bind(occurrence.session_date, occurrence.program_id, null,
    occurrence.start_time, occurrence.end_time, status, occurrence.points,
    occurrence.is_sudden ? 1 : 0, occurrenceNotes ?? null,
    occurrence.recurring_series_id, occurrence.recurrence_date || occurrence.session_date).run();
}

export async function createSession(db, s) {
  const result = await db.prepare(
    `INSERT INTO schedule_sessions
       (session_date, program_id, employee_id, start_time, end_time,
        status, points, is_sudden, notes, created_by)
     VALUES (?, ?, NULL, ?, ?, 'scheduled', ?, ?, ?, ?)`
  ).bind(s.sessionDate, s.programId, s.startTime || null,
         s.endTime || null, s.points, s.isSudden ? 1 : 0, s.notes || null,
         s.createdBy || null).run();
  const sessionId = result.meta.last_row_id;
  const employeeIds = [...new Set([...(s.employeeIds || []), s.employeeId]
    .filter(id => id != null).map(Number))];
  if (employeeIds.length) {
    await db.batch(employeeIds.map(employeeId => db.prepare(`
      INSERT INTO schedule_occurrence_assignments (session_id, employee_id, assigned_by)
      VALUES (?, ?, ?) ON CONFLICT DO NOTHING
    `).bind(sessionId, employeeId, s.createdBy || null)));
  }
  return result;
}

export async function updateSession(db, sessionId, s) {
  return await db.prepare(
    `UPDATE schedule_sessions
     SET session_date = ?, program_id = ?, start_time = ?, end_time = ?,
         points = ?, is_sudden = ?, notes = ?
     WHERE session_id = ?`
  ).bind(s.sessionDate, s.programId, s.startTime || null, s.endTime || null,
         s.points, s.isSudden ? 1 : 0, s.notes || null, sessionId).run();
}

export async function setOccurrenceAssignment(db, {
  sessionId = null, seriesId = null, occurrenceDate = null, employeeId, assigned, assignedBy,
}) {
  const statements = [];
  if (sessionId != null) {
    statements.push(db.prepare(`UPDATE schedule_sessions SET employee_id = NULL WHERE session_id = ?`)
      .bind(sessionId));
    statements.push(assigned
      ? db.prepare(`INSERT INTO schedule_occurrence_assignments (session_id, employee_id, assigned_by)
          VALUES (?, ?, ?) ON CONFLICT DO NOTHING`).bind(sessionId, employeeId, assignedBy)
      : db.prepare(`DELETE FROM schedule_occurrence_assignments
          WHERE session_id = ? AND employee_id = ?`).bind(sessionId, employeeId));
  } else {
    statements.push(assigned
      ? db.prepare(`INSERT INTO schedule_occurrence_assignments
          (recurring_series_id, occurrence_date, employee_id, assigned_by)
          VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`)
        .bind(seriesId, occurrenceDate, employeeId, assignedBy)
      : db.prepare(`DELETE FROM schedule_occurrence_assignments
          WHERE recurring_series_id = ? AND occurrence_date = ? AND employee_id = ?`)
        .bind(seriesId, occurrenceDate, employeeId));
  }
  await db.batch(statements);
}

export async function setSessionStatus(db, sessionId, status) {
  return await db.prepare(
    `UPDATE schedule_sessions SET status = ? WHERE session_id = ?`
  ).bind(status, sessionId).run();
}

export async function deleteSession(db, sessionId) {
  return await db.prepare(
    `DELETE FROM schedule_sessions WHERE session_id = ?`
  ).bind(sessionId).run();
}

export async function logScheduleHistory(db, actorEmail, action, entity, entityId, details) {
  return await db.prepare(
    `INSERT INTO schedule_history (actor_email, action, entity, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(actorEmail, action, entity, entityId ?? null, details).run();
}

export async function getMonthlySummary(db, year, month, employeeId = null) {
  const { start, end } = monthlyDateRange(year, month);
  const sql = `
    SELECT e.employee_id, e.first_name, e.last_name, e.email,
           mt.target_points AS target_points,
           CASE WHEN mt.employee_id IS NULL THEN 0 ELSE 1 END AS target_is_override,
           s.session_id, s.session_date, s.status, s.points
    FROM employees e
    LEFT JOIN schedule_sessions s
      ON s.session_date >= ? AND s.session_date <= ? AND s.recurring_series_id IS NULL
     AND (s.employee_id = e.employee_id OR EXISTS (
       SELECT 1 FROM schedule_occurrence_assignments oa
       WHERE oa.session_id = s.session_id AND oa.employee_id = e.employee_id
     ))
    LEFT JOIN monthly_targets mt
      ON mt.employee_id = e.employee_id AND mt.year = ? AND mt.month = ?
    WHERE 1 = 1
      ${employeeId ? 'AND e.employee_id = ?' : ''}
    ORDER BY e.first_name, e.last_name, s.session_date`;
  const params = employeeId
    ? [start, end, year, month, employeeId]
    : [start, end, year, month];
  const { results } = await db.prepare(sql).bind(...params).all();
  const occurrences = (await getScheduleBetween(db, start, end, employeeId))
    .filter(row => row.is_recurring);
  const targetRows = new Map();
  for (const row of results) {
    if (!targetRows.has(row.employee_id)) targetRows.set(row.employee_id, row);
  }
  const occurrenceRows = occurrences.flatMap(row => row.assignees.map(person => {
    const target = targetRows.get(person.employee_id);
    return {
      ...row,
      employee_id: person.employee_id,
      first_name: person.first_name,
      last_name: person.last_name,
      email: person.email,
      target_points: target?.target_points ?? null,
      target_is_override: target?.target_is_override ?? 0,
    };
  }));
  return aggregateMonthlyRows([...results, ...occurrenceRows]);
}

export async function setMonthlyTarget(db, employeeId, year, month, targetPoints) {
  return await db.prepare(
    `INSERT INTO monthly_targets (employee_id, year, month, target_points)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (employee_id, year, month)
     DO UPDATE SET target_points = excluded.target_points`
  ).bind(employeeId, year, month, targetPoints).run();
}
export async function clearMonthlyTarget(db, employeeId, year, month) {
  return await db.prepare(
    `DELETE FROM monthly_targets
     WHERE employee_id = ? AND year = ? AND month = ?`
  ).bind(employeeId, year, month).run();
}
