import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';
import {
  handleAdminMonthlySummary,
  handleAdminCreateEmployee,
  handleAdminDeactivateEmployee,
  handleAdminCreateProgram,
  handleAdminDeleteProgram,
  handleAdminReactivateProgram,
  handleAdminReactivateEmployee,
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
    headers: {
      Cookie: `session=${cookie}`,
      Origin: 'https://frontend.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ assignmentId: 1, percentage: 50 }),
  }), env);

  assert.equal(response.status, 403);
  assert.equal(queries.length, 1);
});

test('Worker rejects state-changing requests from untrusted or missing origins', async () => {
  let queryCount = 0;
  const env = {
    FRONTEND_URL: 'https://frontend.example/path',
    SESSION_SECRET: 'test-session-secret',
    DB: {
      prepare() {
        queryCount++;
        throw new Error('must not query');
      },
    },
  };
  const cookie = await createSession({ employeeId: 7, isAdmin: true }, env.SESSION_SECRET);
  for (const origin of ['https://attacker.example', null]) {
    const headers = {
      Cookie: `session=${cookie}`,
      'Content-Type': 'text/plain',
    };
    if (origin) headers.Origin = origin;
    const response = await worker.fetch(new Request('https://worker.example/api/admin/schedule/delete', {
      method: 'POST',
      headers,
      body: '{"sessionId":1}',
    }), env);
    assert.equal(response.status, 403);
  }
  assert.equal(queryCount, 0);
});

test('Worker rejects unsafe content types and untrusted preflights', async () => {
  const env = {
    FRONTEND_URL: 'https://frontend.example/path',
    DB: { prepare() { throw new Error('must not query'); } },
  };
  const invalidType = await worker.fetch(new Request('https://worker.example/api/admin/schedule/delete', {
    method: 'POST',
    headers: { Origin: 'https://frontend.example', 'Content-Type': 'text/plain' },
    body: '{"sessionId":1}',
  }), env);
  assert.equal(invalidType.status, 415);

  const invalidPreflight = await worker.fetch(new Request('https://worker.example/api/admin/schedule/delete', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://attacker.example',
      'Access-Control-Request-Method': 'POST',
    },
  }), env);
  assert.equal(invalidPreflight.status, 403);
  assert.equal(invalidPreflight.headers.get('Access-Control-Allow-Origin'), null);

  const allowedPreflight = await worker.fetch(new Request('https://worker.example/api/admin/schedule/delete', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://frontend.example',
      'Access-Control-Request-Method': 'POST',
    },
  }), env);
  assert.equal(allowedPreflight.status, 204);
  assert.equal(allowedPreflight.headers.get('Access-Control-Allow-Origin'), 'https://frontend.example');
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
    headers: { Cookie: `session=${cookie}`, Origin: 'https://frontend.example' },
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

test('reactivation only activates inactive non-admin staff and logs the change', async () => {
  const statements = [];
  const employee = {
    employee_id: 8, employee_code: 'STAFF-8', first_name: 'Lan',
    last_name: 'Tran', email: 'lan@example.com', is_active: 0, is_admin: 0,
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
  const response = await handleAdminReactivateEmployee(
    env, { isAdmin: true, email: 'admin@example.com' }, { employeeId: 8 },
  );
  assert.equal(response.status, 200);
  const update = statements.find(item => item.sql.trimStart().startsWith('UPDATE employees'));
  assert.match(update.sql, /SET is_active = 1/);
  assert.match(update.sql, /is_admin = 0 AND is_active = 0/);
  const history = statements.find(item => item.sql.includes('INSERT INTO schedule_history'));
  assert.deepEqual(history.values, [
    'admin@example.com', 'reactivate', 'employee', 8,
    'Reactivated Lan Tran (STAFF-8)',
  ]);
});

test('reactivation endpoint cannot change administrator accounts', async () => {
  let updateAttempted = false;
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() {
            if (sql.includes('SELECT employee_id, employee_code')) {
              return {
                first: async () => ({
                  employee_id: 3, employee_code: 'ADMIN', first_name: 'Ada',
                  last_name: 'Admin', email: 'admin@example.com', is_active: 0, is_admin: 1,
                }),
              };
            }
            updateAttempted = true;
            return { run: async () => ({ meta: { changes: 1 } }) };
          },
        };
      },
    },
  };
  const response = await handleAdminReactivateEmployee(
    env, { isAdmin: true, email: 'admin@example.com' }, { employeeId: 3 },
  );
  assert.equal(response.status, 409);
  assert.equal(updateAttempted, false);
});

