import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAdminRecurringTimetable, handleAdminSessionStatus } from '../src/api.js';
import { getScheduleBetween } from '../src/db.js';
import { expandRecurringOccurrences } from '../src/recurrence.js';

function version(overrides = {}) {
  return {
    series_id: 4, weekday: 1, program_id: 2, employee_id: 7,
    start_time: '09:00', end_time: '10:00', points: 2, is_sudden: 0,
    notes: null, start_date: '2026-11-02', end_date: null,
    effective_from: '2026-11-02', effective_to: null,
    program_code: 'TASK', program_name: 'Test task', category: 'general',
    first_name: 'Test', last_name: 'Person', employee_email: 'test@example.com',
    ...overrides,
  };
}

test('effective-dated versions switch at the exact cutoff without rewriting prior occurrences', () => {
  const occurrences = expandRecurringOccurrences([
    version({ effective_to: '2026-11-16' }),
    version({ weekday: 2, start_time: '10:00', effective_from: '2026-11-16' }),
  ], '2026-11-02', '2026-11-24');

  assert.deepEqual(occurrences.map(row => [row.session_date, row.start_time]), [
    ['2026-11-02', '09:00'], ['2026-11-09', '09:00'],
    ['2026-11-17', '10:00'], ['2026-11-24', '10:00'],
  ]);
});

test('series IDs isolate otherwise identical entries and exceptions can move one occurrence', () => {
  const occurrences = expandRecurringOccurrences([
    version({ series_id: 4 }),
    version({ series_id: 5 }),
  ], '2026-11-16', '2026-11-23', [
    { series_id: 4, occurrence_date: '2026-11-16', action: 'modified',
      moved_date: '2026-11-17', start_time: '11:00', points: 3, is_sudden: 0,
      program_id: 2, employee_id: 7, notes: null, program_name: 'Moved task' },
    { series_id: 4, occurrence_date: '2026-11-23', action: 'cancelled' },
  ]);

  assert.deepEqual(occurrences.map(row => [row.recurring_series_id, row.session_date]), [
    [5, '2026-11-16'], [4, '2026-11-17'], [4, '2026-11-23'], [5, '2026-11-23'],
  ]);
  const moved = occurrences.find(row => row.recurring_series_id === 4);
  assert.equal(moved.recurrence_date, '2026-11-16');
  assert.equal(moved.start_time, '11:00');
  assert.equal(moved.is_modified, true);
  assert.equal(occurrences.find(row => row.recurring_series_id === 4 &&
    row.session_date === '2026-11-23').status, 'cancelled');
});

test('a moved exception remains visible after its source schedule version has closed', () => {
  const rows = expandRecurringOccurrences([
    version({ effective_to: '2026-11-17' }),
  ], '2026-11-17', '2026-11-17', [{
    series_id: 4, occurrence_date: '2026-11-16', moved_date: '2026-11-17',
    action: 'modified', program_id: 2, employee_id: 7,
    start_time: '11:00', end_time: '12:00', points: 3, is_sudden: 0,
    program_name: 'Moved task', program_code: 'MOVE', category: 'general',
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].session_date, '2026-11-17');
  assert.equal(rows[0].recurrence_date, '2026-11-16');
  assert.equal(rows[0].program_name, 'Moved task');
});

test('preserved exceptions remain on their dated occurrence after a series weekday change', () => {
  const rows = expandRecurringOccurrences([
    version({ weekday: 2, effective_from: '2026-11-16' }),
  ], '2026-11-23', '2026-11-23', [{
    series_id: 4, occurrence_date: '2026-11-23', action: 'modified',
    program_id: 2, employee_id: 7, start_time: '13:00', end_time: '14:00',
    points: 3, is_sudden: 0, program_name: 'Exception task',
  }]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].session_date, '2026-11-23');
  assert.equal(rows[0].start_time, '13:00');
  assert.equal(rows[0].is_modified, true);
});

test('a cancelled exception remains identifiable after the series weekday changes', () => {
  const [row] = expandRecurringOccurrences([
    version({ weekday: 2, effective_from: '2026-11-16' }),
  ], '2026-11-23', '2026-11-23', [{
    series_id: 4, occurrence_date: '2026-11-23', action: 'cancelled',
  }]);

  assert.equal(row.status, 'cancelled');
  assert.equal(row.program_name, 'Test task');
  assert.equal(row.program_id, 2);
});

test('completed session values and occurrence notes override later template changes', () => {
  const [occurrence] = expandRecurringOccurrences([
    version({ start_time: '12:00', points: 99, notes: 'new plan' }),
  ], '2026-11-16', '2026-11-16', [], [{
    session_id: 31, recurring_series_id: 4, recurrence_date: '2026-11-16',
    session_date: '2026-11-16', status: 'completed', start_time: '09:00',
    points: 2, occurrence_notes: 'completed as planned',
  }]);

  assert.equal(occurrence.status, 'completed');
  assert.equal(occurrence.points, 2);
  assert.equal(occurrence.start_time, '09:00');
  assert.equal(occurrence.occurrence_notes, 'completed as planned');
  assert.equal(occurrence.is_projected, false);
});

test('an existing scheduled occurrence adopts the updated plan and keeps its session ID', () => {
  const [occurrence] = expandRecurringOccurrences([
    version({ start_time: '11:00', points: 5, effective_from: '2026-11-16' }),
  ], '2026-11-16', '2026-11-16', [], [{
    session_id: 44, recurring_series_id: 4, recurrence_date: '2026-11-16',
    session_date: '2026-11-16', status: 'scheduled', start_time: '09:00', points: 2,
  }]);

  assert.equal(occurrence.session_id, 44);
  assert.equal(occurrence.status, 'scheduled');
  assert.equal(occurrence.start_time, '11:00');
  assert.equal(occurrence.points, 5);
});

