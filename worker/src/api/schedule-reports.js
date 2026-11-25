import {
  logScheduleHistory, getMonthlySummary, getMonthlySessions, setMonthlyTarget, clearMonthlyTarget, getManagedEmployee
} from '../db.js';
import { requireAdmin } from './authorization.js';
import { vietnamDateParts } from '../date.js';

/**
 * @api {get} /api/admin/schedule/monthly Get monthly schedule summary
 * @apiName AdminMonthlySummary
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiQuery {Number} [year] Vietnam summary year; defaults to the current year.
 * @apiQuery {Number} [month] Summary month from 1 to 12; defaults to the current month.
 * @apiSuccess {Number} year Summary year.
 * @apiSuccess {Number} month Summary month.
 * @apiSuccess {Object[]} rows Employee summary rows with completed and estimated points and task counts
 *   for days 1–10, 11–20, and 21–month-end, monthly totals, shared default/override target,
 *   target_is_override, variance, and points above goal.
 * @apiError 400 Invalid year or month.
 * @apiDescription Read-only report available to all active employees.
 */
export async function handleAdminMonthlySummary(env, session, url) {
  const today = vietnamDateParts();
  const year = parseInt(url.searchParams.get('year'), 10) || today.year;
  const month = parseInt(url.searchParams.get('month'), 10) || today.month;
  if (!Number.isInteger(year) || year < 1 || year > 9999 || month < 1 || month > 12) {
    return new Response('Invalid year or month', { status: 400 });
  }
  const rows = await getMonthlySummary(env.DB, year, month);
  return Response.json({ year, month, rows });
}

export async function handleAdminQuarterlySummary(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const year = Number(url.searchParams.get('year'));
  const quarter = Number(url.searchParams.get('quarter'));
  const employeeId = Number(url.searchParams.get('employeeId'));
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(quarter) || quarter < 1 || quarter > 4 ||
      !Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid quarterly report selection', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  const firstMonth = (quarter - 1) * 3 + 1;
  const monthlyRows = await Promise.all([0, 1, 2].map(async offset => {
    const month = firstMonth + offset;
    const [row] = await getMonthlySummary(env.DB, year, month, employeeId);
    return {
      month,
      completed_points: Number(row?.completed_points) || 0,
      target_points: Number(row?.target_points) || 0,
      completed_sessions: Number(row?.completed_sessions) || 0,
    };
  }));
  const totals = monthlyRows.reduce((result, month) => ({
    completed_points: result.completed_points + month.completed_points,
    target_points: result.target_points + month.target_points,
    completed_sessions: result.completed_sessions + month.completed_sessions,
  }), { completed_points: 0, target_points: 0, completed_sessions: 0 });
  return Response.json({
    year, quarter, employee,
    months: monthlyRows,
    totals: {
      ...totals,
      goal_variance: totals.completed_points - totals.target_points,
    },
  });
}

export async function handleAdminMonthlySessions(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const year = Number(url.searchParams.get('year'));
  const month = Number(url.searchParams.get('month'));
  const employeeId = Number(url.searchParams.get('employeeId'));
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid monthly session selection', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  const sessions = await getMonthlySessions(env.DB, year, month, employeeId);
  return Response.json({ year, month, employee, sessions });
}

/**
 * @api {post} /api/admin/schedule/target Set monthly points target
 * @apiName AdminSetTarget
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} employeeId Employee identifier.
 * @apiBody {Number} year Target year.
 * @apiBody {Number} month Target month from 1 to 12.
 * @apiBody {Number} [targetPoints] Override points from 0 to 10000.
 * @apiBody {Boolean} [useDefault=false] Remove the person's monthly override and use the shared goal.
 * @apiSuccess {Boolean} success Always true when saved.
 * @apiError 400 Invalid target payload or points.
 * @apiError 403 Admin access required.
 */
export async function handleAdminSetTarget(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { employeeId, year, month, targetPoints, useDefault = false } = body;
  if (!Number.isInteger(employeeId) || !Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12 || typeof useDefault !== 'boolean') {
    return new Response('Invalid target payload', { status: 400 });
  }

  let details;
  if (useDefault) {
    await clearMonthlyTarget(env.DB, employeeId, year, month);
    details = `Monthly target for ${year}-${String(month).padStart(2, '0')} reset to shared default`;
  } else {
    const pts = Number(targetPoints);
    if (!Number.isFinite(pts) || pts < 0 || pts > 10000) {
      return new Response('Invalid target points', { status: 400 });
    }
    await setMonthlyTarget(env.DB, employeeId, year, month, pts);
    details = `Monthly target for ${year}-${String(month).padStart(2, '0')} set to ${pts} points`;
  }

  await logScheduleHistory(env.DB, session.email, 'target', 'employee', employeeId, details);
  return Response.json({ success: true, usingDefault: useDefault });
}
