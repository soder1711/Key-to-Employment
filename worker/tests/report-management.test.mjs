import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleAdminAssignSession, handleAdminQuarterlySummary, handleAdminUpdateProgram,
} from '../src/api.js';

test('quarterly report returns each selected employee month and summed targets', async () => {
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...bindings) {
            return {
              first: async () => sql.includes('FROM employees')
                ? {
                    employee_id: 7, first_name: 'Quarter', last_name: 'Tester',
                    email: 'quarter@example.com', is_active: 1,
                  }
                : null,
              all: async () => {
                if (!sql.includes('LEFT JOIN monthly_targets')) return { results: [] };
                const month = bindings[3];
                return { results: [{
                  employee_id: 7, first_name: 'Quarter', last_name: 'Tester',
                  email: 'quarter@example.com',
                  target_points: month === 4 ? 25 : null,
                  target_is_override: month === 4 ? 1 : 0,
                  session_id: month,
                  session_date: `2026-${String(month).padStart(2, '0')}-12`,
                  status: 'completed',
                  points: month * 2,
                }] };
              },
            };
          },
        };
      },
    },
  };
  const response = await handleAdminQuarterlySummary(
    env, { isAdmin: true }, new URL('https://worker.example/api/admin/schedule/quarterly?employeeId=7&year=2026&quarter=2'),
  );
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.deepEqual(report.months.map(month => month.month), [4, 5, 6]);
  assert.deepEqual(report.months.map(month => month.completed_points), [8, 10, 12]);
  assert.deepEqual(report.months.map(month => month.target_points), [25, 170, 170]);
  assert.equal(report.totals.completed_points, 30);
  assert.equal(report.totals.target_points, 365);
  assert.equal(report.totals.goal_variance, -335);
});

test('quarterly reports are restricted to administrators before database access', async () => {
  let queryCount = 0;
  const response = await handleAdminQuarterlySummary(
    { DB: { prepare() { queryCount++; throw new Error('must not query'); } } },
    { isAdmin: false },
    new URL('https://worker.example/api/admin/schedule/quarterly?employeeId=7&year=2026&quarter=1'),
  );
  assert.equal(response.status, 403);
  assert.equal(queryCount, 0);
});

test('editing programme defaults updates only the programme record', async () => {
  const statements = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...bindings) {
            statements.push({ sql, bindings });
            return {
              first: async () => ({
                program_id: 4, code: 'NEWS', name: 'Old name', category: 'news',
                default_points: 1, default_start: '09:00', default_end: '10:00',
                is_active: 1,
              }),
              run: async () => ({ success: true }),
            };
          },
        };
      },
    },
  };
  const response = await handleAdminUpdateProgram(
    env, { isAdmin: true, email: 'admin@example.com' },
    { programId: 4, name: 'Updated name', defaultPoints: 2.5, defaultStart: '22:00', defaultEnd: '01:00' },
  );
  assert.equal(response.status, 200);
  const update = statements.find(statement => statement.sql.includes('UPDATE programs'));
  assert.deepEqual(update.bindings, ['Updated name', 2.5, '22:00', '01:00', 4]);
  assert.ok(statements.every(statement => !statement.sql.includes('UPDATE schedule_sessions')));
});

test('one-off sessions allow overnight times but reject a zero-length interval', async () => {
  const statements = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...bindings) {
            statements.push({ sql, bindings });
            return {
              run: async () => ({ meta: { last_row_id: 11, changes: 1 } }),
              first: async () => ({
                session_id: 11, program_id: 3, session_date: '2026-11-22',
                start_time: '22:30', end_time: '01:15', status: 'scheduled', points: 2,
                is_sudden: 0, notes: null, occurrence_notes: null, employee_id: null,
                assignees_json: '[]', program_code: 'OVN', program_name: 'Overnight',
                category: 'general', program_is_active: 1,
              }),
            };
          },
        };
      },
    },
  };
  const session = { isAdmin: true, email: 'admin@example.com', employeeId: 1 };
  const valid = await handleAdminAssignSession(env, session, {
    date: '2026-11-22', programId: 3, startTime: '22:30', endTime: '01:15',
    points: 2, isSudden: false,
  });
  assert.equal(valid.status, 200);
  assert.ok(statements.some(statement => statement.sql.includes('INSERT INTO schedule_sessions') &&
    statement.bindings.includes('01:15')));

  const count = statements.length;
  const invalid = await handleAdminAssignSession(env, session, {
    date: '2026-11-22', programId: 3, startTime: '22:30', endTime: '22:30',
    points: 2, isSudden: false,
  });
  assert.equal(invalid.status, 400);
  assert.equal(statements.length, count);
});
