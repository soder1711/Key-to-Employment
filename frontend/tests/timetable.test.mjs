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
  const context = vm.createContext({
    URLSearchParams, Date, console,
    window: { location: { search: '', hostname: 'localhost' } },
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
  for (const file of ['shared.js', 'schedule.js', 'session-modals.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  vm.runInContext('let planPeriod = null;', context);
  return { elements, context, focus, run: source => vm.runInContext(source, context) };
}

const submit = elements => elements.get('schedule-change-form').dispatchEvent(new Event('submit', { cancelable: true }));
const input = elements => elements.get('schedule-change-form').dispatchEvent(new Event('input'));

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

test('timetable reuses the people-by-weekday grid, sorts rules, and escapes task names', () => {
  const { elements, context, run } = fixture();
  const entry = { weekday: 1, employee_id: null, series_id: 1, program_name: '<img onerror=bad>',
    start_time: '10:00', end_time: '11:00', points: 5, start_date: '2026-11-01', effective_from: '2099-01-01' };
  context.entries = [entry, { ...entry, series_id: 2, start_time: '09:00', program_name: 'Earlier' }];
  run('recurringEntries = entries; renderTimetableEntries()');
  const html = elements.get('timetable-grid').innerHTML;
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

test('shared grid retains dated totals and keeps inactive-person rules visible', () => {
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
  assert.ok(timetable.includes('Inactive Person'));
  assert.ok(timetable.includes('data-employee-id="2"'));
  assert.ok(timetable.includes('data-timetable-edit="7"'));
});

test('rule creation reuses assignment defaults and clears rule mode before one-off creation', () => {
  const { run, elements } = fixture();
  run("adminPrograms = [{program_id:1,default_points:5,default_start:'09:00',default_end:'10:00'}]; openRuleModal(3, 2)");
  // A real select selects its first option automatically.
  elements.get('assign-program').value = '1';
  run('refreshAssignDefaults()');
  assert.equal(elements.get('assign-weekday').value, '2');
  assert.equal(elements.get('assign-employee').value, 3);
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
  run("api = async (path, options) => { record(options.body); return {ok:true}; }; refreshScheduleViews = () => {}; openRuleModal(null, 1)");
  elements.get('assign-weekday').value = '1';
  elements.get('assign-employee').value = '';
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
  run('openRuleModal(null, 1, rule)');
  elements.get('assign-weekday').value = '2';
  elements.get('assign-employee').value = '3';
  const pending = run('saveTimetableRule({programId:1,points:8})');
  submit(elements);
  await pending;
  assert.equal(writes[1].operation, 'edit');
  assert.equal(writes[1].seriesId, 7);
  assert.equal(writes[1].cutoffDate, '2099-01-01');
  assert.equal(writes[1].replaceFutureExceptions, false);
  assert.equal(writes[1].employeeId, 3);
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
