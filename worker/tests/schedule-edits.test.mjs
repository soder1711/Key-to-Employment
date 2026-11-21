import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleAdminAssignSession,
  handleAdminCloneSession,
  handleAdminCopyScheduleWeek,
  handleAdminDeleteSession,
  handleAdminSetWeeklyTimetable,
  handleAdminUpdateSession,
} from '../src/api.js';

const admin = { isAdmin: true, employeeId: 99, email: 'admin@example.com' };
const program = {
  program_id: 1, code: 'TASK', name: 'Test task', category: 'general',
  default_points: 2, default_start: '09:00', default_end: '10:00', is_active: 1,
};

function makeSession(overrides = {}) {
  return {
    session_id: 1, program_id: 1, session_date: '2026-10-19', start_time: '09:00',
    end_time: '10:00', status: 'completed', points: 2, is_sudden: 0,
    notes: 'original', employee_id: 7, program_code: 'TASK', program_name: 'Test task',
    category: 'general', first_name: 'Test', last_name: 'Employee', employee_email: 'test@example.com',
    ...overrides,
  };
}

function mockDb(initialSessions = [makeSession()]) {
  const sessions = initialSessions.map(row => ({ ...row }));
  const history = [];
  let nextId = Math.max(0, ...sessions.map(row => row.session_id)) + 1;
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.includes('FROM programs WHERE program_id = ? LIMIT 1')) {
            return { first: async () => program.program_id === values[0] ? program : null };
          }
          if (sql.includes('WHERE s.session_id = ? LIMIT 1')) {
            return { first: async () => {
              const row = sessions.find(item => item.session_id === values[0]);
              if (!row) return null;
              const ids = row.employee_ids || (row.employee_id == null ? [] : [row.employee_id]);
              return { ...row, assignees_json: JSON.stringify(ids.map(employee_id => ({ employee_id }))) };
            } };
          }
          if (sql.includes('WHERE s.session_date >= ? AND s.session_date <= ?')) {
            return {
              all: async () => ({ results: sessions.filter(row =>
                row.session_date >= values[0] && row.session_date <= values[1]) }),
            };
          }
          if (sql.includes('INSERT INTO schedule_sessions')) {
            return { run: async () => {
              const [sessionDate, programId, startTime, endTime,
                points, isSudden, notes, createdBy] = values;
              const inserted = makeSession({
                session_id: nextId++, session_date: sessionDate, program_id: programId,
                employee_id: null, employee_ids: [], start_time: startTime, end_time: endTime,
                status: 'scheduled', points, is_sudden: isSudden, notes,
                created_by: createdBy,
              });
              sessions.push(inserted);
              return { meta: { last_row_id: inserted.session_id, changes: 1 } };
            } };
          }
          if (sql.includes('INSERT INTO schedule_occurrence_assignments')) {
            return { statement: { sql, values } };
          }
          if (sql.includes('UPDATE schedule_sessions')) {
            return { run: async () => {
              const [sessionDate, programId, startTime, endTime, points, isSudden, notes, sessionId] = values;
              const target = sessions.find(row => row.session_id === sessionId);
              if (!target) return { meta: { changes: 0 } };
              Object.assign(target, {
                session_date: sessionDate, program_id: programId, start_time: startTime,
                end_time: endTime, points, is_sudden: isSudden, notes,
              });
              return { meta: { changes: 1 } };
            } };
          }
          if (sql.includes('DELETE FROM schedule_sessions')) {
            return { run: async () => {
              const index = sessions.findIndex(row => row.session_id === values[0]);
              if (index < 0) return { meta: { changes: 0 } };
              sessions.splice(index, 1);
              return { meta: { changes: 1 } };
            } };
          }
          if (sql.includes('INSERT INTO schedule_history')) {
            return { run: async () => { history.push(values); return { success: true }; } };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      };
    },
    async batch(statements) {
      for (const statement of statements) {
        const [sessionId, employeeId] = statement.statement.values;
        const target = sessions.find(row => row.session_id === sessionId);
        if (target && !target.employee_ids.includes(employeeId)) target.employee_ids.push(employeeId);
      }
    },
  };
  return { db, sessions, history };
}

test('admin edits one session without changing its assignee or status', async () => {
  const { db, sessions, history } = mockDb();
  const response = await handleAdminUpdateSession({ DB: db }, admin, {
    sessionId: 1, programId: 1, sessionDate: '2026-10-20', startTime: '11:00',
    endTime: '12:00', points: 4.5, isSudden: true, notes: 'updated',
    correctionReason: 'Corrected after review',
  });

  assert.equal(response.status, 200);
  assert.equal(sessions[0].session_date, '2026-10-20');
  assert.equal(sessions[0].points, 4.5);
  assert.equal(sessions[0].employee_id, 7);
  assert.equal(sessions[0].status, 'completed');
  assert.match(history[0][4], /points 2\.0 -> 4\.5/);
  assert.match(history[0][4], /reason: Corrected after review/);
});

test('session correction requires a reason before reading the session', async () => {
  let queryCount = 0;
  const response = await handleAdminUpdateSession(
    { DB: { prepare() { queryCount++; } } }, admin,
    {
      sessionId: 1, programId: 1, sessionDate: '2026-10-20',
      points: 4.5, isSudden: false,
    },
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Correction reason is required/);
  assert.equal(queryCount, 0);
});

test('one-off session updates reject recurring materialized sessions', async () => {
  const { db, sessions, history } = mockDb([
    makeSession({ recurring_series_id: 12, recurrence_date: '2026-10-19' }),
  ]);
  const response = await handleAdminUpdateSession({ DB: db }, admin, {
    sessionId: 1, programId: 1, sessionDate: '2026-10-20', startTime: '11:00',
    endTime: '12:00', points: 4.5, isSudden: true, notes: 'updated',
    correctionReason: 'Corrected after review',
  });
  assert.equal(response.status, 400);
  assert.equal(sessions[0].session_date, '2026-10-19');
  assert.deepEqual(history, []);
});

