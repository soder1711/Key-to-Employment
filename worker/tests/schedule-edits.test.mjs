import assert from 'node:assert/strict';
import test from 'node:test';
import {
  handleAdminCloneSession,
  handleAdminCopyScheduleWeek,
  handleAdminSetWeeklyTimetable,
  handleAdminUpdateSession,
} from '../src/api.js';
import { materializeWeeklySchedule } from '../src/db.js';

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
            return { first: async () => sessions.find(row => row.session_id === values[0]) ?? null };
          }
          if (sql.includes('WHERE s.session_date >= ? AND s.session_date <= ?')) {
            return {
              all: async () => ({ results: sessions.filter(row =>
                row.session_date >= values[0] && row.session_date <= values[1]) }),
            };
          }
          if (sql.includes('INSERT INTO schedule_sessions')) {
            return { run: async () => {
              const [sessionDate, programId, employeeId, startTime, endTime,
                points, isSudden, notes, createdBy] = values;
              const inserted = makeSession({
                session_id: nextId++, session_date: sessionDate, program_id: programId,
                employee_id: employeeId, start_time: startTime, end_time: endTime,
                status: 'scheduled', points, is_sudden: isSudden, notes,
                created_by: createdBy,
              });
              sessions.push(inserted);
              return { meta: { last_row_id: inserted.session_id, changes: 1 } };
            } };
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
          if (sql.includes('INSERT INTO schedule_history')) {
            return { run: async () => { history.push(values); return { success: true }; } };
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      };
    },
  };
  return { db, sessions, history };
}

test('admin edits one session without changing its assignee or status', async () => {
  const { db, sessions } = mockDb();
  const response = await handleAdminUpdateSession({ DB: db }, admin, {
    sessionId: 1, programId: 1, sessionDate: '2026-10-20', startTime: '11:00',
    endTime: '12:00', points: 4.5, isSudden: true, notes: 'updated',
  });

  assert.equal(response.status, 200);
  assert.equal(sessions[0].session_date, '2026-10-20');
  assert.equal(sessions[0].points, 4.5);
  assert.equal(sessions[0].employee_id, 7);
  assert.equal(sessions[0].status, 'completed');
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
  const { db, sessions } = mockDb();
  const response = await handleAdminCloneSession(
    { DB: db }, admin, { sessionId: 1, dates: ['2026-10-21', '2026-10-23'] },
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.clonedCount, 2);
  assert.deepEqual(sessions.slice(1).map(row => row.session_date), ['2026-10-21', '2026-10-23']);
  assert.ok(sessions.slice(1).every(row => row.employee_id === 7 && row.points === 2 &&
    row.notes === 'original' && row.status === 'scheduled'));
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

test('weekly materialization attempts each requested date with idempotent occurrence keys', async () => {
  const inserts = [];
  const db = {
    prepare(sql) {
      return {
        all: async () => ({ results: [{ template_id: 2 }] }),
        bind(...values) {
          return { run: async () => { inserts.push({ sql, values }); } };
        },
      };
    },
  };
  await materializeWeeklySchedule(db, '2026-11-09', '2026-11-15');

  assert.equal(inserts.length, 7);
  assert.deepEqual(inserts.map(row => row.values[0]), [
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
    '2026-11-13', '2026-11-14', '2026-11-15',
  ]);
  assert.deepEqual(inserts.map(row => row.values[2]), [1, 2, 3, 4, 5, 6, 0]);
  assert.ok(inserts.every(row => row.sql.includes('ON CONFLICT(template_id, template_date) DO NOTHING')));
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
