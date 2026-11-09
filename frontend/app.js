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
  const start = planWeekStart || mondayOf();
  const [tasksResult, planResult] = await Promise.all([
    api('/api/me/tasks'),
    api(`/api/schedule?start=${start}`),
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
    planSessions = data.sessions.filter(s => s.status !== 'cancelled');
    planWeekStart = data.weekStart;
    document.getElementById('my-tasks-week').textContent =
      `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;
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

  if (user.isAdmin) {
    document.getElementById('nav-plan').style.display = 'inline-block';
  }
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
  const showSchedule = view === 'schedule';
  const showPlan = view === 'plan';

  document.getElementById('nav-tasks').classList.toggle('active', showTasks);
  document.getElementById('nav-schedule').classList.toggle('active', showSchedule);
  document.getElementById('nav-plan').classList.toggle('active', showPlan);

  document.getElementById('my-tasks-section').style.display = showTasks ? 'block' : 'none';
  document.getElementById('schedule-section').style.display = showSchedule ? 'block' : 'none';
  document.getElementById('plan-section').style.display =
    showPlan && currentUser?.isAdmin ? 'block' : 'none';

  if (showPlan && !planLoaded) initPlan();
  if (showTasks) loadMyTasks();
  if (showSchedule) {
    if (!scheduleLoaded) {
      scheduleWeekStart = mondayOf();
      scheduleLoaded = true;
    }
    loadSchedule();
  }
}

function loadSchedule() {
  const isAdmin = currentUser?.isAdmin;
  document.getElementById('admin-schedule-hint').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('admin-schedule-wrap').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('worker-schedule-wrap').style.display = isAdmin ? 'none' : 'block';
  document.getElementById('my-schedule-empty').style.display = 'none';
  document.getElementById('my-week-totals').style.display = isAdmin ? 'none' : 'block';
  if (isAdmin) loadAdminSchedule();
  else loadMySchedule();
}

// ---------- Worker week ----------

async function loadMySchedule() {
  const tbody = document.getElementById('my-schedule-body');
  const empty = document.getElementById('my-schedule-empty');
  const error = document.getElementById('schedule-error');
  const totals = document.getElementById('my-week-totals');

  try {
    const res = await api(`/api/schedule?start=${scheduleWeekStart}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    scheduleWeekStart = data.weekStart;
    document.getElementById('schedule-week-label').textContent =
      `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;
    error.style.display = 'none';

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
          <td><span class="status-pill ${escapeHtml(s.status)}">${escapeHtml(s.status)}</span></td>
        </tr>`).join('');
    }

    const done = data.sessions.filter(s => s.status === 'completed');
    const earned = done.reduce((a, s) => a + Number(s.points), 0);
    const planned = visible.reduce((a, s) => a + Number(s.points), 0);

    totals.innerHTML = `
      <div class="totals-row">
        <span>Sessions: <strong>${visible.length}</strong></span>
        <span>Completed: <strong>${done.length}</strong></span>
        <span>Points earned: <strong>${earned.toFixed(1)}</strong></span>
        <span>If all done: <strong>${planned.toFixed(1)}</strong></span>
      </div>
      ${renderMonthProgress(data.summary,
        data.summaryMonth ? MONTH_NAMES[data.summaryMonth.month - 1] : '')}`;
  } catch (err) {
    tbody.innerHTML = '';
    empty.style.display = 'none';
    totals.innerHTML = '';
    error.textContent = `Failed to load schedule: ${err.message}`;
    error.style.display = 'block';
  }
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

function slotChipHtml(s) {
  return `
    <span class="slot-chip ${escapeHtml(s.status)}${s.is_sudden ? ' sudden' : ''}"
          data-session-id="${s.session_id}"
          title="${escapeHtml(s.program_name)} · ${fmtTime(s.start_time)} · ${Number(s.points).toFixed(1)} pts · ${escapeHtml(s.status)}">
      ${escapeHtml(s.program_code)}${s.start_time ? ' ' + fmtTime(s.start_time) : ''}
    </span>`;
}