test('session assignment rejects invalid calendar dates and reversed times', async () => {
  for (const payload of [
    { date: '2026-02-31', startTime: '09:00', endTime: '10:00' },
    { date: '2026-02-28', startTime: '11:00', endTime: '10:00' },
  ]) {
    let queries = 0;
    const response = await handleAdminAssignSession(
      { DB: { prepare() { queries++; throw new Error('must not query'); } } },
      admin,
      { programId: 1, points: 2, ...payload },
    );
    assert.equal(response.status, 400);
    assert.equal(queries, 0);
  }
});

test('session assignment rejects inactive employees', async () => {
  const response = await handleAdminAssignSession(
    {
      DB: {
        prepare(sql) {
          assert.match(sql, /FROM employees WHERE employee_id = \?/);
          return { bind: () => ({ first: async () => ({ employee_id: 7, is_active: 0 }) }) };
        },
      },
    },
    admin,
    {
      employeeId: 7, programId: 1, date: '2026-02-28',
      startTime: '09:00', endTime: '10:00', points: 2,
    },
  );
  assert.equal(response.status, 400);
});

test('adding a session to the schedule uses a distinct history action', async () => {
  const { db, history } = mockDb([]);
  const response = await handleAdminAssignSession({ DB: db }, admin, {
    programId: 1, date: '2026-10-19', points: 2, isSudden: false,
  });

  assert.equal(response.status, 200);
  assert.equal(history[0][1], 'add');
  assert.equal(history[0][2], 'session');
});

test('removing a session from the schedule uses a distinct history action', async () => {
  const { db, history } = mockDb();
  const response = await handleAdminDeleteSession({ DB: db }, admin, { sessionId: 1 });

  assert.equal(response.status, 200);
  assert.equal(history[0][1], 'remove');
  assert.equal(history[0][2], 'session');
});

test('session edit rejects invalid calendar dates', async () => {
  let queryCount = 0;
  const response = await handleAdminUpdateSession(
    { DB: { prepare() { queryCount++; } } }, admin,
    { sessionId: 1, programId: 1, sessionDate: '2026-02-30', points: 1, isSudden: false },
  );

  assert.equal(response.status, 400);
  assert.equal(queryCount, 0);
});

test('weekday clone keeps task settings and assignee but starts scheduled', async () => {
  const { db, sessions, history } = mockDb();
  const response = await handleAdminCloneSession(
    { DB: db }, admin, { sessionId: 1, dates: ['2026-10-21', '2026-10-23'] },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.clonedCount, 2);
  assert.deepEqual(sessions.slice(1).map(row => row.session_date), ['2026-10-21', '2026-10-23']);
  assert.ok(sessions.slice(1).every(row => row.employee_id == null && row.employee_ids.includes(7) && row.points === 2 &&
    row.notes === 'original' && row.status === 'scheduled'));
  assert.ok(history.every(entry => entry[1] === 'add'));
});

test('weekday clone rejects dates outside the source week', async () => {
  const { db, sessions } = mockDb();
  const response = await handleAdminCloneSession(
    { DB: db }, admin, { sessionId: 1, dates: ['2026-10-26'] },
  );

  assert.equal(response.status, 400);
  assert.equal(sessions.length, 1);
});

test('weekly copy creates only missing occurrences and never copies cancelled tasks', async () => {
  const original = makeSession({ session_id: 1 });
  const duplicate = makeSession({ session_id: 2 });
  const completed = makeSession({
    session_id: 3, session_date: '2026-10-20', status: 'completed', program_id: 2,
    program_code: 'OTHER', program_name: 'Other task', employee_id: null,
  });
  const cancelled = makeSession({ session_id: 4, session_date: '2026-10-21', status: 'cancelled' });
  const existingCopy = makeSession({ session_id: 5, session_date: '2026-10-26', status: 'scheduled' });
  const { db, sessions } = mockDb([original, duplicate, completed, cancelled, existingCopy]);
  const response = await handleAdminCopyScheduleWeek(
    { DB: db }, admin, { weekStart: '2026-10-19' },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.targetWeekStart, '2026-10-26');
  assert.equal(payload.createdCount, 2);
  assert.equal(payload.skippedCount, 1);
  const copied = sessions.filter(row => row.session_date === '2026-10-27' ||
    (row.session_date === '2026-10-26' && row.session_id > 5));
  assert.equal(copied.length, 2);
  assert.ok(copied.every(row => row.status === 'scheduled'));
  assert.ok(!sessions.some(row => row.session_date === '2026-10-28'));
});

test('weekly copy accepts only Monday week starts', async () => {
  let queryCount = 0;
  const response = await handleAdminCopyScheduleWeek(
    { DB: { prepare() { queryCount++; } } }, admin, { weekStart: '2026-10-20' },
  );

  assert.equal(response.status, 400);
  assert.equal(queryCount, 0);
});

test('weekly timetable changes remain admin-only', async () => {
  let queryCount = 0;
  const response = await handleAdminSetWeeklyTimetable(
    { DB: { prepare() { queryCount++; } } },
    { ...admin, isAdmin: false }, { enabled: false },
  );

  assert.equal(response.status, 403);
  assert.equal(queryCount, 0);
});

test('weekly timetable save validates its Monday before touching the database', async () => {
  let queryCount = 0;
  const response = await handleAdminSetWeeklyTimetable(
    { DB: { prepare() { queryCount++; } } }, admin,
    { enabled: true, weekStart: '2026-11-10' },
  );

  assert.equal(response.status, 400);
  assert.equal(queryCount, 0);
});
