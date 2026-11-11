import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAdminSetTarget } from '../src/api.js';
import { clearMonthlyTarget, getMonthlySummary } from '../src/db.js';
import {
  aggregateMonthlyRows, DEFAULT_MONTHLY_TARGET_POINTS, monthlyDateRange,
} from '../src/monthly-summary.js';

function session(sessionId, sessionDate, status, points) {
  return {
    employee_id: 7,
    first_name: 'Test',
    last_name: 'Employee',
    email: 'test@example.com',
    target_points: 20,
    target_is_override: 1,
    session_id: sessionId,
    session_date: sessionDate,
    status,
    points,
  };
}

test('monthlyDateRange returns the exact last day for leap and short months', () => {
  assert.deepEqual(monthlyDateRange(2024, 2), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(monthlyDateRange(2026, 4), { start: '2026-04-01', end: '2026-04-30' });
  assert.throws(() => monthlyDateRange(2026, 13), RangeError);
});

test('aggregateMonthlyRows assigns completed points and counts to 10-day intervals', () => {
  const rows = [
    session(1, '2026-01-01', 'completed', 1),
    session(2, '2026-01-10', 'completed', 2),
    session(3, '2026-01-11', 'completed', 3),
    session(4, '2026-01-20', 'completed', 4),
    session(5, '2026-01-21', 'completed', 5),
    session(6, '2026-01-31', 'completed', 6),
    session(7, '2026-01-15', 'scheduled', 100),
    session(8, '2026-01-25', 'cancelled', 100),
  ];
  const [summary] = aggregateMonthlyRows(rows);

  assert.equal(summary.days_1_10_points, 3);
  assert.equal(summary.days_1_10_completed_sessions, 2);
  assert.equal(summary.days_11_20_points, 7);
  assert.equal(summary.days_11_20_completed_sessions, 2);
  assert.equal(summary.days_21_end_points, 11);
  assert.equal(summary.days_21_end_completed_sessions, 2);
  assert.equal(summary.completed_points, 21);
  assert.equal(summary.completed_sessions, 6);
  assert.equal(summary.total_sessions, 8);
  assert.equal(summary.scheduled_sessions, 1);
  assert.equal(summary.potential_points, 121);
  assert.equal(summary.goal_variance, 1);
  assert.equal(summary.points_above_goal, 1);
});

test('aggregateMonthlyRows applies the shared default when there is no override', () => {
  const [summary] = aggregateMonthlyRows([{
    employee_id: 9,
    first_name: 'No',
    last_name: 'Tasks',
    email: 'no-tasks@example.com',
    target_points: null,
    target_is_override: 0,
    session_id: null,
    session_date: null,
    status: null,
    points: null,
  }]);

  assert.equal(DEFAULT_MONTHLY_TARGET_POINTS, 170);
  assert.equal(summary.total_sessions, 0);
  assert.equal(summary.completed_points, 0);
  assert.equal(summary.completed_sessions, 0);
  assert.equal(summary.target_points, 170);
  assert.equal(summary.target_set, true);
  assert.equal(summary.target_is_override, false);
  assert.equal(summary.goal_variance, -170);
  assert.equal(summary.points_above_goal, 0);
});

test('aggregateMonthlyRows reports negative variance and zero excess below goal', () => {
  const [summary] = aggregateMonthlyRows([
    { ...session(1, '2026-02-28', 'completed', 5), target_points: 10 },
  ]);

  assert.equal(summary.completed_points, 5);
  assert.equal(summary.goal_variance, -5);
  assert.equal(summary.points_above_goal, 0);
});

test('admin can reset a monthly override to the shared default', async () => {
  const statements = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            statements.push({ sql, values });
            return { run: async () => ({ success: true }) };
          },
        };
      },
    },
  };
  const response = await handleAdminSetTarget(
    env,
    { isAdmin: true, email: 'admin@example.com' },
    { employeeId: 7, year: 2026, month: 11, useDefault: true },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, usingDefault: true });
  assert.match(statements[0].sql, /DELETE FROM monthly_targets/);
  assert.deepEqual(statements[0].values, [7, 2026, 11]);
});

test('monthly goal changes remain admin-only', async () => {
  let queryCount = 0;
  const response = await handleAdminSetTarget(
    { DB: { prepare() { queryCount++; } } },
    { isAdmin: false, email: 'employee@example.com' },
    { employeeId: 7, year: 2026, month: 11, useDefault: true },
  );

  assert.equal(response.status, 403);
  assert.equal(queryCount, 0);
});

test('clearMonthlyTarget deletes only the selected employee month override', async () => {
  let sql;
  let bindings;
  const db = {
    prepare(statement) {
      sql = statement;
      return {
        bind(...values) {
          bindings = values;
          return { run: async () => ({ success: true }) };
        },
      };
    },
  };

  await clearMonthlyTarget(db, 7, 2026, 11);
  assert.match(sql, /WHERE employee_id = \? AND year = \? AND month = \?/);
  assert.deepEqual(bindings, [7, 2026, 11]);
});

test('getMonthlySummary binds exact dates and employee scope', async () => {
  let sql;
  let bindings;
  const db = {
    prepare(statement) {
      sql = statement;
      return {
        bind(...values) {
          bindings = values;
          return { all: async () => ({ results: [session(1, '2024-02-29', 'completed', 2.5)] }) };
        },
      };
    },
  };

  const [summary] = await getMonthlySummary(db, 2024, 2, 7);
  assert.deepEqual(bindings, ['2024-02-01', '2024-02-29', 2024, 2, 7]);
  assert.match(sql, /AND e\.employee_id = \?/);
  assert.equal(summary.days_21_end_points, 2.5);
});
