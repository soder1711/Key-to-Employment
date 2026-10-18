const WORKER = 'https://task-portal.soder1234.workers.dev';

async function api(path, opts = {}) {
  return fetch(`${WORKER}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
}

function priorityBadge(priority) {
  return `<span class="badge ${priority}">${priority}</span>`;
}

function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return `
    <div class="progress-row">
      <div class="progress"><div class="progress-fill" style="width:${p}%"></div></div>
      <span class="pct">${p}%</span>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderMyTask(t) {
  return `
    <li class="task-item">
      <div class="task-top">
        <strong>${escapeHtml(t.task_code)}</strong>
        <span class="task-title">${escapeHtml(t.title)}</span>
        ${priorityBadge(t.priority)}
      </div>
      ${progressBar(t.completion_percentage)}
      <div class="meta">
        ${escapeHtml(t.assignment_status)}
        ${t.deadline ? '· due ' + escapeHtml(t.deadline) : ''}
      </div>
    </li>`;
}

function renderAdminTask(t) {
  const assignee = t.employee_email
    ? `${escapeHtml(t.first_name || '')} ${escapeHtml(t.last_name || '')} &lt;${escapeHtml(t.employee_email)}&gt;`
    : '<em>unassigned</em>';
  const hasAssignment = t.assignment_id != null;
  return `
    <li class="task-item">
      <div class="task-top">
        <strong>${escapeHtml(t.task_code)}</strong>
        <span class="task-title">${escapeHtml(t.title)}</span>
        ${priorityBadge(t.priority)}
      </div>
      <div class="meta">
        task status: ${escapeHtml(t.status)}
        ${t.deadline ? '· due ' + escapeHtml(t.deadline) : ''}
        ${hasAssignment ? `· assigned to ${assignee}` : ''}
      </div>
      ${hasAssignment ? `
        ${progressBar(t.completion_percentage)}
        <div class="progress-form" data-assignment-id="${t.assignment_id}">
          <input type="number" min="0" max="100" value="${t.completion_percentage}" />
          <button type="button" class="btn small save-progress">Save</button>
        </div>
      ` : ''}
    </li>`;
}

async function loadMyTasks() {
  const res = await api('/api/me/tasks');
  if (!res.ok) return;
  const { tasks } = await res.json();
  const ul = document.getElementById('my-tasks');
  const empty = document.getElementById('my-tasks-empty');
  if (!tasks.length) {
    ul.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    ul.innerHTML = tasks.map(renderMyTask).join('');
  }
  document.getElementById('my-tasks-section').style.display = 'block';
}

async function loadAllTasks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.employeeId) params.set('employeeId', filters.employeeId);
  const qs = params.toString();
  const res = await api('/api/admin/tasks' + (qs ? `?${qs}` : ''));
  const errEl = document.getElementById('admin-error');
  if (!res.ok) {
    errEl.textContent = res.status === 403
      ? 'Admin access required.'
      : `Failed to load tasks (${res.status}).`;
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  const { tasks } = await res.json();
  const ul = document.getElementById('all-tasks');
  const empty = document.getElementById('all-tasks-empty');
  if (!tasks.length) {
    ul.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    ul.innerHTML = tasks.map(renderAdminTask).join('');
  }
  document.getElementById('admin-section').style.display = 'block';
}

document.getElementById('all-tasks').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('save-progress')) return;
  const form = e.target.closest('.progress-form');
  const assignmentId = parseInt(form.dataset.assignmentId, 10);
  const input = form.querySelector('input[type="number"]');
  const percentage = parseInt(input.value, 10);

  if (Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
    alert('Percentage must be between 0 and 100');
    return;
  }

  e.target.disabled = true;
  e.target.textContent = 'Saving…';
  try {
    const res = await api('/api/admin/progress', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, percentage, notes: '' }),
    });
    if (!res.ok) {
      const txt = await res.text();
      alert('Save failed: ' + txt);
    } else {
      e.target.textContent = 'Saved';
      setTimeout(() => { e.target.textContent = 'Save'; e.target.disabled = false; }, 1200);
    }
  } catch (err) {
    alert('Network error: ' + err.message);
    e.target.textContent = 'Save';
    e.target.disabled = false;
  }
});

document.getElementById('apply-filters').addEventListener('click', () => {
  loadAllTasks({
    status: document.getElementById('filter-status').value,
    employeeId: document.getElementById('filter-employee').value,
  });
});
document.getElementById('clear-filters').addEventListener('click', () => {
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-employee').value = '';
  loadAllTasks();
});

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
    await loadAllTasks();
  }
}

