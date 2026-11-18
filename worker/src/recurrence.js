function shiftDate(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function occurrenceKey(seriesId, date) {
  return `${seriesId}:${date}`;
}

export function expandRecurringOccurrences(
  versions, startDate, endDate, exceptions = [], sessions = [],
  { includeMovedOutsideRange = false } = {},
) {
  const exceptionByDate = new Map(exceptions.map(exception => [
    occurrenceKey(exception.series_id, exception.occurrence_date), exception,
  ]));
  const sessionByDate = new Map(sessions.map(session => [
    occurrenceKey(session.recurring_series_id, session.recurrence_date), session,
  ]));
  const candidateDates = new Set();
  for (let date = startDate; date <= endDate; date = shiftDate(date, 1)) candidateDates.add(date);
  for (const exception of exceptions) {
    if (exception.moved_date && exception.moved_date >= startDate && exception.moved_date <= endDate) {
      candidateDates.add(exception.occurrence_date);
    }
  }
  const occurrences = new Map();

  for (const date of candidateDates) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const version of versions) {
      if (Number(version.weekday) !== weekday || date < version.start_date ||
          (version.end_date && date > version.end_date) || date < version.effective_from ||
          (version.effective_to && date >= version.effective_to) ||
          (version.ended_from && date >= version.ended_from)) continue;

      const key = occurrenceKey(version.series_id, date);
      const exception = exceptionByDate.get(key);
      const actual = sessionByDate.get(key);
      const movedDate = exception?.action === 'modified' ? exception.moved_date : null;
      if (movedDate && (actual?.status === 'completed' ||
          movedDate < startDate || movedDate > endDate)) {
        if (!includeMovedOutsideRange &&
            (actual?.status !== 'completed' || date < startDate || date > endDate)) continue;
      }
      const displayDate = actual?.status === 'completed' ? date : (movedDate || date);
      const overridden = exception?.action === 'modified' ? exception : null;
      const plan = {
        ...version,
        ...(overridden || {}),
        session_id: `recurring:${version.series_id}:${date}`,
        session_date: displayDate,
        recurrence_date: date,
        recurring_series_id: version.series_id,
        status: exception?.action === 'cancelled' ? 'cancelled' : 'scheduled',
        is_recurring: true,
        is_projected: true,
        is_modified: !!overridden,
        occurrence_notes: null,
      };
      if (actual) {
        Object.assign(plan, actual.status === 'completed' ? actual : {}, {
          session_id: actual.session_id,
          is_recurring: true,
          is_projected: false,
          status: actual.status,
          is_modified: !!overridden,
          session_date: displayDate,
          recurring_series_id: version.series_id,
          recurrence_date: date,
          occurrence_notes: actual.occurrence_notes ?? null,
        });
      }
      occurrences.set(key, plan);
    }
  }

  for (const exception of exceptions) {
    if (!['modified', 'cancelled'].includes(exception.action)) continue;
    const key = occurrenceKey(exception.series_id, exception.occurrence_date);
    if (occurrences.has(key)) continue;
    const actual = sessionByDate.get(key);
    if (actual?.status === 'completed') continue;
    const displayDate = exception.action === 'modified'
      ? (exception.moved_date || exception.occurrence_date)
      : exception.occurrence_date;
    if ((!includeMovedOutsideRange && (displayDate < startDate || displayDate > endDate)) ||
        (exception.series_ended_from && exception.occurrence_date >= exception.series_ended_from)) continue;
    const baseVersion = versions.find(version => version.series_id === exception.series_id &&
      version.effective_from <= exception.occurrence_date &&
      (!version.effective_to || version.effective_to > exception.occurrence_date));
    occurrences.set(key, {
      ...(baseVersion || {}),
      ...(exception.action === 'modified' ? exception : {}),
      session_id: `recurring:${exception.series_id}:${exception.occurrence_date}`,
      session_date: displayDate,
      recurring_series_id: exception.series_id,
      recurrence_date: exception.occurrence_date,
      status: exception.action === 'cancelled' ? 'cancelled' : 'scheduled',
      is_recurring: true,
      is_projected: true,
      is_modified: true,
      occurrence_notes: null,
      ...(actual ? {
        ...(actual.status === 'completed' ? actual : {}),
        session_id: actual.session_id,
        status: actual.status,
        session_date: displayDate,
        recurring_series_id: exception.series_id,
        recurrence_date: exception.occurrence_date,
        is_recurring: true,
        is_projected: false,
        is_modified: true,
        occurrence_notes: actual.occurrence_notes ?? null,
      } : {}),
    });
  }

  return [...occurrences.values()].sort((a, b) =>
    a.session_date.localeCompare(b.session_date) ||
    String(a.start_time || '').localeCompare(String(b.start_time || '')) ||
    Number(a.recurring_series_id) - Number(b.recurring_series_id));
}
