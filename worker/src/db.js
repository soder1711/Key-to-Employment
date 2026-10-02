// All queries use parameter binding — never string concatenation
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