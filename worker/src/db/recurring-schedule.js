import { vietnamDateISO } from '../date.js';

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
  if (cutoffDate < vietnamDateISO()) {
    statements.push(db.prepare(`
      INSERT INTO schedule_history (actor_email, action, entity, entity_id, details)
      SELECT ?, 'update', 'recurring-occurrence', ?,
        'Updated completed occurrence ' || recurrence_date ||
        ': credited points ' || printf('%.1f', points) || ' -> ' ||
        printf('%.1f', ?) || '; ' || ?
      FROM schedule_sessions
      WHERE recurring_series_id = ? AND recurrence_date >= ?
        AND status = 'completed' AND points <> ?
    `).bind(actorEmail, seriesId, version.points,
      correctionReason ? `reason: ${correctionReason}` : 'reason not provided',
      seriesId, cutoffDate, version.points));
    statements.push(db.prepare(`
      UPDATE schedule_sessions
      SET points = ?, updated_at = CURRENT_TIMESTAMP
      WHERE recurring_series_id = ? AND recurrence_date >= ?
        AND status = 'completed' AND points <> ?
    `).bind(version.points, seriesId, cutoffDate, version.points));
  }
  statements.push(db.prepare(
    `INSERT INTO schedule_history (actor_email, action, entity, entity_id, details)
     VALUES (?, 'update', 'recurring-series', ?, ?)`
  ).bind(actorEmail, seriesId,
    `Updated series from ${cutoffDate}; ` +
    `points ${Number(currentVersion.points).toFixed(1)} -> ${Number(version.points).toFixed(1)}; ` +
    `${correctionReason ? `reason: ${correctionReason}; ` : 'reason not provided; '}` +
    `${cutoffDate < vietnamDateISO() ? 'completed credits updated; ' : ''}` +
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