load();

// ================= Schedule feature =================

let currentUser = null;
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

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const pad2 = n => String(n).padStart(2, '0');
const todayISO = () => new Date().toISOString().slice(0, 10);

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
  document.getElementById('nav-tasks').classList.toggle('active', showTasks);
  document.getElementById('nav-schedule').classList.toggle('active', !showTasks);

  document.getElementById('my-tasks-section').style.display = showTasks ? 'block' : 'none';
  document.getElementById('admin-section').style.display =
    showTasks && currentUser?.isAdmin ? 'block' : 'none';
  document.getElementById('schedule-section').style.display = showTasks ? 'none' : 'block';

  if (!showTasks && !scheduleLoaded) initSchedule();
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

// ---------- Modal ----------

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
  const sudden = document.getElementById('assign-sudden');
  const p = adminPrograms.find(x => x.program_id === Number(sel.value));
  if (!p) return;
  document.getElementById('assign-start').value = p.default_start || '';
  document.getElementById('assign-end').value = p.default_end || '';
  let pts = Number(p.default_points || 0);
  if (sudden.checked) pts *= 2;
  document.getElementById('assign-points').value = pts;
}

function openAssignModal(employeeId, date) {
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
  document.getElementById('modal-title').textContent = 'Session details';
  document.getElementById('detail-info').innerHTML = `
    <strong>${escapeHtml(s.program_name)}</strong> (${escapeHtml(s.category)})<br>
    ${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)} · ${fmtCellDate(s.session_date)}<br>
    ${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''} ·
    ${Number(s.points).toFixed(1)} pts${s.is_sudden ? ' · sudden' : ''} ·
    <span class="status-pill ${s.status}">${s.status}</span>
    ${s.notes ? `<br>Notes: ${escapeHtml(s.notes)}` : ''}`;
  openModal('details');
}

// ---------- Schedule event wiring ----------

document.getElementById('nav-tasks').addEventListener('click', () => switchView('tasks'));
document.getElementById('nav-schedule').addEventListener('click', () => switchView('schedule'));
document.getElementById('sched-week-btn').addEventListener('click', () => setSchedMode('week'));
document.getElementById('sched-month-btn').addEventListener('click', () => setSchedMode('month'));
document.getElementById('sched-prev').addEventListener('click', () => {
  scheduleWeekStart = shiftISO(scheduleWeekStart, -7); refreshWeek();
});
document.getElementById('sched-next').addEventListener('click', () => {
  scheduleWeekStart = shiftISO(scheduleWeekStart, 7); refreshWeek();
});
document.getElementById('sched-today').addEventListener('click', () => {
  scheduleWeekStart = mondayOf(); refreshWeek();
});
document.getElementById('month-prev').addEventListener('click', () => shiftMonth(-1));
document.getElementById('month-next').addEventListener('click', () => shiftMonth(1));

document.getElementById('admin-schedule-grid').addEventListener('click', (e) => {
  const chip = e.target.closest('.slot-chip');
  if (chip) { openDetailsModal(Number(chip.dataset.sessionId)); return; }
  const cell = e.target.closest('.grid-cell');
  if (cell && cell.dataset.employeeId && cell.dataset.date) {
    openAssignModal(Number(cell.dataset.employeeId), cell.dataset.date);
  }
});

document.getElementById('month-summary-wrap').addEventListener('change', async (e) => {
  if (!e.target.classList.contains('target-input')) return;
  const val = Number(e.target.value);
  if (!Number.isFinite(val) || val < 0) { alert('Invalid target'); return; }
  const res = await api('/api/admin/schedule/target', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: Number(e.target.dataset.employeeId),
      year: monthCursor.year, month: monthCursor.month, targetPoints: val,
    }),
  });
  if (res.ok) loadAdminMonth();
  else alert('Failed to save target');
});

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
      loadAdminSchedule();
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
    if (res.ok) { closeModal(); loadAdminSchedule(); }
    else alert('Status update failed');
  });
});

document.getElementById('session-delete').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm('Delete this session? The deletion is recorded in history.')) return;
  const res = await api('/api/admin/schedule/delete', {
    method: 'POST',
    body: JSON.stringify({ sessionId: currentSession.session_id }),
  });
  if (res.ok) { closeModal(); loadAdminSchedule(); }
  else alert('Delete failed');
});