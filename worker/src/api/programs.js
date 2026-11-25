import {
  logScheduleHistory, getAllPrograms, getProgramById, getProgramByCode, createProgram, updateProgram, deactivateProgram, reactivateProgram, hardDeleteProgram, countProgramReferences
} from '../db.js';
import { requireAdmin } from './authorization.js';
import { TIME_RE } from './schedule-validation.js';

/**
 * @api {get} /api/admin/programs List all task types
 * @apiName AdminListPrograms
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted administrator session cookie.
 * @apiSuccess {Object[]} programs All task types, including deleted ones.
 * @apiError 403 Administrator access required.
 */
export async function handleAdminListPrograms(env, session) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const programs = await getAllPrograms(env.DB);
  return Response.json({ programs });
}

/**
 * @api {post} /api/admin/programs Create a task type
 * @apiName AdminCreateProgram
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {String} code Unique task code, up to 16 characters.
 * @apiBody {String} name Task name, up to 120 characters.
 * @apiBody {String} [category=general] Category, up to 32 characters.
 * @apiBody {Number} [defaultPoints=1] Default points from 0 to 100.
 * @apiBody {String} [defaultStart] Default start time in HH:MM format.
 * @apiBody {String} [defaultEnd] Default end time in HH:MM format.
 * @apiSuccess {Object} program Created task type.
 * @apiError 400 Invalid task type.
 * @apiError 403 Admin access required.
 * @apiError 409 Task code already exists.
 */
export async function handleAdminCreateProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid task type', { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' && body.category.trim()
    ? body.category.trim()
    : 'general';
  const defaultPoints = Number(body.defaultPoints ?? 1);
  const defaultStart = body.defaultStart || null;
  const defaultEnd = body.defaultEnd || null;
  const validTime = value => value === null ||
    (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) &&
      Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59);

  if (!code || code.length > 16 || !name || name.length > 120 ||
      category.length > 32 || !Number.isFinite(defaultPoints) ||
      defaultPoints < 0 || defaultPoints > 100 ||
      !validTime(defaultStart) || !validTime(defaultEnd) ||
      (defaultStart && defaultEnd && defaultStart === defaultEnd)) {
    return new Response('Invalid task type', { status: 400 });
  }
  if (await getProgramByCode(env.DB, code)) {
    return new Response('Task code already exists', { status: 409 });
  }

  const result = await createProgram(env.DB, {
    code, name, category, defaultPoints, defaultStart, defaultEnd,
  });
  const program = await getProgramById(env.DB, result.meta.last_row_id);
  await logScheduleHistory(
    env.DB, session.email, 'create', 'programme', result.meta.last_row_id,
    `Created programme "${name}" (${code})`
  );
  return Response.json({ program }, { status: 201 });
}

export async function handleAdminUpdateProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const programId = Number(body?.programId);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const defaultPoints = Number(body?.defaultPoints);
  const defaultStart = body?.defaultStart || null;
  const defaultEnd = body?.defaultEnd || null;
  const validTime = value => value === null ||
    (typeof value === 'string' && TIME_RE.test(value) &&
      Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59);
  if (!Number.isSafeInteger(programId) || programId < 1 ||
      !name || name.length > 120 || !Number.isFinite(defaultPoints) ||
      defaultPoints < 0 || defaultPoints > 100 ||
      !validTime(defaultStart) || !validTime(defaultEnd) ||
      (defaultStart && defaultEnd && defaultStart === defaultEnd)) {
    return new Response('Invalid programme defaults', { status: 400 });
  }
  const before = await getProgramById(env.DB, programId);
  if (!before) return new Response('Programme not found', { status: 404 });
  await updateProgram(env.DB, programId, { name, defaultPoints, defaultStart, defaultEnd });
  const program = await getProgramById(env.DB, programId);
  await logScheduleHistory(
    env.DB, session.email, 'update', 'programme', programId,
    `Updated programme defaults for "${before.name}" (${before.code})`
  );
  return Response.json({ program });
}


/**
 * @api {post} /api/admin/programs/delete Delete a task type
 * @apiName AdminDeleteProgram
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} programId Task type identifier.
 * @apiSuccess {Boolean} success Whether the task type was deleted or hidden.
 * @apiError 400 Invalid task type identifier.
 * @apiError 403 Admin access required.
 * @apiError 404 Task type not found.
 */
export async function handleAdminDeleteProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid task type identifier', { status: 400 });
  }

  const programId = Number(body.programId);
  if (!Number.isSafeInteger(programId) || programId < 1) {
    return new Response('Invalid task type identifier', { status: 400 });
  }
  const program = await getProgramById(env.DB, programId);
  if (!program) {
    return new Response('Task type not found', { status: 404 });
  }

  const hasReferences = await countProgramReferences(env.DB, programId);
  if (hasReferences) {
    await deactivateProgram(env.DB, programId);
  } else {
    await hardDeleteProgram(env.DB, programId);
  }
  await logScheduleHistory(
    env.DB, session.email, 'delete', 'programme', programId,
    `Deleted programme "${program.name}" (${program.code}); ` +
    (hasReferences
      ? 'hidden; existing schedule records retained'
      : 'removed; no schedule records referenced it')
  );
  return Response.json({ success: true });
}

/**
 * @api {post} /api/admin/programs/reactivate Restore a hidden programme
 * @apiName AdminReactivateProgram
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} programId Programme identifier.
 * @apiSuccess {Boolean} success Whether the programme was reactivated.
 * @apiError 400 Invalid programme identifier.
 * @apiError 403 Admin access required.
 * @apiError 404 Programme not found.
 */
export async function handleAdminReactivateProgram(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid programme identifier', { status: 400 });
  }

  const programId = Number(body.programId);
  if (!Number.isSafeInteger(programId) || programId < 1) {
    return new Response('Invalid programme identifier', { status: 400 });
  }
  const program = await getProgramById(env.DB, programId);
  if (!program) return new Response('Programme not found', { status: 404 });
  if (Number(program.is_active) !== 0) {
    return Response.json({ success: true, alreadyActive: true });
  }

  await reactivateProgram(env.DB, programId);
  await logScheduleHistory(
    env.DB, session.email, 'reactivate', 'programme', programId,
    `Reactivated programme "${program.name}" (${program.code})`
  );
  return Response.json({ success: true });
}

