import {
  weekStartFrom, weekDates, getPrograms, getActiveEmployees, getScheduleBetween, getMonthlySummary, getRecurringTimetable
} from '../db.js';
import { monthlyDateRange } from '../monthly-summary.js';

export async function handleGetMySchedule(env, session, url) {
  const start = weekStartFrom(url.searchParams.get('start'));
  const dates = weekDates(start);
  const sessions = await getScheduleBetween(env.DB, dates[0], dates[6], session.employeeId);

  // Explicit ?year=&month= wins; otherwise use the month of the week's Thursday
  let year = parseInt(url.searchParams.get('year'), 10);
  let month = parseInt(url.searchParams.get('month'), 10);
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    const mid = new Date(dates[3] + 'T00:00:00Z');
    year = mid.getUTCFullYear();
    month = mid.getUTCMonth() + 1;
  }
  const monthRange = monthlyDateRange(year, month);
  const rows = await getMonthlySummary(env.DB, year, month, session.employeeId);

  return Response.json({
    weekStart: start, dates, sessions,
    summary: rows[0] || null,
    summaryMonth: { year, month },
  });
}

/**
 * @api {get} /api/admin/schedule Get all-staff weekly schedule
 * @apiName AdminGetSchedule
 * @apiGroup AdminSchedule
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiQuery {String} [start] Any date in the requested week; normalized to Monday.
 * @apiSuccess {String} weekStart Monday for the requested week.
 * @apiSuccess {String[]} dates Seven dates in the week.
 * @apiSuccess {Object[]} sessions All occurrences in the week, including unassigned ones.
 * @apiSuccess {Object[]} employees Active employees.
 * @apiSuccess {Object[]} programs Available programs.
 * @apiDescription Read-only workforce schedule available to all active employees.
 */
export async function handleAdminGetSchedule(env, session, url) {
  const start = weekStartFrom(url.searchParams.get('start'));
  const dates = weekDates(start);
  const [sessions, employees, programs, timetable] = await Promise.all([
    getScheduleBetween(env.DB, dates[0], dates[6]),
    getActiveEmployees(env.DB),
    getPrograms(env.DB),
    getRecurringTimetable(env.DB),
  ]);
  return Response.json({
    weekStart: start, dates, sessions, employees, programs,
    weeklyTimetableEnabled: timetable.length > 0,
  });
}

