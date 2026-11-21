import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';
import {
  handleAdminMonthlySummary,
  handleAdminCreateEmployee,
  handleAdminDeactivateEmployee,
  handleGetScheduleHistory,
  handleUpdateProgress,
} from '../src/api.js';
import { createSession } from '../src/session.js';
import { vietnamDateISO, vietnamDateParts } from '../src/date.js';

test('Vietnam calendar helpers follow UTC+7 across midnight', () => {
  const instant = new Date('2026-11-21T18:00:00.000Z');
  assert.deepEqual(vietnamDateParts(instant), { year: 2026, month: 11, day: 22 });
  assert.equal(vietnamDateISO(instant), '2026-11-22');
});

test('non-admin users cannot update task progress', async () => {
  let queryCount = 0;
  const response = await handleUpdateProgress(
    { DB: { prepare() { queryCount++; throw new Error('must not query'); } } },
    { isAdmin: false, employeeId: 7 },
    { assignmentId: 1, percentage: 50 },
  );
  assert.equal(response.status, 403);
  assert.equal(queryCount, 0);
});

test('Worker rechecks the staff record and blocks viewer writes', async () => {
  const secret = 'test-session-secret';
  const cookie = await createSession({ employeeId: 7, isAdmin: true }, secret);
  const queries = [];
  const env = {
    FRONTEND_URL: 'https://frontend.example',
    SESSION_SECRET: secret,
    DB: {
      prepare(sql) {
        queries.push(sql);
        return { bind: () => ({ first: async () => ({
          employee_id: 7, email: 'viewer@example.com', is_active: 1, is_admin: 0,
        }) }) };
      },
    },
  };
  const response = await worker.fetch(new Request('https://worker.example/api/progress', {
    method: 'POST',
    headers: { Cookie: `session=${cookie}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignmentId: 1, percentage: 50 }),
  }), env);

  assert.equal(response.status, 403);
  assert.equal(queries.length, 1);
});

test('active viewers can read workforce monthly reports and history', async () => {
  const secret = 'test-session-secret';
  const cookie = await createSession({ employeeId: 7, isAdmin: false }, secret);
  const env = {
    FRONTEND_URL: 'https://frontend.example',
    SESSION_SECRET: secret,
    DB: {
      prepare: sql => ({
        bind: () => sql.includes('FROM employees')
          ? {
              first: async () => ({
                employee_id: 7, email: 'viewer@example.com', is_active: 1, is_admin: 0,
              }),
              all: async () => ({ results: [] }),
            }
          : { all: async () => ({ results: [] }) },
      }),
    },
  };
  const monthly = await handleAdminMonthlySummary(
    env, { isAdmin: false }, new URL('https://worker.example/api/schedule/monthly?year=2026&month=11'),
  );
  assert.equal(monthly.status, 200);

  const history = await worker.fetch(new Request('https://worker.example/api/schedule/history', {
    headers: { Cookie: `session=${cookie}` },
  }), env);
  assert.equal(history.status, 200);
});

test('inactive employees are rejected even with an unexpired session', async () => {
  const secret = 'test-session-secret';
  const cookie = await createSession({ employeeId: 7, isAdmin: false }, secret);
  const env = {
    FRONTEND_URL: 'https://frontend.example',
    SESSION_SECRET: secret,
    DB: {
      prepare: () => ({
        bind: () => ({ first: async () => ({
          employee_id: 7, email: 'viewer@example.com', is_active: 0, is_admin: 0,
        }) }),
      }),
    },
  };
  const response = await worker.fetch(new Request('https://worker.example/api/me', {
    headers: { Cookie: `session=${cookie}` },
  }), env);
  assert.equal(response.status, 401);
});

test('new employees are created as non-admin and logged', async () => {
  const statements = [];
  const employee = {
    employee_id: 42, employee_code: 'KTE-42', first_name: 'Mai',
    last_name: 'Nguyen', email: 'mai@example.com', is_active: 1, is_admin: 0,
  };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            statements.push({ sql, values });
            if (sql.includes('WHERE employee_code = ? OR email = ?')) {
              return { first: async () => null };
            }
            if (sql.includes('INSERT INTO employees')) {
              return { run: async () => ({ meta: { last_row_id: 42 } }) };
            }
            if (sql.includes('WHERE employee_id = ?')) {
              return { first: async () => employee };
            }
            return { run: async () => ({ meta: { changes: 1 } }) };
          },
        };
      },
    },
  };
  const response = await handleAdminCreateEmployee(env, {
    isAdmin: true, email: 'admin@example.com',
  }, {
    employeeCode: 'KTE-42', firstName: 'Mai', lastName: 'Nguyen', email: ' MAI@EXAMPLE.COM ',
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).employee.is_admin, 0);
  const insert = statements.find(item => item.sql.includes('INSERT INTO employees'));
  assert.match(insert.sql, /VALUES \(\?, \?, \?, \?, 0, 1\)/);
  assert.equal(insert.values[3], 'mai@example.com');
  assert.ok(statements.some(item => item.sql.includes('INSERT INTO schedule_history')));
});

test('administrators cannot be deactivated', async () => {
  const statements = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            statements.push({ sql, values });
            return { first: async () => ({
              employee_id: 3, employee_code: 'ADMIN', first_name: 'Ada',
              last_name: 'Admin', email: 'admin@example.com', is_active: 1, is_admin: 1,
            }) };
          },
        };
      },
    },
  };
  const response = await handleAdminDeactivateEmployee(
    env, { isAdmin: true, email: 'admin@example.com' }, { employeeId: 3 },
  );
  assert.equal(response.status, 409);
  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /WHERE employee_id = \?/);
});

test('deactivation only flips active status and preserves staff history', async () => {
  const statements = [];
  const employee = {
    employee_id: 8, employee_code: 'STAFF-8', first_name: 'Lan',
    last_name: 'Tran', email: 'lan@example.com', is_active: 1, is_admin: 0,
  };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            statements.push({ sql, values });
            if (sql.includes('SELECT employee_id, employee_code') &&
                sql.includes('FROM employees')) {
              return { first: async () => employee };
            }
            return { run: async () => ({ meta: { changes: 1 } }) };
          },
        };
      },
    },
  };
  const response = await handleAdminDeactivateEmployee(
    env, { isAdmin: true, email: 'admin@example.com' }, { employeeId: 8 },
  );
  assert.equal(response.status, 200);
  const update = statements.find(item => item.sql.trimStart().startsWith('UPDATE employees'));
  assert.match(update.sql, /SET is_active = 0/);
  assert.match(update.sql, /is_admin = 0 AND is_active = 1/);
  assert.ok(statements.some(item => item.sql.includes('INSERT INTO schedule_history')));
  assert.ok(statements.every(item => !item.sql.startsWith('DELETE FROM employees')));
});

test('history endpoint validates pagination and uses a descending cursor', async () => {
  let query;
  let bindings;
  let historyRows = [{ history_id: 4 }, { history_id: 3 }];
  const env = {
    DB: {
      prepare(sql) {
        query = sql;
        return {
          bind(...values) {
            bindings = values;
            return { all: async () => ({ results: historyRows }) };
          },
        };
      },
    },
  };
  const response = await handleGetScheduleHistory(
    env, new URL('https://worker.example/api/schedule/history?before=9&limit=1'),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(bindings, [9, 2]);
  assert.match(query, /history_id < \? ORDER BY history_id DESC LIMIT \?/);
  assert.deepEqual(await response.json(), { entries: [{ history_id: 4 }], hasMore: true });

  historyRows = [{ history_id: 4 }];
  const lastPage = await handleGetScheduleHistory(
    env, new URL('https://worker.example/api/schedule/history?limit=1'),
  );
  assert.deepEqual(await lastPage.json(), { entries: [{ history_id: 4 }], hasMore: false });

  const invalid = await handleGetScheduleHistory(
    env, new URL('https://worker.example/api/schedule/history?limit=101'),
  );
  assert.equal(invalid.status, 400);
});
