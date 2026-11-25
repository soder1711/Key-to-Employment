import { aggregateMonthlyRows, monthlyDateRange } from '../monthly-summary.js';
import { getScheduleBetween } from './schedule-queries.js';

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
