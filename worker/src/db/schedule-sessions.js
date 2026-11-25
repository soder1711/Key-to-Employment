import { logScheduleHistory } from './schedule-history.js';

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