function makeProgramTestEnv(referenceCount = 0, isActive = 1) {
  const statements = [];
  const program = {
    program_id: 42, code: 'NEWS', name: 'Morning news',
    category: 'news', default_points: 1, default_start: null,
    default_end: null, is_active: isActive,
  };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            statements.push({ sql, values });
            if (sql.includes('SELECT program_id FROM programs WHERE code = ?')) {
              return { first: async () => null };
            }
            if (sql.trimStart().startsWith('SELECT') &&
                sql.includes('FROM programs WHERE program_id = ?')) {
              return { first: async () => program };
            }
            if (sql.includes('COUNT(*)')) {
              return { first: async () => ({ n: referenceCount }) };
            }
            return { run: async () => ({ meta: { last_row_id: 42, changes: 1 } }) };
          },
        };
      },
    },
  };
  return { env, statements };
}

test('programme creation is recorded in schedule history', async () => {
  const { env, statements } = makeProgramTestEnv();
  const response = await handleAdminCreateProgram(
    env, { isAdmin: true, email: 'admin@example.com' },
    { code: 'NEWS', name: 'Morning news', category: 'news' },
  );
  assert.equal(response.status, 201);
  const history = statements.find(item => item.sql.includes('INSERT INTO schedule_history'));
  assert.deepEqual(history.values, [
    'admin@example.com', 'create', 'programme', 42,
    'Created programme "Morning news" (NEWS)',
  ]);
});

test('programme deletions are recorded whether hidden or permanently removed', async () => {
  for (const { referenceCount, mutation, details } of [
    {
      referenceCount: 2,
      mutation: 'UPDATE programs SET is_active = 0',
      details: 'Deleted programme "Morning news" (NEWS); hidden; existing schedule records retained',
    },
    {
      referenceCount: 0,
      mutation: 'DELETE FROM programs',
      details: 'Deleted programme "Morning news" (NEWS); removed; no schedule records referenced it',
    },
  ]) {
    const { env, statements } = makeProgramTestEnv(referenceCount);
    const response = await handleAdminDeleteProgram(
      env, { isAdmin: true, email: 'admin@example.com' }, { programId: 42 },
    );
    assert.equal(response.status, 200);
    assert.ok(statements.some(item => item.sql.includes(mutation)));
    const history = statements.find(item => item.sql.includes('INSERT INTO schedule_history'));
    assert.deepEqual(history.values, [
      'admin@example.com', 'delete', 'programme', 42, details,
    ]);
  }
});

test('programme reactivation restores it and its weekly timetable', async () => {
  const { env, statements } = makeProgramTestEnv(2, 0);
  const response = await handleAdminReactivateProgram(
    env, { isAdmin: true, email: 'admin@example.com' }, { programId: 42 },
  );
  assert.equal(response.status, 200);
  assert.ok(statements.some(item =>
    item.sql.includes('UPDATE programs SET is_active = 1 WHERE program_id = ? AND is_active = 0')));
  assert.ok(statements.some(item =>
    item.sql.includes('UPDATE weekly_schedule_templates SET is_active = 1')));
  const history = statements.find(item => item.sql.includes('INSERT INTO schedule_history'));
  assert.deepEqual(history.values, [
    'admin@example.com', 'reactivate', 'programme', 42,
    'Reactivated programme "Morning news" (NEWS)',
  ]);
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

  historyRows = [{ history_id: 5 }, { history_id: 6 }];
  const newer = await handleGetScheduleHistory(
    env, new URL('https://worker.example/api/schedule/history?after=4&limit=2'),
  );
  assert.deepEqual(bindings, [4, 3]);
  assert.match(query, /history_id > \? ORDER BY history_id ASC LIMIT \?/);
  assert.deepEqual(await newer.json(), {
    entries: [{ history_id: 5 }, { history_id: 6 }],
    hasMore: false,
  });

  const invalid = await handleGetScheduleHistory(
    env, new URL('https://worker.example/api/schedule/history?limit=101'),
  );
  assert.equal(invalid.status, 400);
  const conflictingCursors = await handleGetScheduleHistory(
    env, new URL('https://worker.example/api/schedule/history?before=9&after=4'),
  );
  assert.equal(conflictingCursors.status, 400);
});
