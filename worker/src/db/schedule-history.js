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
export async function logScheduleHistory(db, actorEmail, action, entity, entityId, details) {
  return await db.prepare(
    `INSERT INTO schedule_history (actor_email, action, entity, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(actorEmail, action, entity, entityId ?? null, details).run();
}
