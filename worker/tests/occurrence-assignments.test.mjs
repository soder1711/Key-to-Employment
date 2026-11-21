import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAdminReassignSession, handleAdminRecurringTimetable } from '../src/api.js';
import { getRecurringTimetable, getScheduleBetween } from '../src/db.js';

const admin = { isAdmin: true, employeeId: 99, email: 'admin@example.com' };

function recurringVersion() {
  return {
    series_id: 12, weekday: 1, program_id: 4, employee_id: null,
    start_time: '09:00', end_time: '10:00', points: 5, is_sudden: 0,
    notes: null, start_date: '2026-11-02', end_date: null,
    effective_from: '2026-11-02', effective_to: null,
    program_code: 'TASK', program_name: 'Weekly task', category: 'general',
  };
}

function scheduleDb({ assignees = [], oneOff = null } = {}) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            all: async () => {
              if (sql.includes('FROM recurring_schedule_versions')) {
                return { results: [recurringVersion()] };
              }
              if (sql.includes('SELECT oa.recurring_series_id')) return { results: assignees };
              if (sql.includes('WHERE s.session_date >= ? AND s.session_date <= ?')) {
                return { results: oneOff ? [oneOff] : [] };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

test('recurring timetable filters by the Vietnam calendar date', async () => {
  let query = '';
  let bindings = [];
  const db = {
    prepare(sql) {
      query = sql;
      return {
        bind(...values) {
          bindings = values;
          return { all: async () => ({ results: [] }) };
        },
      };
    },
  };

  await getRecurringTimetable(db, '2026-11-22');

  assert.match(query, /v\.end_date IS NULL OR v\.end_date >= \?/);
  assert.doesNotMatch(query, /date\('now'\)/);
  assert.deepEqual(bindings, ['2026-11-22']);
});

test('recurring occurrences distinguish unassigned, single, and multiple employees', async () => {
  const assigned = [
    { recurring_series_id: 12, occurrence_date: '2026-11-16', employee_id: 7,
      first_name: 'One', last_name: 'Person', employee_email: 'one@example.com' },
    { recurring_series_id: 12, occurrence_date: '2026-11-16', employee_id: 8,
      first_name: 'Two', last_name: 'Person', employee_email: 'two@example.com' },
  ];
  const unassigned = await getScheduleBetween(scheduleDb(), '2026-11-16', '2026-11-22');
  assert.deepEqual(unassigned[0].employee_ids, []);
  assert.deepEqual(unassigned[0].assignees, []);

  const single = await getScheduleBetween(scheduleDb({ assignees: assigned.slice(0, 1) }),
    '2026-11-16', '2026-11-22');
  assert.deepEqual(single[0].employee_ids, [7]);

  const multiple = await getScheduleBetween(scheduleDb({ assignees: assigned }),
    '2026-11-16', '2026-11-22');
  assert.deepEqual(multiple[0].employee_ids, [7, 8]);
  assert.equal(multiple.length, 1);
});

test('one-off sessions return their occurrence assignees without duplicating the session', async () => {
  const session = {
    session_id: 42, recurring_series_id: null, recurrence_date: null,
    session_date: '2026-11-17', start_time: '09:00', program_id: 4,
    status: 'scheduled', points: 5, employee_id: null,
    assignees_json: JSON.stringify([
      { employee_id: 7, first_name: 'One', last_name: 'Person', email: 'one@example.com' },
      { employee_id: 8, first_name: 'Two', last_name: 'Person', email: 'two@example.com' },
    ]),
  };
  const rows = await getScheduleBetween(scheduleDb({ oneOff: session }),
    '2026-11-16', '2026-11-22');

  const oneOffRows = rows.filter(row => row.session_id === 42);
  assert.equal(oneOffRows.length, 1);
  assert.deepEqual(oneOffRows[0].employee_ids, [7, 8]);
  assert.equal(oneOffRows[0].employee_id, null);
});

function assignmentDb(occurrence = false) {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            sql, values,
            first: async () => {
              if (sql.includes('FROM employees WHERE employee_id = ?')) {
                return { employee_id: 7, is_active: 1, first_name: 'Test', last_name: 'Employee' };
              }
              if (sql.includes('WHERE s.session_id = ? LIMIT 1')) {
                return { session_id: 42, session_date: '2026-11-16', program_name: 'One-off',
                  recurring_series_id: null, employee_id: null, assignees_json: '[]' };
              }
              return null;
            },
            all: async () => {
              if (sql.includes('FROM recurring_schedule_versions')) return { results: [recurringVersion()] };
              return { results: [] };
            },
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
    async batch(statements) { batches.push(statements); },
  };
  return { db, batches, occurrence };
}

test('assignment toggle is scoped to one recurring date and never edits the recurring rule', async () => {
  const { db, batches } = assignmentDb(true);
  const response = await handleAdminReassignSession({ DB: db }, admin, {
    seriesId: 12, occurrenceDate: '2026-11-16', employeeId: 7, assigned: true,
  });

  assert.equal(response.status, 200);
  const [insert] = batches[0];
  assert.match(insert.sql, /recurring_series_id, occurrence_date, employee_id/);
  assert.deepEqual(insert.values, [12, '2026-11-16', 7, 99]);
  assert.ok(!batches.flat().some(statement => /recurring_schedule_versions/.test(statement.sql)));
});

test('unassigning a recurring occurrence deletes only the selected employee link', async () => {
  const { db, batches } = assignmentDb(true);
  const response = await handleAdminReassignSession({ DB: db }, admin, {
    seriesId: 12, occurrenceDate: '2026-11-16', employeeId: 7, assigned: false,
  });

  assert.equal(response.status, 200);
  const deletion = batches[0].find(statement => statement.sql.includes('DELETE FROM schedule_occurrence_assignments'));
  assert.deepEqual(deletion.values, [12, '2026-11-16', 7]);
});

test('one-off assignment toggle uses the session ID link key', async () => {
  const { db, batches } = assignmentDb();
  const response = await handleAdminReassignSession({ DB: db }, admin, {
    sessionId: 42, employeeId: 7, assigned: true,
  });

  assert.equal(response.status, 200);
  assert.ok(batches[0].some(statement => /INSERT INTO schedule_occurrence_assignments \(session_id/.test(statement.sql)));
  assert.ok(batches[0].some(statement => /UPDATE schedule_sessions SET employee_id = NULL/.test(statement.sql)));
});

test('recurring rule creation ignores an attempted default assignee', async () => {
  const batches = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            sql, values,
            first: async () => sql.includes('FROM programs WHERE program_id = ? LIMIT 1')
              ? { program_id: 4, is_active: 1 } : null,
            statement: { sql, values },
          };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return [{ meta: { last_row_id: 23 } }, {}, {}];
    },
  };
  const response = await handleAdminRecurringTimetable({ DB: db }, admin, {
    operation: 'create', weekday: 1, programId: 4, employeeId: 7,
    startTime: '09:00', endTime: '10:00', points: 5, isSudden: false,
    startDate: '2026-12-07', endDate: null,
  });

  assert.equal(response.status, 201);
  const versionInsert = batches[0].find(statement => statement.sql.includes('INSERT INTO recurring_schedule_versions'));
  assert.equal(versionInsert.values[2], null);
});