async function loadAdminSchedule() {
  const error = document.getElementById('schedule-error');
  try {
    const res = await api(`/api/admin/schedule?start=${scheduleWeekStart}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    scheduleWeekStart = data.weekStart;
    adminPrograms = data.programs;
    adminEmployees = data.employees;
    sessionById = new Map(data.sessions.map(s => [s.session_id, s]));

    document.getElementById('schedule-week-label').textContent =
      `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;
    error.style.display = 'none';

    const byEmp = {};
    const unassigned = {};
    for (const s of data.sessions) {
      if (s.employee_id == null) {
        // Repeated tasks without a person yet: kept separately so they stay
        // visible in the schedule grid (Unassigned row) instead of vanishing.
        (unassigned[s.session_date] ??= []).push(s);
        continue;
      }
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
        html += `<td class="grid-cell${list.length ? ' has' : ''}${d === today ? ' today' : ''}"
                    data-employee-id="${emp.employee_id}" data-date="${d}">
                   ${list.map(slotChipHtml).join('')}</td>`;
      }
      html += `<td class="pts-cell">${weekPts ? weekPts.toFixed(1) : ''}</td></tr>`;
    }

    // Unassigned row: repeated tasks that have no person yet still show up here
    if (Object.keys(unassigned).length) {
      html += `<tr><td class="sticky-col unassigned">Unassigned</td>`;
      for (const d of data.dates) {
        const list = unassigned[d] || [];
        html += `<td class="grid-cell${list.length ? ' has' : ''}${d === today ? ' today' : ''}"
                    data-date="${d}">${list.map(slotChipHtml).join('')}</td>`;
      }
      html += `<td class="pts-cell"></td></tr>`;
    }

    document.getElementById('admin-schedule-grid').innerHTML = html + '</tbody>';
  } catch (err) {
    error.textContent = `Failed to load schedule: ${err.message}`;
    error.style.display = 'block';
  }
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

// ================= Plan board (drag & drop, ONE day at a time) =================

let planWeekStart = null;   // Monday of the week currently loaded from the API
let planDayCursor = null;   // the single day currently displayed
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
  const person = s.employee_id != null
    ? `<span class="person-chip assigned" data-employee-id="${s.employee_id}"
              data-session-id="${s.session_id}"
              title="Click for options — drop a new name here to replace">
         ${escapeHtml(planEmployeeName(s.employee_id))}</span>`
    : '<span class="drop-here">Drop person here</span>';
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
  // Automatic allocation: a task belongs to Morning or Afternoon and evening
  // purely based on its start time (< 12:00 = morning). No stored period.
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
  body += `
    <tr class="add-row">
      <td colspan="3"><button type="button" class="add-task-btn"
            data-date="${date}" data-period="morning">+ Add task…</button></td>
      <td colspan="3"><button type="button" class="add-task-btn"
            data-date="${date}" data-period="afternoon">+ Add task…</button></td>
    </tr>
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

// Shows which single day is on screen, e.g. "Mon 2 November 2026"
function updatePlanDayLabel() {
  const el = document.getElementById('plan-day-label');
  if (!el || !planDayCursor) return;
  const d = new Date(planDayCursor + 'T00:00:00Z');
  el.textContent =
    `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ` +
    `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Renders ONLY the day under planDayCursor (one table at a time)
function renderPlanBoard() {
  renderPool();
  let day = planDates.includes(planDayCursor) ? planDayCursor
    : (planDates.includes(todayISO()) ? todayISO() : planDates[0]);
  if (!day) return;
  planDayCursor = day;
  document.getElementById('plan-days').innerHTML = renderDayTable(day);
  updatePlanDayLabel();
  initPlanSortables();
}

// Jump to any day; loads that day's week when it crosses a week boundary
async function goToPlanDay(date) {
  if (!date) return;
  planDayCursor = date;
  const weekOfDate = mondayOf(date);
  try {
    if (weekOfDate !== planWeekStart) {
      planWeekStart = weekOfDate;
      await loadPlanBoard(); // renders after the new week is fetched
    } else {
      renderPlanBoard(); // same week, no network needed
    }
  } catch (err) {
    const errEl = document.getElementById('plan-error');
    errEl.textContent = `Failed to load plan: ${err.message}`;
    errEl.style.display = 'block';
  }
}

function shiftPlanDay(delta) {
  if (!planDayCursor) return;
  goToPlanDay(shiftISO(planDayCursor, delta));
}

function destroyPlanSortables() {
  while (planSortables.length) {
    try { planSortables.pop().destroy(); } catch { /* ignore */ }
  }
}

function initPlanSortables() {
  destroyPlanSortables();
  if (typeof Sortable === 'undefined') return; // SortableJS failed to load

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

  // Ask about applying the same person to the following weeks
  try {
    const res = await api(`/api/admin/schedule/following?sessionId=${sessionId}`);
    if (!res.ok) return;
    const { following } = await res.json();
    if (!following || !following.length) return;
    const name = planEmployeeName(employeeId);
    pendingApply = { sessionId, employeeId };
    const withPerson = following.filter(s => s.employee_id != null).length;
    document.getElementById('apply-context').innerHTML =
      `You put <strong>${escapeHtml(name)}</strong> on this week's task. ` +
      `There ${following.length === 1 ? 'is <strong>1</strong> similar task' : `are <strong>${following.length}</strong> similar tasks`} ` +
      `in following weeks (same task, same time, same weekday)` +
      `${withPerson ? `, ${withPerson} of which already ${withPerson === 1 ? 'has a person' : 'have a person'}` : ''}. ` +
      `Apply ${escapeHtml(name)} there too?`;
    document.getElementById('apply-override').checked = false;
    applyModal.style.display = 'flex';
  } catch { /* ignore — the single reassign already succeeded */ }
}

async function loadPlanBoard() {
  const errEl = document.getElementById('plan-error');
  const res = await api(`/api/admin/schedule?start=${planWeekStart}`);
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
  adminEmployees = data.employees;
  adminPrograms = data.programs;
  sessionById = new Map(data.sessions.map(s => [s.session_id, s]));
  renderPlanBoard(); // renders only planDayCursor's table + day label
}

function initPlan() {
  planLoaded = true;
  planWeekStart = mondayOf();
  planDayCursor = todayISO(); // start on today
  loadPlanBoard();
}

function refreshScheduleViews() {
  // After plan-board changes the Schedule view follows the planned week,
  // so repeated tasks are visible there straight away.
  const planVisible =
    document.getElementById('plan-section').style.display === 'block';
  if (planVisible && planLoaded) scheduleWeekStart = planWeekStart;

  if (planLoaded) loadPlanBoard();
  scheduleLoaded = true; // schedule table always refreshes afterwards
  loadSchedule();
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
  resetAssignRepeat();
  refreshAssignDefaults();
  openModal('assign');
}

// ================= Modal =================

const modal = document.getElementById('session-modal');
const programModal = document.getElementById('program-modal');
const applyModal = document.getElementById('apply-modal');

// Drag & drop "apply to all following weeks?" state
let pendingApply = null;

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

// "＋ Create new task…" entry in the task picker
const NEW_PROGRAM_OPTION = '<option value="__new__">＋ Create new task…</option>';

function populatePrograms() {
  const sel = document.getElementById('assign-program');
  sel.innerHTML = adminPrograms.map(p =>
    `<option value="${p.program_id}">${escapeHtml(p.code)} — ${escapeHtml(p.name)} ` +
    `(${escapeHtml(p.category)}, ${Number(p.default_points).toFixed(1)} pts)</option>`).join('') +
    NEW_PROGRAM_OPTION;
}

// Automatic allocation: tells (live) which column the task will appear in,
// decided purely by the start time.
function updateAssignPeriodHint() {
  const el = document.getElementById('assign-period-hint');
  if (!el) return;
  const start = document.getElementById('assign-start').value;
  el.textContent = start
    ? `Appears in: ${start < '12:00' ? 'Morning' : 'Afternoon and evening'} — allocated automatically from the start time`
    : '';
}

function refreshAssignDefaults() {
  const sel = document.getElementById('assign-program');
  if (sel.value === '__new__') { updateAssignPeriodHint(); return; }
  const p = adminPrograms.find(x => x.program_id === Number(sel.value));
  if (!p) { updateAssignPeriodHint(); return; }

  // No period forcing any more: the program's default times are used as-is.
  // The "+ Add task…" buttons only prefill fallback times when the program
  // has no defaults; placement is always decided by the start time.
  let start = p.default_start || '';
  let end = p.default_end || '';
  if (!start && planPeriod) {
    const fallback = planPeriod === 'morning' ? ['09:00', '10:00'] : ['14:00', '15:00'];
    start = fallback[0];
    end = fallback[1];
  }
  document.getElementById('assign-start').value = start;
  document.getElementById('assign-end').value = end;

  // Automatic: program default points, doubled for sudden sessions
  const pts = Number(p.default_points || 0) *
    (document.getElementById('assign-sudden').checked ? 2 : 1);
  const ptsInput = document.getElementById('assign-points');
  ptsInput.value = pts;
  ptsInput.readOnly = true;

  updateAssignPeriodHint();
}

function resetAssignRepeat() {
  document.getElementById('assign-repeat').checked = false;
  document.getElementById('assign-repeat-weeks').value = ''; // empty = fixed schedule
  document.getElementById('assign-repeat-row').style.display = 'none';
}

function openAssignModal(employeeId, date) {
  planPeriod = null;
  modalEmployeeId = employeeId == null ? null : Number(employeeId); // null = unassigned task
  modalDate = date;
  const emp = modalEmployeeId == null
    ? null
    : adminEmployees.find(e => e.employee_id === modalEmployeeId);
  const who = modalEmployeeId == null
    ? 'Unassigned'
    : (emp ? `${emp.first_name} ${emp.last_name}` : `Employee #${modalEmployeeId}`);
  document.getElementById('modal-title').textContent = 'Assign session';
  document.getElementById('assign-context').textContent = `${who} — ${fmtCellDate(date)}`;
  populatePrograms();
  document.getElementById('assign-sudden').checked = false;
  document.getElementById('assign-notes').value = '';
  resetAssignRepeat();
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
  document.getElementById('detail-info').innerHTML = `
    <strong>${escapeHtml(s.program_name)}</strong> (${escapeHtml(s.category)})<br>
    ${person} · ${fmtCellDate(s.session_date)}<br>
    ${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''} ·
    ${Number(s.points).toFixed(1)} pts${s.is_sudden ? ' · sudden' : ''} ·
    <span class="status-pill ${s.status}">${s.status}</span>
    ${s.notes ? `<br>Notes: ${escapeHtml(s.notes)}` : ''}`;
  openModal('details');
}

// ================= Task types (create / delete programs) =================

let allPrograms = [];

// Fetches all task types (active + deleted) and refreshes the assign picker
async function refreshAdminPrograms(preferredId) {
  const res = await api('/api/admin/programs');
  if (!res.ok) return null;
  const data = await res.json();
  allPrograms = data.programs || [];
  adminPrograms = allPrograms.filter(p => p.is_active === 1);

  const sel = document.getElementById('assign-program');
  const keep = preferredId != null ? String(preferredId) : sel.value;
  populatePrograms();
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  else sel.selectedIndex = 0;
  if (sel.value !== '__new__') refreshAssignDefaults();
  return allPrograms;
}

function renderProgramList() {
  const tbody = document.getElementById('program-list');
  if (!allPrograms.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-tasks">No tasks in the database yet.</td></tr>';
    return;
  }
  tbody.innerHTML = allPrograms.map(p => {
    const time = (p.default_start || p.default_end)
      ? `${fmtTime(p.default_start)}–${fmtTime(p.default_end)}` : '—';
    const action = p.is_active
      ? `<button type="button" class="btn small danger pm-del" data-program-id="${p.program_id}">Delete</button>`
      : '<span class="mini-tag pm-deleted-tag">deleted</span>';
    return `<tr${p.is_active ? '' : ' class="cancelled-row"'}>
      <td class="pm-code">${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.name)}</td>
      <td><span class="cat-tag ${escapeHtml(p.category)}">${escapeHtml(p.category)}</span></td>
      <td class="pts">${Number(p.default_points || 0).toFixed(1)}</td>
      <td>${time}</td>
      <td class="pm-action">${action}</td>
    </tr>`;
  }).join('');
}

function showProgramError(msg) {
  const el = document.getElementById('program-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function openProgramModal() {
  document.getElementById('program-error').style.display = 'none';
  programModal.style.display = 'flex';
  await refreshAdminPrograms();
  renderProgramList();
}

function closeProgramModal() {
  programModal.style.display = 'none';
}

// ---- Apply-to-following-weeks modal ----

function closeApplyModal() {
  applyModal.style.display = 'none';
  pendingApply = null;
}

// ================= Event wiring =================

// ---- Navigation & view switching ----
document.getElementById('nav-tasks').addEventListener('click', () => switchView('tasks'));
document.getElementById('nav-schedule').addEventListener('click', () => switchView('schedule'));
document.getElementById('nav-plan').addEventListener('click', () => switchView('plan'));

document.getElementById('schedule-prev').addEventListener('click', () => {
  scheduleWeekStart = shiftISO(scheduleWeekStart, -7);
  loadSchedule();
});
document.getElementById('schedule-next').addEventListener('click', () => {
  scheduleWeekStart = shiftISO(scheduleWeekStart, 7);
  loadSchedule();
});
document.getElementById('schedule-today').addEventListener('click', () => {
  scheduleWeekStart = mondayOf();
  loadSchedule();
});

document.getElementById('admin-schedule-grid').addEventListener('click', (e) => {
  const chip = e.target.closest('.slot-chip');
  if (chip) {
    openDetailsModal(Number(chip.dataset.sessionId));
    return;
  }
  const cell = e.target.closest('.grid-cell');
  if (cell) {
    // Unassigned-row cells have no data-employee-id -> null = unassigned task
    const raw = cell.dataset.employeeId;
    const employeeId = raw === undefined || raw === '' ? null : Number(raw);
    openAssignModal(employeeId, cell.dataset.date);
  }
});

// ---- Plan board navigation (one day at a time) ----
document.getElementById('plan-prev').addEventListener('click', () => shiftPlanDay(-1));
document.getElementById('plan-next').addEventListener('click', () => shiftPlanDay(1));
document.getElementById('plan-today').addEventListener('click', () => goToPlanDay(todayISO()));

// Arrow keys browse days while the plan view is open
document.addEventListener('keydown', (e) => {
  if (!planLoaded) return;
  if (document.getElementById('plan-section').style.display !== 'block') return;
  if (modal.style.display === 'flex' || programModal.style.display === 'flex' ||
      applyModal.style.display === 'flex') return;
  const tag = ((document.activeElement && document.activeElement.tagName) || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); shiftPlanDay(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); shiftPlanDay(1); }
});

// ---- Plan board clicks ----
document.getElementById('plan-days').addEventListener('click', (e) => {
  const addBtn = e.target.closest('.add-task-btn');
  if (addBtn) { openPlanAddModal(addBtn.dataset.date, addBtn.dataset.period); return; }
  const taskLink = e.target.closest('.task-link');
  if (taskLink) { openDetailsModal(Number(taskLink.dataset.sessionId)); return; }
  const chip = e.target.closest('.person-chip.assigned');
  if (chip) openDetailsModal(Number(chip.dataset.sessionId));
});

// ---- Modal wiring ----
document.getElementById('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// "＋ Create new task…" opens the task types modal; otherwise recalc defaults
document.getElementById('assign-program').addEventListener('change', (e) => {
  if (e.target.value === '__new__') { openProgramModal(); return; }
  refreshAssignDefaults();
});
document.getElementById('assign-sudden').addEventListener('change', refreshAssignDefaults);

// Live allocation hint while the start time is edited
document.getElementById('assign-start').addEventListener('input', updateAssignPeriodHint);

document.getElementById('assign-repeat').addEventListener('change', (e) => {
  document.getElementById('assign-repeat-row').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('assign-submit').addEventListener('click', async (e) => {
  const btn = e.target;
  btn.disabled = true;
  try {
    // Repeat check:
    //   unchecked             -> repeatWeeks 1 (only this day, old behaviour)
    //   checked + number      -> that many weeks, capped at 53
    //   checked + empty box   -> repeatFixed: fixed weekly schedule,
    //                            backend creates one year (53 weeks)
    const repeatOn = document.getElementById('assign-repeat').checked;
    const weeksRaw = document.getElementById('assign-repeat-weeks').value.trim();
    const repeatFixed = repeatOn && weeksRaw === '';
    const repeatWeeks = repeatOn && !repeatFixed
      ? Math.min(53, Math.max(1, parseInt(weeksRaw, 10) || 1))
      : 1;

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
        repeatWeeks,
        repeatFixed,
      }),
    });
    if (!res.ok) {
      showModalError('Save failed: ' + (await res.text()));
    } else {
      const data = await res.json().catch(() => null);
      closeModal();
      refreshScheduleViews();
      if (data?.repeatFixed) {
        alert('Fixed schedule added: the task repeats every week for one year (53 weeks). ' +
              'Browse to later weeks to see it.');
      } else if (data?.repeatedWeeks > 1) {
        alert(`Task added to ${data.repeatedWeeks} weeks (same weekday, same time). ` +
              'Browse to later weeks to see it.');
      }
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

// Delete only the clicked day
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

// Delete the clicked day AND every later occurrence of the same task on this
// weekday from this date onward — but ONLY the ones with the SAME start and
// end time. Same task with a different time, or on a different weekday,
// is never touched. Weeks before this date are never touched; completed
// later sessions are kept so points and history survive.
document.getElementById('session-delete-series').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm('Delete this task AND every later occurrence of this task with the SAME time\n' +
    'on this weekday, from this date onward?\n\n' +
    'Same task but a different time, or on a different weekday, is kept.\n' +
    'Earlier weeks are kept. Already completed sessions are kept ' +
    '(they count toward points). The deletion is recorded in history.')) return;
  try {
    const res = await api('/api/admin/schedule/delete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: currentSession.session_id, deleteFollowing: true }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      closeModal();
      refreshScheduleViews();
      const n = data?.deletedCount ?? 1;
      if (n > 1) alert(`Deleted ${n} sessions from this date onward.`);
    } else {
      alert('Delete failed: ' + (await res.text()));
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
});

// ---- Apply-to-following-weeks modal wiring (drag & drop) ----
document.getElementById('apply-close').addEventListener('click', closeApplyModal);
applyModal.addEventListener('click', (e) => { if (e.target === applyModal) closeApplyModal(); });

// "This day only": the drop already happened, nothing more to do
document.getElementById('apply-one').addEventListener('click', closeApplyModal);

document.getElementById('apply-all').addEventListener('click', async () => {
  if (!pendingApply) return closeApplyModal();
  const { sessionId, employeeId } = pendingApply;
  const override = document.getElementById('apply-override').checked;
  try {
    const res = await api('/api/admin/schedule/reassign', {
      method: 'POST',
      body: JSON.stringify({ sessionId, employeeId, applyFollowing: true, override }),
    });
    if (!res.ok) {
      alert('Could not apply to following weeks: ' + (await res.text()));
    } else {
      const data = await res.json().catch(() => null);
      if (data?.skipped > 0) {
        alert(`Applied to ${data.applied} following week(s); skipped ${data.skipped} ` +
              `that already ${data.skipped === 1 ? 'had a person' : 'had people'}.`);
      }
      refreshScheduleViews();
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
  closeApplyModal();
});

// ---- Task types modal wiring (create / delete programs) ----
document.getElementById('manage-tasks-btn').addEventListener('click', openProgramModal);
document.getElementById('program-modal-close').addEventListener('click', closeProgramModal);
programModal.addEventListener('click', (e) => { if (e.target === programModal) closeProgramModal(); });

document.getElementById('program-submit').addEventListener('click', async (e) => {
  const btn = e.target;
  const code = document.getElementById('program-code').value.trim();
  const name = document.getElementById('program-name').value.trim();
  const category = document.getElementById('program-category').value.trim() || 'general';
  const defaultPoints = Number(document.getElementById('program-points').value);
  const defaultStart = document.getElementById('program-start').value || null;
  const defaultEnd = document.getElementById('program-end').value || null;

  document.getElementById('program-error').style.display = 'none';
  if (!code || !name) { showProgramError('Code and name are required.'); return; }
  if (!Number.isFinite(defaultPoints) || defaultPoints < 0) {
    showProgramError('Default points must be a number of at least 0.');
    return;
  }

  btn.disabled = true;
  try {
    const res = await api('/api/admin/programs', {
      method: 'POST',
      body: JSON.stringify({ code, name, category, defaultPoints, defaultStart, defaultEnd }),
    });
    if (!res.ok) {
      showProgramError('Save failed: ' + (await res.text()));
    } else {
      const data = await res.json();
      ['program-code', 'program-name', 'program-category'].forEach(
        id => document.getElementById(id).value = '');
      document.getElementById('program-points').value = 1;
      document.getElementById('program-start').value = '';
      document.getElementById('program-end').value = '';
      // Refresh the picker too; selects the new task if the assign form is open
      await refreshAdminPrograms(data.program?.program_id);
      renderProgramList();
    }
  } catch (err) {
    showProgramError('Network error: ' + err.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('program-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.pm-del');
  if (!btn) return;
  if (!confirm('Delete this task? If it has scheduled sessions they are kept ' +
    'and the task is only hidden from the lists; otherwise it is removed from the database.')) return;
  document.getElementById('program-error').style.display = 'none';
  try {
    const res = await api('/api/admin/programs/delete', {
      method: 'POST',
      body: JSON.stringify({ programId: Number(btn.dataset.programId) }),
    });
    if (!res.ok) {
      showProgramError('Delete failed: ' + (await res.text()));
    } else {
      await refreshAdminPrograms();
      renderProgramList();
      if (planLoaded) loadPlanBoard(); // refresh the add-task pickers on the board
    }
  } catch (err) {
    showProgramError('Network error: ' + err.message);
  }
});

// ================= Boot =================

load();