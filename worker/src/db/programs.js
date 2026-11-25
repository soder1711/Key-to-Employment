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
