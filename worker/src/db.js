// All queries use parameter binding — never string concatenation
export async function getEmployeeAuth(db, employeeId) {
  return await db.prepare(`
    SELECT employee_id, email, is_active, is_admin
    FROM employees
    WHERE employee_id = ?
    LIMIT 1
  `).bind(employeeId).first();
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
    : new Date().toISOString().slice(0, 10);
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

export async function getActiveEmployees(db) {
  const { results } = await db.prepare(
    `SELECT employee_id, first_name, last_name, email, department
     FROM employees WHERE is_active = 1 ORDER BY first_name, last_name`
  ).all();
  return results;
}

// LEFT JOIN so sessions without a person yet still appear (Plan board)
const SESSION_SELECT = `
  SELECT s.session_id, s.session_date, s.start_time, s.end_time, s.status,
         s.points, s.is_sudden, s.notes, s.employee_id,
         p.code AS program_code, p.name AS program_name, p.category,
         e.first_name, e.last_name, e.email AS employee_email
  FROM schedule_sessions s
  JOIN programs p ON p.program_id = s.program_id
  LEFT JOIN employees e ON e.employee_id = s.employee_id`;

export async function getSessionsBetween(db, startDate, endDate, employeeId = null) {
  const sql = SESSION_SELECT + `
    WHERE s.session_date >= ? AND s.session_date <= ?
    ${employeeId ? 'AND s.employee_id = ?' : ''}
    ORDER BY s.session_date, s.start_time, s.session_id`;
  const stmt = db.prepare(sql);
  const { results } = employeeId
    ? await stmt.bind(startDate, endDate, employeeId).all()
    : await stmt.bind(startDate, endDate).all();
  return results;
}

export async function getSessionById(db, sessionId) {
  return await db.prepare(
    SESSION_SELECT + ` WHERE s.session_id = ? LIMIT 1`
  ).bind(sessionId).first();
}

export async function createSession(db, s) {
  return await db.prepare(
    `INSERT INTO schedule_sessions
       (session_date, program_id, employee_id, start_time, end_time,
        status, points, is_sudden, notes, created_by)
     VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?)`
  ).bind(s.sessionDate, s.programId, s.employeeId, s.startTime || null,
         s.endTime || null, s.points, s.isSudden ? 1 : 0, s.notes || null,
         s.createdBy || null).run();
}

export async function reassignSession(db, sessionId, employeeId) {
  return await db.prepare(
    `UPDATE schedule_sessions SET employee_id = ? WHERE session_id = ?`
  ).bind(employeeId, sessionId).run();
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
  const mm = String(month).padStart(2, '0');
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-31`; // safe upper bound for SQLite date strings
  const sql = `
    SELECT e.employee_id, e.first_name, e.last_name, e.email,
           COUNT(s.session_id) AS total_sessions,
           COALESCE(SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_sessions,
           COALESCE(SUM(CASE WHEN s.status = 'scheduled' THEN 1 ELSE 0 END), 0) AS scheduled_sessions,
           COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.points ELSE 0 END), 0) AS completed_points,
           COALESCE(SUM(CASE WHEN s.status != 'cancelled' THEN s.points ELSE 0 END), 0) AS potential_points,
           COALESCE(mt.target_points, 0) AS target_points
    FROM employees e
    LEFT JOIN schedule_sessions s
      ON s.employee_id = e.employee_id AND s.session_date >= ? AND s.session_date <= ?
    LEFT JOIN monthly_targets mt
      ON mt.employee_id = e.employee_id AND mt.year = ? AND mt.month = ?
    WHERE e.is_active = 1 ${employeeId ? 'AND e.employee_id = ?' : ''}
    GROUP BY e.employee_id
    ORDER BY e.first_name, e.last_name`;
  const params = employeeId
    ? [start, end, year, month, employeeId]
    : [start, end, year, month];
  const { results } = await db.prepare(sql).bind(...params).all();
  return results;
}

export async function setMonthlyTarget(db, employeeId, year, month, targetPoints) {
  return await db.prepare(
    `INSERT INTO monthly_targets (employee_id, year, month, target_points)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (employee_id, year, month)
     DO UPDATE SET target_points = excluded.target_points`
  ).bind(employeeId, year, month, targetPoints).run();
}