test('cancelled occurrences stay visible and series-scoped exceptions can be reopened', () => {
  const [cancelled] = expandRecurringOccurrences([version()], '2026-11-16', '2026-11-16', [{
    series_id: 4, occurrence_date: '2026-11-16', action: 'cancelled',
  }]);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.is_projected, true);
});

test('reopening a projected scheduled occurrence does not create a session row', async () => {
  let writes = 0;
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            all: async () => ({ results: sql.includes('FROM recurring_schedule_versions')
              ? [version()] : [] }),
            first: async () => null,
            run: async () => { writes++; return { meta: { changes: 1 } }; },
          };
        },
      };
    },
  };
  const response = await handleAdminSessionStatus({ DB: db }, {
    isAdmin: true, employeeId: 99, email: 'admin@example.com',
  }, { seriesId: 4, occurrenceDate: '2026-11-16', status: 'scheduled' });

  assert.equal(response.status, 200);
  assert.equal(writes, 0);
});

test('schedule reads project occurrences without issuing writes', async () => {
  const projectedVersion = version();
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            all: async () => ({ results: sql.includes('recurring_schedule_versions')
              ? [projectedVersion] : [] }),
          };
        },
      };
    },
  };
  const rows = await getScheduleBetween(db, '2026-11-02', '2026-11-08');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].is_projected, true);
  assert.equal(rows[0].session_id, 'recurring:4:2026-11-02');
});

test('future series edits atomically version the series and preserve exceptions by default', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => {
              if (sql.includes('FROM recurring_schedule_versions')) {
                return { version_id: 8, series_id: 4, weekday: 1, program_id: 2,
                  employee_id: 7, start_time: '09:00', end_time: '10:00', points: 2,
                  is_sudden: 0, notes: null, start_date: '2026-11-02', end_date: null,
                  effective_from: '2026-11-02', effective_to: null };
              }
              if (sql.includes('FROM programs')) return { is_active: 1 };
              if (sql.includes('FROM employees')) return { employee_id: 7 };
              throw new Error(`Unexpected query: ${sql}`);
            },
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 1 } }),
            statement: { sql, values },
          };
        },
      };
    },
    async batch(batchStatements) {
      statements.push(...batchStatements.map(item => item.statement));
    },
  };
  const cutoffDate = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const response = await handleAdminRecurringTimetable({ DB: db }, {
    isAdmin: true, employeeId: 99, email: 'admin@example.com',
  }, {
    operation: 'edit', seriesId: 4, cutoffDate,
    weekday: 2, programId: 2, employeeId: 7, startTime: '10:00', endTime: '11:00',
    points: 3, isSudden: false, notes: null, replaceFutureExceptions: false,
    correctionReason: 'Updated after review',
  });

  assert.equal(response.status, 200);
  assert.equal(statements.length, 4);
  assert.ok(statements[0].sql.includes('SET effective_to = ?'));
  assert.ok(statements[1].sql.includes('DELETE FROM recurring_schedule_versions'));
  assert.ok(statements[2].sql.includes('INSERT INTO recurring_schedule_versions'));
  assert.ok(statements[3].sql.includes('INSERT INTO schedule_history'));
  assert.match(statements[3].values[2], /points 2\.0 -> 3\.0/);
  assert.match(statements[3].values[2], /reason: Updated after review/);
  assert.equal(statements[0].values[0], cutoffDate);
  assert.ok(statements.every(item => !item.sql.includes('schedule_sessions')));
});

test('past series edits update and audit completed credits from the cutoff', async () => {
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => {
              if (sql.includes('FROM recurring_schedule_versions')) return version();
              if (sql.includes('FROM programs')) return { is_active: 1 };
              throw new Error(`Unexpected query: ${sql}`);
            },
            statement: { sql, values },
          };
        },
      };
    },
    async batch(batchStatements) {
      statements.push(...batchStatements.map(item => item.statement));
    },
  };
  const cutoffDate = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const response = await handleAdminRecurringTimetable({ DB: db }, {
    isAdmin: true, employeeId: 99, email: 'admin@example.com',
  }, {
    operation: 'edit', seriesId: 4, cutoffDate,
    weekday: 1, programId: 2, employeeId: null, startTime: '09:00', endTime: '10:00',
    points: 5, isSudden: false, notes: null, replaceFutureExceptions: false,
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).cutoffDate, cutoffDate);
  assert.equal(statements[0].values[0], cutoffDate);
  assert.ok(statements[2].sql.includes('INSERT INTO recurring_schedule_versions'));
  assert.equal(statements[2].values[11], cutoffDate);
  assert.match(statements[3].sql, /INSERT INTO schedule_history[\s\S]*FROM schedule_sessions/);
  assert.match(statements[3].sql, /status = 'completed' AND points <> \?/);
  assert.deepEqual(statements[3].values, [
    'admin@example.com', 4, 5, 'reason not provided', 4, cutoffDate, 5,
  ]);
  assert.match(statements[4].sql, /UPDATE schedule_sessions[\s\S]*status = 'completed'/);
  assert.deepEqual(statements[4].values, [5, 4, cutoffDate, 5]);
  assert.match(statements[5].values[2], /completed credits updated/);
});

test('recurring series edits reject an overlong optional correction reason before database reads', async () => {
  let queryCount = 0;
  const response = await handleAdminRecurringTimetable(
    { DB: { prepare() { queryCount++; } } },
    { isAdmin: true, employeeId: 99, email: 'admin@example.com' },
    {
      operation: 'edit', seriesId: 4, cutoffDate: '2026-11-23',
      replaceFutureExceptions: false, correctionReason: 'x'.repeat(1001),
    },
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Invalid correction reason/);
  assert.equal(queryCount, 0);
});
