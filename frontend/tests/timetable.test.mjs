import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function fixture() {
  class Element extends EventTarget {
    style = {};
    value = '';
    checked = false;
    disabled = false;
    open = false;
    textContent = '';
    innerHTML = '';
    attributes = new Map();
    classes = new Set();
    classList = {
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
    };
    setAttribute(name, value) { this.attributes.set(name, value); }
    focus() { this.focused = true; }
    reportValidity() { return true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
  }
  const elements = new Map([...readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    .matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  const container = new Element();
  const focus = new Element();
  const browserWindow = { location: { search: '', hostname: 'localhost' }, confirm: () => false };
  const context = vm.createContext({
    URLSearchParams, Date, console,
    window: browserWindow,
    localStorage: { getItem: () => 'en' }, navigator: { language: 'en' },
    document: {
      getElementById: id => {
        assert.ok(elements.has(id), `Missing HTML element: ${id}`);
        return elements.get(id);
      },
      querySelector: () => container,
      activeElement: focus,
    },
  });
  for (const file of ['shared.js', 'schedule.js', 'session-modals.js', 'plan.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  return { elements, context, focus, run: source => vm.runInContext(source, context) };
}

const submit = elements => elements.get('schedule-change-form').dispatchEvent(new Event('submit', { cancelable: true }));
const input = elements => elements.get('schedule-change-form').dispatchEvent(new Event('input'));

test('admin Schedule and Plan open their distinct default assignment views', () => {
  const { elements, run } = fixture();
  assert.equal(run('scheduleViewMode'), 'timetable');
  assert.equal(run('planViewMode'), 'sessions');
  run('currentUser = {isAdmin:true}; setScheduleMode(scheduleViewMode, false); setPlanViewMode(planViewMode)');
  assert.equal(elements.get('timetable-editor').style.display, 'block');
  assert.equal(elements.get('plan-sessions-panel').style.display, 'block');
  assert.equal(elements.get('plan-timetable-panel').style.display, 'none');
});

test('Plan renders dated tasks for every weekday in the selected week', () => {
  const { elements, context, run } = fixture();
  context.testDates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
    '2026-11-20', '2026-11-21', '2026-11-22'];
  context.testSessions = [
    { session_date: '2026-11-16', program_name: 'Monday task', status: 'scheduled', points: 2 },
    { session_date: '2026-11-19', program_name: 'Thursday task', status: 'scheduled', points: 3 },
  ];
  run("planWeekStart = '2026-11-16'; planDates = testDates; planSessions = testSessions; adminEmployees = []; renderPlanBoard()");
  const board = elements.get('plan-days').innerHTML;
  assert.equal((board.match(/class="day-block(?: |")/g) || []).length, 7);
  assert.ok(board.includes('Monday task'));
  assert.ok(board.includes('Thursday task'));
  assert.match(elements.get('plan-week-label').textContent, /^Mon 16 Nov/);
  assert.match(elements.get('plan-week-label').textContent, /Sun 22 Nov/);
});

test('mode switch isolates timetable from dated navigation and gates employees', () => {
  const { elements, run } = fixture();
  run("currentUser = { isAdmin: true }; setScheduleMode('timetable', false)");
  assert.equal(elements.get('dated-schedule-panel').style.display, 'none');
  assert.equal(elements.get('timetable-editor').style.display, 'block');
  assert.equal(elements.get('schedule-mode-timetable').attributes.get('aria-pressed'), 'true');
  run("currentUser = { isAdmin: false }; setScheduleMode('timetable', false)");
  assert.equal(elements.get('timetable-editor').style.display, 'none');
  assert.equal(elements.get('dated-schedule-panel').style.display, 'block');
  assert.equal(elements.get('schedule-mode-switch').style.display, 'none');
});

test('timetable groups rules by weekday, sorts entries, and escapes task names', () => {
  const { elements, context, run } = fixture();
  const entry = { weekday: 1, employee_id: null, series_id: 1, program_name: '<img onerror=bad>',
    start_time: '10:00', end_time: '11:00', points: 5, start_date: '2026-11-01', effective_from: '2099-01-01' };
  context.entries = [entry, { ...entry, series_id: 2, start_time: '09:00', program_name: 'Earlier' }];
  run("recurringEntries = entries; renderTimetableEntries('plan-timetable-grid')");
  const html = elements.get('plan-timetable-grid').innerHTML;
  assert.equal((html.match(/class="day-head/g) || []).length, 7);
  assert.ok(html.indexOf('>Mon</th>') < html.indexOf('>Sun</th>'));
  assert.ok(html.indexOf('Earlier') < html.indexOf('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Upcoming settings from 2099-01-01'));
  assert.ok(html.includes('data-timetable-add="0"'));
  assert.ok(html.includes('Unassigned'));
  assert.ok(html.includes('Planned points'));
  assert.ok(html.includes('10.0</td>'));
  assert.ok(!html.includes('data-session-id'));
});

test('Schedule matrix groups this week\'s timetable occurrences by date and marks assignees', () => {
  const { elements, context, run } = fixture();
  context.matrixEmployees = [
    { employee_id: 1, first_name: 'Ava', last_name: 'Nguyen', email: 'ava@example.test' },
    { employee_id: 2, first_name: 'Ben', last_name: 'Tran' },
  ];
  context.matrixOccurrences = [
    { recurring_series_id: 8, recurrence_date: '2026-11-16', session_date: '2026-11-16',
      program_name: 'Morning task', start_time: '09:00', end_time: '10:00', points: 3,
      status: 'scheduled', is_recurring: true,
      assignees: [{ employee_id: 1, first_name: 'Ava', last_name: 'Nguyen' }] },
    { recurring_series_id: 9, recurrence_date: '2026-11-17', session_date: '2026-11-17',
      program_name: 'Unassigned task', start_time: '14:00', end_time: '15:00', points: 4,
      status: 'scheduled', is_recurring: true, assignees: [] },
  ];
  run("scheduleWeekStart = '2026-11-16'; adminEmployees = matrixEmployees; sessionByOccurrence = new Map(matrixOccurrences.map(s => [`${s.recurring_series_id}:${s.recurrence_date}`, s])); renderTimetableEntries()");
  const html = elements.get('timetable-grid').innerHTML;
  assert.ok(html.includes('Mon 16 Nov'));
  assert.ok(html.includes('Tue 17 Nov'));
  assert.ok(html.includes('Morning task'));
  assert.ok(html.includes('09:00–10:00 · 3.0 pts'));
  assert.ok(html.includes('data-timetable-edit="8"'));
  assert.ok(html.includes('Ava Nguyen'));
  assert.ok(html.includes('Unassigned task'));
  assert.ok(html.includes('Unassigned'));
  assert.ok(html.includes('data-timetable-add="1"'));
  assert.ok(html.includes('data-timetable-add="2"'));
  assert.ok(html.includes('3.0</td>'));
  assert.ok(html.includes('4.0</td>'));
  assert.equal((html.match(/class="assignment-cell assigned/g) || []).length, 2);
});

test('shared grid retains dated totals and puts recurring definitions under unassigned', () => {
  const { run, context } = fixture();
  context.employees = [{ employee_id: 1, first_name: 'Active', last_name: 'Person' }];
  context.entries = [
    { employee_id: 1, session_date: '2026-11-16', status: 'scheduled', points: 5 },
    { employee_id: 1, session_date: '2026-11-16', status: 'completed', points: 3 },
  ];
  const dated = run("renderScheduleGrid(['2026-11-16'], employees, entries)");
  assert.ok(dated.includes('Earned points'));
  assert.ok(dated.includes('3.0</td>'));
  assert.ok(!dated.includes('data-timetable-add'));
  context.entries = [{ employee_id: 2, weekday: 1, series_id: 7, points: 4,
    first_name: 'Inactive', last_name: 'Person', program_name: 'Rule', start_date: '2026-11-01', effective_from: '2026-11-01' }];
  const timetable = run('renderScheduleGrid([1], employees, entries, true)');
  assert.ok(!timetable.includes('Inactive Person'));
  assert.ok(!timetable.includes('data-employee-id="2"'));
  assert.ok(timetable.includes('Unassigned'));
  assert.ok(timetable.includes('data-timetable-edit="7"'));
});

test('Plan timetable mode renders the shared weekly grid and switches back to dated sessions', async () => {
  const { elements, context, run } = fixture();
  context.entries = [{ weekday: 3, employee_id: null, series_id: 8, program_name: 'Weekly task',
    start_time: '09:00', points: 2, start_date: '2026-11-18', effective_from: '2026-11-18' }];
  run("currentUser = {isAdmin:true}; adminEmployees = []; api = async () => ({ok:true, json:async () => ({entries})}); setPlanViewMode('timetable')");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(elements.get('plan-sessions-panel').style.display, 'none');
  assert.equal(elements.get('plan-timetable-panel').style.display, 'block');
  assert.equal(elements.get('plan-mode-timetable').attributes.get('aria-pressed'), 'true');
  assert.ok(elements.get('plan-timetable-grid').innerHTML.includes('Weekly task'));
  run("setPlanViewMode('sessions')");
  assert.equal(elements.get('plan-sessions-panel').style.display, 'block');
  assert.equal(elements.get('plan-mode-sessions').attributes.get('aria-pressed'), 'true');
});

test('dragging onto a recurring Plan task changes only that dated occurrence', async () => {
  const { context, run } = fixture();
  context.testDates = ['2026-11-16'];
  context.testSessions = [{ recurring_series_id: 8, recurrence_date: '2026-11-16',
    session_date: '2026-11-16', employee_id: null,
    assignees: [{ employee_id: 1, first_name: 'One', last_name: 'Person' }],
    employee_ids: [1], program_id: 4, program_name: 'Weekly task',
    start_time: '09:00', end_time: '10:00', points: 2, status: 'scheduled' }];
  context.testEmployees = [{ employee_id: 1, first_name: 'One', last_name: 'Person' },
    { employee_id: 2, first_name: 'Two', last_name: 'Person' }];
  context.testPrograms = [{ program_id: 4, name: 'Weekly task' }];
  context.api = async (path, options) => {
    context.assignmentRequest = { path, body: JSON.parse(options.body) };
    return { ok: true };
  };
  context.loadPlanBoard = async () => {};
  context.loadMyTasks = async () => {};
  run('planDates = testDates; planSessions = testSessions; adminEmployees = testEmployees; adminPrograms = testPrograms');
  await run("onPersonDropped({item:{dataset:{employeeId:'2'}},to:{dataset:{seriesId:'8',recurrenceDate:'2026-11-16'}}})");
  assert.equal(context.assignmentRequest.path, '/api/admin/schedule/reassign');
  assert.equal(context.assignmentRequest.body.seriesId, 8);
  assert.equal(context.assignmentRequest.body.occurrenceDate, '2026-11-16');
  assert.equal(context.assignmentRequest.body.assigned, true);
});

test('recurring rule overlap check warns but allows intentional same-person conflicts', async () => {
  const { context, run } = fixture();
  context.existingRules = [{ series_id: 5, employee_id: 7, weekday: 1, start_time: '09:00',
    end_time: '10:00', start_date: '2026-11-02', effective_from: '2026-11-02',
    end_date: null, program_name: 'Existing duty' }];
  run("recurringEntries = existingRules; window.confirm = message => { window.warning = message; return false }");
  context.api = async () => ({ ok: true, json: async () => ({ entries: context.existingRules }) });
  const candidate = "{employeeId:7, weekday:1, startTime:'09:30', endTime:'10:30', startDate:'2026-11-16'}";
  assert.equal(await run(`confirmRecurringRuleConflict(${candidate})`), false);
  assert.match(context.window.warning, /Existing duty/);
  assert.equal(await run("confirmRecurringRuleConflict({employeeId:7, weekday:1, startTime:'10:00', endTime:'11:00', startDate:'2026-11-16'})"), true);
  assert.equal(await run(`confirmRecurringRuleConflict(${candidate}, 5)`), true);
});

test('new recurring rules remain unassigned and clear rule mode before one-off creation', () => {
  const { run, elements } = fixture();
  run("adminPrograms = [{program_id:1,default_points:5,default_start:'09:00',default_end:'10:00'}]; openRuleModal(2)");
  // A real select selects its first option automatically.
  elements.get('assign-program').value = '1';
  run('refreshAssignDefaults()');
  assert.equal(elements.get('assign-weekday').value, '2');
  assert.equal(elements.get('assign-start').value, '09:00');
  assert.equal(elements.get('assign-points').value, 5);
  assert.equal(elements.get('assign-points').readOnly, false);
  assert.equal(elements.get('assign-repeat-option').style.display, 'none');
  assert.equal(elements.get('assign-rule-start').required, true);
  run("closeModal(); openAssignModal(3, '2026-11-16')");
  assert.equal(elements.get('assign-rule-fields').style.display, 'none');
  assert.equal(elements.get('assign-rule-start').disabled, true);
  assert.equal(elements.get('assign-repeat-option').style.display, 'block');
  assert.equal(elements.get('assign-points').readOnly, true);
});

test('shared rule save uses series endpoints and validates date ranges without writes', async () => {
  const { run, context, elements } = fixture();
  const writes = [];
  context.record = body => writes.push(JSON.parse(body));
  run("api = async (path, options) => options ? (record(options.body), {ok:true}) : ({ok:true, json:async () => ({entries:[]})}); refreshScheduleViews = () => {}; openRuleModal(1)");
  elements.get('assign-weekday').value = '1';
  elements.get('assign-rule-start').value = '2026-11-16';
  elements.get('assign-rule-end').value = '2026-11-01';
  await run('saveTimetableRule({programId:1,points:5})');
  assert.equal(writes.length, 0);
  assert.match(elements.get('modal-error').textContent, /End date/);
  elements.get('assign-rule-end').value = '';
  await run('saveTimetableRule({programId:1,points:5})');
  assert.deepEqual(writes[0], { operation: 'create', programId: 1, points: 5,
    weekday: 1, employeeId: null, startDate: '2026-11-16', endDate: null });
  context.rule = {series_id:7,weekday:1,program_id:1,points:5,start_date:'2026-11-16',effective_from:'2099-01-01'};
  run('openRuleModal(1, rule)');
  elements.get('assign-weekday').value = '2';
  const pending = run('saveTimetableRule({programId:1,points:8})');
  submit(elements);
  await pending;
  assert.equal(writes[1].operation, 'edit');
  assert.equal(writes[1].seriesId, 7);
  assert.equal(writes[1].cutoffDate, '2099-01-01');
  assert.equal(writes[1].replaceFutureExceptions, false);
  assert.equal(writes[1].employeeId, null);
});

test('Plan shows multiple assignees and separates estimated from earned points', () => {
  const { context, elements, run } = fixture();
  context.testEmployees = [
    { employee_id: 1, first_name: 'One', last_name: 'Person' },
    { employee_id: 2, first_name: 'Two', last_name: 'Person' },
  ];
  context.testSessions = [{ session_date: '2026-11-16', program_name: 'Shared task',
    status: 'completed', points: 4, assignees: [{ employee_id: 1 }, { employee_id: 2 }] }];
  run('adminEmployees = testEmployees; planSessions = testSessions; renderPool()');
  const pool = elements.get('pool-chips').innerHTML;
  assert.equal((pool.match(/class="person-chip pool"/g) || []).length, 2);
  assert.equal((pool.match(/class="chip-pts">Est\. 4\.0/g) || []).length, 2);
  assert.equal((pool.match(/class="chip-earned">Earned 4\.0/g) || []).length, 2);
  run("planDates = ['2026-11-16']; planSessions = testSessions; renderPlanBoard()");
  const board = elements.get('plan-days').innerHTML;
  assert.ok(board.includes('One Person'));
  assert.ok(board.includes('Two Person'));
});

test('Plan renders timetable occurrences using their dated assignment links', () => {
  const { context, elements, run } = fixture();
  context.testEmployees = [
    { employee_id: 1, first_name: 'One', last_name: 'Person' },
    { employee_id: 2, first_name: 'Two', last_name: 'Person' },
  ];
  context.testSessions = [{ recurring_series_id: 8, recurrence_date: '2026-11-16',
    session_date: '2026-11-16', employee_id: 99, program_name: 'Weekly task',
    status: 'scheduled', points: 2, start_time: '09:00', end_time: '10:00', is_recurring: true,
    assignees: [{ employee_id: 1 }, { employee_id: 2 }] }];
  run("planDates = ['2026-11-16']; planSessions = testSessions; adminEmployees = testEmployees; renderPlanBoard()");
  const board = elements.get('plan-days').innerHTML;
  assert.ok(board.includes('Weekly task'));
  assert.ok(board.includes('Weekly'));
  assert.ok(board.includes('One Person'));
  assert.ok(board.includes('Two Person'));
  assert.ok(board.includes('data-series-id="8"'));
  assert.ok(board.includes('data-recurrence-date="2026-11-16"'));
  assert.ok(!board.includes('Unknown'));
});

test('dropping an assigned employee removes only that one-off occurrence link', async () => {
  const { context, run } = fixture();
  context.testSessions = [{ session_id: 42, session_date: '2026-11-16', employee_id: null,
    assignees: [{ employee_id: 3 }], employee_ids: [3], program_name: 'One-off', status: 'scheduled' }];
  context.api = async (path, options) => {
    context.assignmentRequest = { path, body: JSON.parse(options.body) };
    return { ok: true };
  };
  context.loadPlanBoard = async () => {};
  context.loadMyTasks = async () => {};
  run('planSessions = testSessions; adminEmployees = []; adminPrograms = []');
  await run("onPersonDropped({item:{dataset:{employeeId:'3'}},to:{dataset:{sessionId:'42'}}})");
  assert.deepEqual(JSON.parse(JSON.stringify(context.assignmentRequest.body)), {
    sessionId: 42, employeeId: 3, assigned: false,
  });
});

test('future changes preserve exceptions unless explicitly replaced', async () => {
  const { elements, run } = fixture();
  const pending = run("requestScheduleChange({title:'Edit', summary:'Before → after', date:'2099-01-01', allowReplace:true})");
  assert.equal(elements.get('schedule-change-replace').checked, false);
  assert.match(elements.get('schedule-change-impact').textContent, /be preserved/);
  submit(elements);
  assert.deepEqual(JSON.parse(JSON.stringify(await pending)), {
    scope: 'future', cutoffDate: '2099-01-01', replaceFutureExceptions: false,
  });
  const next = run("requestScheduleChange({title:'Edit', summary:'Change', date:'2099-01-02', allowReplace:true})");
  elements.get('schedule-change-replace').checked = true;
  input(elements);
  assert.match(elements.get('schedule-change-impact').textContent, /be replaced/);
  submit(elements);
  assert.equal((await next).replaceFutureExceptions, true);
});

test('occurrence scope uses the original date and cannot replace future exceptions', async () => {
  const { elements, run } = fixture();
  const pending = run("requestScheduleChange({title:'Move', summary:'Change', date:'2099-01-01', occurrenceDate:'2026-11-16', allowOccurrence:true, allowReplace:true})");
  elements.get('schedule-change-replace').checked = true;
  elements.get('schedule-change-scope').value = 'occurrence';
  input(elements);
  assert.equal(elements.get('schedule-change-date').disabled, true);
  assert.equal(elements.get('schedule-change-replace-wrap').style.display, 'none');
  assert.match(elements.get('schedule-change-impact').textContent, /Only 2026-11-16/);
  submit(elements);
  assert.deepEqual(JSON.parse(JSON.stringify(await pending)), {
    scope: 'occurrence', cutoffDate: '2026-11-16', replaceFutureExceptions: false,
  });
});

test('cancelling or escaping resolves without a change and restores focus', async () => {
  const { elements, focus, run } = fixture();
  for (const cancel of [() => elements.get('schedule-change-cancel').dispatchEvent(new Event('click')),
    () => elements.get('schedule-change-dialog').close()]) {
    const pending = run("requestScheduleChange({title:'End', summary:'Stop series'})");
    cancel();
    assert.equal(await pending, null);
    assert.equal(focus.focused, true);
  }
});

test('a second request cannot overwrite an open change dialog', async () => {
  const { elements, run } = fixture();
  const first = run("requestScheduleChange({title:'First', summary:'First change'})");
  assert.equal(await run("requestScheduleChange({title:'Second', summary:'Second change'})"), null);
  assert.equal(elements.get('schedule-change-title').textContent, 'First');
  elements.get('schedule-change-dialog').close();
  assert.equal(await first, null);
});
