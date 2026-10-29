// ================= Configuration & shared helpers =================

const WORKER = 'https://task-portal.soder1234.workers.dev';

let currentUser = null;

async function api(path, opts = {}) {
  return fetch(`${WORKER}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function priorityBadge(priority) {
  const p = escapeHtml(priority || 'low');
  return `<span class="badge ${p}">${p}</span>`;
}

function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return `
    <div class="progress-row">
      <div class="progress"><div class="progress-fill" style="width:${p}%"></div></div>
      <span class="pct">${p}%</span>
    </div>`;
}

function statusPill(status) {
  return `<span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const pad2 = n => String(n).padStart(2, '0');
const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDue(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00Z');
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

// ================= Tasks (table view) =================

function renderMyTaskRow(t) {
  return `
    <tr>
      <td class="cell-task"><span class="task-name">${escapeHtml(t.title)}</span></td>
      <td>${priorityBadge(t.priority)}</td>
      <td>${statusPill(t.assignment_status)}</td>
      <td class="cell-due">${fmtDue(t.deadline)}</td>
      <td class="cell-progress">${progressBar(t.completion_percentage)}</td>
    </tr>`;
}

async function loadMyTasks() {
  const [tasksResult, planResult] = await Promise.all([
    api('/api/me/tasks'),
    api('/api/me/plan'),
  ]);
  const taskError = document.getElementById('project-tasks-error');
  const planError = document.getElementById('planned-tasks-error');

  let tasks = [];
  if (tasksResult.ok) {
    ({ tasks } = await tasksResult.json());
    taskError.style.display = 'none';
  } else {
    taskError.textContent = `Failed to load project tasks (${tasksResult.status}).`;
    taskError.style.display = 'block';
  }

  let planSessions = [];
  if (planResult.ok) {
    const data = await planResult.json();
    planSessions = data.sessions;
    document.getElementById('my-tasks-week').textContent = 'All dates';
    planError.style.display = 'none';
  } else {
    planError.textContent = `Failed to load Plan assignments (${planResult.status}).`;
    planError.style.display = 'block';
  }

  const tbody = document.getElementById('my-tasks');
  const empty = document.getElementById('my-tasks-empty');
  const rows = [
    ...tasks.map(renderMyTaskRow),
    ...planSessions.map(s => `
      <tr>
        <td class="cell-task"><span class="task-name">${escapeHtml(s.program_name)}</span></td>
        <td><span class="cat-tag ${escapeHtml(s.category)}">${escapeHtml(s.category)}</span></td>
        <td>${statusPill(s.status)}</td>
        <td class="cell-due">${fmtCellDate(s.session_date)} · ${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</td>
        <td class="cell-progress">${Number(s.points || 0).toFixed(1)} pts</td>
      </tr>`),
  ];
  if (!rows.length && tasksResult.ok && planResult.ok) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = rows.join('');
  }
  document.getElementById('my-tasks-section').style.display = 'block';
}

// ================= Sign-in / bootstrap =================

async function load() {
  const me = await api('/api/me');

  if (me.status === 401) {
    document.getElementById('signin-section').style.display = 'flex';
    document.getElementById('signin-link').href = `${WORKER}/auth/google`;
    return;
  }

  const user = await me.json();
  currentUser = user;
  document.getElementById('app').style.display = 'block';
  document.getElementById('user').textContent =
    user.email + (user.isAdmin ? ' (admin)' : '');

  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.style.display = 'inline-block';
  logoutBtn.addEventListener('click', () => {
    window.location.href = `${WORKER}/auth/logout`;
  });

  await loadMyTasks();

}

// ================= Schedule feature (dates & state) =================

let scheduleWeekStart = null;
let scheduleLoaded = false;
let schedMode = 'week';
let monthCursor = { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 };
let adminPrograms = [];
let adminEmployees = [];
let sessionById = new Map();
let modalEmployeeId = null;
let modalDate = null;
let currentSession = null;

function mondayOf(dateStr) {
  const base = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayISO();
  const d = new Date(base + 'T00:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function shiftISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtTime(t) { return t ? String(t).slice(0, 5) : '—'; }

function fmtShort(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

function fmtCellDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const today = iso === todayISO() ? ' · today' : '';
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}${today}`;
}

function fmtDayHeader(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `<span class="day-name">${DAY_NAMES[d.getUTCDay()]}</span>` +
         `<span class="day-num">${d.getUTCDate()}</span>` +
         `<span class="day-mon">${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}</span>`;
}

// ---------- View switching ----------

function switchView(view) {
  const showTasks = view === 'tasks';
  const showPlan = view === 'plan';

  document.getElementById('nav-tasks').classList.toggle('active', showTasks);
  document.getElementById('nav-plan').classList.toggle('active', showPlan);

  document.getElementById('my-tasks-section').style.display = showTasks ? 'block' : 'none';
  document.getElementById('plan-section').style.display =
    showPlan ? 'block' : 'none';
  document.getElementById('plan-admin-tag').style.display =
    currentUser?.isAdmin ? 'inline-block' : 'none';
  document.getElementById('plan-admin-hint').style.display =
    currentUser?.isAdmin ? 'block' : 'none';
  document.getElementById('plan-viewer-hint').style.display =
    currentUser?.isAdmin ? 'none' : 'block';
  document.getElementById('people-pool').style.display =
    currentUser?.isAdmin ? 'flex' : 'none';

  if (showPlan && !planLoaded) initPlan();
  if (showTasks) loadMyTasks();
}

function initSchedule() {
  scheduleWeekStart = mondayOf();
  scheduleLoaded = true;
  setSchedMode('week');
}

function setSchedMode(mode) {
  schedMode = mode;
  document.getElementById('sched-week-btn').classList.toggle('ghost', mode !== 'week');
  document.getElementById('sched-month-btn').classList.toggle('ghost', mode !== 'month');

  document.getElementById('week-controls').style.display = mode === 'week' ? 'flex' : 'none';
  document.getElementById('month-controls').style.display = mode === 'month' ? 'flex' : 'none';
  document.getElementById('month-view-wrap').style.display = mode === 'month' ? 'block' : 'none';
  document.getElementById('schedule-role-tag').style.display =
    currentUser?.isAdmin ? 'inline-block' : 'none';
  document.getElementById('worker-schedule-wrap').style.display =
    mode === 'week' && !currentUser?.isAdmin ? 'block' : 'none';
  document.getElementById('admin-schedule-wrap').style.display =
    mode === 'week' && currentUser?.isAdmin ? 'block' : 'none';

  if (mode === 'week') {
    refreshWeek();
  } else {
    const mid = new Date(shiftISO(scheduleWeekStart, 3) + 'T00:00:00Z');
    monthCursor = { year: mid.getUTCFullYear(), month: mid.getUTCMonth() + 1 };
    loadMonthView();
  }
}

function refreshWeek() {
  if (currentUser?.isAdmin) loadAdminSchedule();
  else loadMySchedule();
}

// ---------- Worker week ----------

async function loadMySchedule() {
  const res = await api(`/api/schedule?start=${scheduleWeekStart}`);
  if (!res.ok) return;
  const data = await res.json();
  scheduleWeekStart = data.weekStart;

  document.getElementById('sched-week-label').textContent =
    `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;

  const tbody = document.getElementById('my-schedule-body');
  const empty = document.getElementById('my-schedule-empty');
  const visible = data.sessions.filter(s => s.status !== 'cancelled');

  if (!data.sessions.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = data.sessions.map(s => `
      <tr${s.status === 'cancelled' ? ' class="cancelled-row"' : ''}>
        <td>${fmtCellDate(s.session_date)}</td>
        <td>${escapeHtml(s.program_name)}${s.is_sudden ? ' <span class="mini-tag sudden">sudden</span>' : ''}</td>
        <td><span class="cat-tag ${escapeHtml(s.category)}">${escapeHtml(s.category)}</span></td>
        <td>${s.start_time ? fmtTime(s.start_time) : '—'}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</td>
        <td class="pts">${Number(s.points).toFixed(1)}</td>
        <td><span class="status-pill ${s.status}">${s.status}</span></td>
      </tr>`).join('');
  }

  const done = data.sessions.filter(s => s.status === 'completed');
  const earned = done.reduce((a, s) => a + Number(s.points), 0);
  const planned = visible.reduce((a, s) => a + Number(s.points), 0);

  document.getElementById('my-week-totals').innerHTML = `
    <div class="totals-row">
      <span>Sessions: <strong>${visible.length}</strong></span>
      <span>Completed: <strong>${done.length}</strong></span>
      <span>Points earned: <strong>${earned.toFixed(1)}</strong></span>
      <span>If all done: <strong>${planned.toFixed(1)}</strong></span>
    </div>
    ${renderMonthProgress(data.summary,
      data.summaryMonth ? MONTH_NAMES[data.summaryMonth.month - 1] : '')}`;
}

function renderMonthProgress(summary, label) {
  if (!summary) return '';
  const earned = Number(summary.completed_points || 0);
  const target = Number(summary.target_points || 0);
  const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
  const excess = target > 0 ? Math.max(0, earned - target) : 0;
  const labelTxt = label ? `${label}: ` : '';
  const footer = target > 0
    ? (excess > 0
        ? `<div class="mp-excess">Excess above target: +${excess.toFixed(1)} pts</div>`
        : `<div class="mp-remaining">${(target - earned).toFixed(1)} pts remaining to target</div>`)
    : '<div class="mp-remaining">No monthly target set</div>';
  return `
    <div class="month-progress">
      <div class="mp-label">${labelTxt}<strong>${earned.toFixed(1)}</strong> / ${target.toFixed(1)} credited pts ·
        ${summary.completed_sessions || 0} of ${summary.total_sessions || 0} sessions completed</div>
      ${progressBar(pct)}
      ${footer}
    </div>`;
}

// ---------- Admin week grid ----------

async function loadAdminSchedule() {
  const res = await api(`/api/admin/schedule?start=${scheduleWeekStart}`);
  if (!res.ok) {
    document.getElementById('sched-week-label').textContent = 'Failed to load schedule';
    return;
  }
  const data = await res.json();
  scheduleWeekStart = data.weekStart;
  adminPrograms = data.programs;
  adminEmployees = data.employees;
  sessionById = new Map(data.sessions.map(s => [s.session_id, s]));

  document.getElementById('sched-week-label').textContent =
    `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;

  const byEmp = {};
  for (const s of data.sessions) {
    if (s.employee_id == null) continue;
    (byEmp[s.employee_id] ??= {});
    (byEmp[s.employee_id][s.session_date] ??= []).push(s);
  }

  const today = todayISO();
  let html = '<thead><tr><th class="sticky-col">Employee</th>';
  for (const d of data.dates) {
    const wd = new Date(d + 'T00:00:00Z').getUTCDay();
    const cls = (d === today ? ' today' : '') + (wd === 0 || wd === 6 ? ' weekend' : '');
    html += `<th class="day-head${cls}">${fmtDayHeader(d)}</th>`;
  }
  html += '<th class="pts-head">Pts</th></tr></thead><tbody>';

  for (const emp of data.employees) {
    const name = `${emp.first_name} ${emp.last_name}`.trim();
    html += `<tr><td class="sticky-col emp-cell" title="${escapeHtml(emp.email)}">${escapeHtml(name)}</td>`;
    let weekPts = 0;
    for (const d of data.dates) {
      const list = (byEmp[emp.employee_id] || {})[d] || [];
      weekPts += list.filter(s => s.status === 'completed')
                     .reduce((a, s) => a + Number(s.points), 0);
      const chips = list.map(s => `
        <span class="slot-chip ${s.status}${s.is_sudden ? ' sudden' : ''}"
              data-session-id="${s.session_id}"
              title="${escapeHtml(s.program_name)} · ${fmtTime(s.start_time)} · ${Number(s.points).toFixed(1)} pts · ${s.status}">
          ${escapeHtml(s.program_code)}${s.start_time ? ' ' + fmtTime(s.start_time) : ''}
        </span>`).join('');
      html += `<td class="grid-cell${list.length ? ' has' : ''}${d === today ? ' today' : ''}"
                  data-employee-id="${emp.employee_id}" data-date="${d}">${chips}</td>`;
    }
    html += `<td class="pts-cell">${weekPts ? weekPts.toFixed(1) : ''}</td></tr>`;
  }
  document.getElementById('admin-schedule-grid').innerHTML = html + '</tbody>';
}

// ---------- Month view ----------

async function loadMonthView() {
  if (currentUser?.isAdmin) await loadAdminMonth();
  else await loadWorkerMonth();
}

async function loadAdminMonth() {
  const { year, month } = monthCursor;
  document.getElementById('month-label').textContent = `${MONTH_NAMES[month - 1]} ${year}`;
  const res = await api(`/api/admin/schedule/monthly?year=${year}&month=${month}`);
  if (!res.ok) return;
  const { rows } = await res.json();
  const wrap = document.getElementById('month-summary-wrap');

  if (!rows.length) {
    wrap.innerHTML = '<div class="empty">No active employees.</div>';
    return;
  }
  wrap.innerHTML = `<table class="month-table">
    <thead><tr>
      <th>Employee</th><th>Sched.</th><th>Done</th><th>Points</th>
      <th>Target</th><th>Progress</th><th>Excess</th>
    </tr></thead>
    <tbody>${rows.map(r => {
      const earned = Number(r.completed_points);
      const target = Number(r.target_points);
      const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
      const excess = target > 0 ? Math.max(0, earned - target) : 0;
      return `<tr>
        <td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
        <td>${r.scheduled_sessions}</td>
        <td>${r.completed_sessions}</td>
        <td class="pts">${earned.toFixed(1)}</td>
        <td><input type="number" min="0" step="1" class="target-input"
                   data-employee-id="${r.employee_id}" value="${target}"></td>
        <td style="min-width:150px">${progressBar(pct)}</td>
        <td>${excess > 0 ? '+' + excess.toFixed(1) : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function loadWorkerMonth() {
  const { year, month } = monthCursor;
  document.getElementById('month-label').textContent = `${MONTH_NAMES[month - 1]} ${year}`;
  const probe = mondayOf(`${year}-${pad2(month)}-01`);
  const res = await api(`/api/schedule?start=${probe}&year=${year}&month=${month}`);
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById('month-summary-wrap').innerHTML =
    data.summary ? renderMonthProgress(data.summary, '') : '';
}

function shiftMonth(delta) {
  let m = monthCursor.month + delta;
  let y = monthCursor.year;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  monthCursor = { year: y, month: m };
  loadMonthView();
}

// ================= Plan board (drag & drop, one table per day) =================

let planWeekStart = null;
let planLoaded = false;
let planDates = [];
let planSessions = [];
let planPeriod = null;
const planSortables = [];

function planEmployeeName(id) {
  const e = adminEmployees.find(x => x.employee_id === id);
  return e ? `${e.first_name} ${e.last_name}`.trim() : 'Unknown';
}

function renderPool() {
  const pts = new Map();
  for (const s of planSessions) {
    if (s.status === 'cancelled' || s.employee_id == null) continue;
    pts.set(s.employee_id, (pts.get(s.employee_id) || 0) + Number(s.points || 0));
  }
  document.getElementById('pool-chips').innerHTML = adminEmployees.map(e => {
    const name = `${e.first_name} ${e.last_name}`.trim();
    const p = (pts.get(e.employee_id) || 0).toFixed(1);
    return `
      <span class="person-chip pool" data-employee-id="${e.employee_id}"
            title="${escapeHtml(name)} — ${p} points this week">
        ${escapeHtml(name)}<span class="chip-pts">${p}</span>
      </span>`;
  }).join('') || '<span class="empty">No active employees.</span>';
}

function planCells(s) {
  if (!s) return '<td></td><td></td><td></td>';
  const personName = s.employee_id != null
    ? adminEmployees.length
      ? planEmployeeName(s.employee_id)
      : `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Assigned'
    : null;
  const person = s.employee_id != null
    ? `<span class="person-chip assigned" data-employee-id="${s.employee_id}"
              data-session-id="${s.session_id}"
              title="${currentUser?.isAdmin ? 'Click for options — drop a new name here to replace' : ''}">
         ${escapeHtml(personName)}</span>`
    : currentUser?.isAdmin
      ? '<span class="drop-here">Drop person here</span>'
      : '<span class="unassigned">Unassigned</span>';
  return `
    <td class="cell-task">
      <button type="button" class="task-link" data-session-id="${s.session_id}"
              title="Click for options">${escapeHtml(s.program_name)}</button>
      ${s.is_sudden ? '<span class="mini-tag sudden">sudden</span>' : ''}
      <span class="task-sub">${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</span>
    </td>
    <td class="cell-pts">${Number(s.points || 0).toFixed(1)}</td>
    <td class="cell-person-slot" data-session-id="${s.session_id}">${person}</td>`;
}

function renderDayTable(date) {
  const daySessions = planSessions
    .filter(s => s.session_date === date && s.status !== 'cancelled');
  const morning = daySessions.filter(s => (s.start_time || '09:00') < '12:00');
  const afternoon = daySessions.filter(s => (s.start_time || '09:00') >= '12:00');
  const total = list =>
    list.reduce((a, s) => a + Number(s.points || 0), 0).toFixed(1);
  const d = new Date(date + 'T00:00:00Z');
  const isToday = date === todayISO();

  let body = '';
  if (!morning.length && !afternoon.length) {
    body = `
      <tr>
        <td colspan="3" class="no-tasks">No tasks yet</td>
        <td colspan="3" class="no-tasks">No tasks yet</td>
      </tr>`;
  } else {
    const rows = Math.max(morning.length, afternoon.length);
    for (let i = 0; i < rows; i++) {
      body += `<tr>${planCells(morning[i])}${planCells(afternoon[i])}</tr>`;
    }
  }
  if (currentUser?.isAdmin) body += `
    <tr class="add-row">
      <td colspan="3"><button type="button" class="add-task-btn"
            data-date="${date}" data-period="morning">+ Add task…</button></td>
      <td colspan="3"><button type="button" class="add-task-btn"
            data-date="${date}" data-period="afternoon">+ Add task…</button></td>
    </tr>`;
  body += `
    <tr class="total-row">
      <td colspan="2" class="total-label">Points total</td>
      <td class="cell-pts">${total(morning)}</td>
      <td colspan="2" class="total-label">Points total</td>
      <td class="cell-pts">${total(afternoon)}</td>
    </tr>`;

  return `
    <div class="day-block${isToday ? ' today' : ''}">
      <div class="day-block-head">
        <span class="db-day">${DAY_NAMES[d.getUTCDay()]}</span>
        <span class="db-date">${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}</span>
        ${isToday ? '<span class="mini-tag today-tag">today</span>' : ''}
      </div>
      <div class="table-scroll">
        <table class="plan-table">
          <colgroup>
            <col class="col-task"><col class="col-pts"><col class="col-person">
            <col class="col-task"><col class="col-pts"><col class="col-person">
          </colgroup>
          <thead>
            <tr>
              <th colspan="3" class="period-head morning">Morning</th>
              <th colspan="3" class="period-head afternoon">Afternoon and evening</th>
            </tr>
            <tr class="col-heads">
              <th>Task</th><th>Points</th><th>Person</th>
              <th>Task</th><th>Points</th><th>Person</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

function renderPlanBoard() {
  renderPool();
  document.getElementById('plan-days').innerHTML =
    planDates.map(renderDayTable).join('');
  initPlanSortables();
}

function destroyPlanSortables() {
  while (planSortables.length) {
    try { planSortables.pop().destroy(); } catch { /* ignore */ }
  }
}

function initPlanSortables() {
  destroyPlanSortables();
  if (!currentUser?.isAdmin || typeof Sortable === 'undefined') return;

  const pool = document.getElementById('pool-chips');
  if (pool) {
    planSortables.push(new Sortable(pool, {
      group: { name: 'people', pull: 'clone', put: false },
      sort: false,
      draggable: '.person-chip',
    }));
  }
  document.querySelectorAll('.cell-person-slot').forEach(cell => {
    planSortables.push(new Sortable(cell, {
      group: { name: 'people', pull: false, put: true },
      sort: false,
      draggable: '.person-chip',
      onAdd: onPersonDropped,
    }));
  });
}

async function onPersonDropped(evt) {
  const employeeId = Number(evt.item.dataset.employeeId);
  const sessionId = Number(evt.to.dataset.sessionId);
  if (!Number.isInteger(employeeId) || !Number.isInteger(sessionId)) {
    renderPlanBoard();
    return;
  }
  try {
    const res = await api('/api/admin/schedule/reassign', {
      method: 'POST',
      body: JSON.stringify({ sessionId, employeeId }),
    });
    if (!res.ok) alert('Could not assign person: ' + (await res.text()));
  } catch (err) {
    alert('Network error: ' + err.message);
  }
  await loadPlanBoard(); // always re-render from saved data
  await loadMyTasks();
}

async function loadPlanBoard() {
  const errEl = document.getElementById('plan-error');
  const path = currentUser?.isAdmin
    ? `/api/admin/schedule?start=${planWeekStart}`
    : `/api/plan?start=${planWeekStart}`;
  const res = await api(path);
  if (!res.ok) {
    errEl.textContent = `Failed to load plan (${res.status}).`;
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  const data = await res.json();
  planWeekStart = data.weekStart;
  planDates = data.dates;
  planSessions = data.sessions;
  adminEmployees = data.employees || [];
  adminPrograms = data.programs || [];
  sessionById = new Map(data.sessions.map(s => [s.session_id, s]));
  document.getElementById('plan-week-label').textContent =
    `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;
  renderPlanBoard();
}

function initPlan() {
  planLoaded = true;
  planWeekStart = mondayOf();
  loadPlanBoard();
}

function refreshScheduleViews() {
  loadPlanBoard();
  loadMyTasks();
}

function openPlanAddModal(date, period) {
  planPeriod = period;
  modalEmployeeId = null; // person is added afterwards by dragging
  modalDate = date;
  document.getElementById('modal-title').textContent = 'Add task';
  document.getElementById('assign-context').textContent =
    `${fmtCellDate(date)} · ${period === 'morning' ? 'Morning' : 'Afternoon and evening'}` +
    ' — drag a person onto the task afterwards';
  populatePrograms();
  document.getElementById('assign-sudden').checked = false;
  document.getElementById('assign-notes').value = '';
  refreshAssignDefaults();
  openModal('assign');
}

// ================= Modal =================

const modal = document.getElementById('session-modal');

function openModal(which) {
  document.getElementById('modal-assign-form').style.display = which === 'assign' ? 'block' : 'none';
  document.getElementById('modal-details').style.display = which === 'details' ? 'block' : 'none';
  document.getElementById('modal-error').style.display = 'none';
  modal.style.display = 'flex';
}

function closeModal() {
  modal.style.display = 'none';
  currentSession = null;
}

function showModalError(msg) {
  const el = document.getElementById('modal-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function populatePrograms() {
  const sel = document.getElementById('assign-program');
  sel.innerHTML = adminPrograms.map(p =>
    `<option value="${p.program_id}">${escapeHtml(p.code)} — ${escapeHtml(p.name)} ` +
    `(${escapeHtml(p.category)}, ${Number(p.default_points).toFixed(1)} pts)</option>`).join('');
}

function refreshAssignDefaults() {
  const sel = document.getElementById('assign-program');
  const p = adminPrograms.find(x => x.program_id === Number(sel.value));
  if (!p) return;

  let start = p.default_start || '';
  let end = p.default_end || '';
  if (planPeriod) {
    const fallback = planPeriod === 'morning' ? ['09:00', '10:00'] : ['14:00', '15:00'];
    const wrongPeriod = start && ((planPeriod === 'morning' && start >= '12:00') ||
                                  (planPeriod === 'afternoon' && start < '12:00'));
    if (!start || wrongPeriod) { start = fallback[0]; end = fallback[1]; }
  }
  document.getElementById('assign-start').value = start;
  document.getElementById('assign-end').value = end;

  // Automatic: program default points, doubled for sudden sessions
  const pts = Number(p.default_points || 0) *
    (document.getElementById('assign-sudden').checked ? 2 : 1);
  const ptsInput = document.getElementById('assign-points');
  ptsInput.value = pts;
  ptsInput.readOnly = true;
}

function openAssignModal(employeeId, date) {
  planPeriod = null;
  modalEmployeeId = employeeId;
  modalDate = date;
  const emp = adminEmployees.find(e => e.employee_id === employeeId);
  document.getElementById('modal-title').textContent = 'Assign session';
  document.getElementById('assign-context').textContent =
    `${emp ? `${emp.first_name} ${emp.last_name}` : `Employee #${employeeId}`} — ${fmtCellDate(date)}`;
  populatePrograms();
  document.getElementById('assign-sudden').checked = false;
  document.getElementById('assign-notes').value = '';
  refreshAssignDefaults();
  openModal('assign');
}

function openDetailsModal(sessionId) {
  const s = sessionById.get(sessionId);
  if (!s) return;
  currentSession = s;
  const person = s.first_name
    ? `${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}`
    : '<em>Unassigned</em>';
  document.getElementById('modal-title').textContent = 'Task details';
  document.getElementById('modal-actions').style.display =
    currentUser?.isAdmin ? 'flex' : 'none';
  document.getElementById('detail-info').innerHTML = `
    <strong>${escapeHtml(s.program_name)}</strong> (${escapeHtml(s.category)})<br>
    ${person} · ${fmtCellDate(s.session_date)}<br>
    ${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''} ·
    ${Number(s.points).toFixed(1)} pts${s.is_sudden ? ' · sudden' : ''} ·
    <span class="status-pill ${s.status}">${s.status}</span>
    ${s.notes ? `<br>Notes: ${escapeHtml(s.notes)}` : ''}`;
  openModal('details');
}

// ================= Event wiring =================

// ---- Navigation & view switching ----
document.getElementById('nav-tasks').addEventListener('click', () => switchView('tasks'));
document.getElementById('nav-plan').addEventListener('click', () => switchView('plan'));

// ---- Plan board navigation ----
document.getElementById('plan-prev').addEventListener('click', () => {
  planWeekStart = shiftISO(planWeekStart, -7); loadPlanBoard();
});
document.getElementById('plan-next').addEventListener('click', () => {
  planWeekStart = shiftISO(planWeekStart, 7); loadPlanBoard();
});
document.getElementById('plan-today').addEventListener('click', () => {
  planWeekStart = mondayOf(); loadPlanBoard();
});

// ---- Plan board clicks ----
document.getElementById('plan-days').addEventListener('click', (e) => {
  const addBtn = e.target.closest('.add-task-btn');
  if (addBtn && currentUser?.isAdmin) {
    openPlanAddModal(addBtn.dataset.date, addBtn.dataset.period);
    return;
  }
  const taskLink = e.target.closest('.task-link');
  if (taskLink) { openDetailsModal(Number(taskLink.dataset.sessionId)); return; }
  const chip = e.target.closest('.person-chip.assigned');
  if (chip) openDetailsModal(Number(chip.dataset.sessionId));
});

// ---- Modal wiring ----
document.getElementById('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.getElementById('assign-program').addEventListener('change', refreshAssignDefaults);
document.getElementById('assign-sudden').addEventListener('change', refreshAssignDefaults);

document.getElementById('assign-submit').addEventListener('click', async (e) => {
  const btn = e.target;
  btn.disabled = true;
  try {
    const res = await api('/api/admin/schedule/assign', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: modalEmployeeId,
        date: modalDate,
        programId: Number(document.getElementById('assign-program').value),
        startTime: document.getElementById('assign-start').value || null,
        endTime: document.getElementById('assign-end').value || null,
        points: Number(document.getElementById('assign-points').value),
        isSudden: document.getElementById('assign-sudden').checked,
        notes: document.getElementById('assign-notes').value || null,
      }),
    });
    if (!res.ok) {
      showModalError('Save failed: ' + (await res.text()));
    } else {
      closeModal();
      refreshScheduleViews();
    }
  } catch (err) {
    showModalError('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

document.querySelectorAll('#modal-details [data-status]').forEach(b => {
  b.addEventListener('click', async () => {
    if (!currentSession) return;
    const res = await api('/api/admin/schedule/status', {
      method: 'POST',
      body: JSON.stringify({ sessionId: currentSession.session_id, status: b.dataset.status }),
    });
    if (res.ok) { closeModal(); refreshScheduleViews(); }
    else alert('Status update failed');
  });
});

document.getElementById('session-delete').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm('Delete this task? The deletion is recorded in history.')) return;
  const res = await api('/api/admin/schedule/delete', {
    method: 'POST',
    body: JSON.stringify({ sessionId: currentSession.session_id }),
  });
  if (res.ok) { closeModal(); refreshScheduleViews(); }
  else alert('Delete failed');
});

// ================= Boot =================

load();