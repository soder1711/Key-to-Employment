// ================= Schedule feature (dates & state) =================

let scheduleWeekStart = null;
let scheduleLoaded = false;
let schedMode = 'week';
let monthCursor = { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 };
let monthlySummaryLoaded = false;
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

function fmtTime(time) { return time ? String(time).slice(0, 5) : '—'; }

function fmtShort(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${monthName(d.getUTCMonth())}`;
}

function fmtCellDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const today = iso === todayISO() ? ` · ${t('common.today')}` : '';
  return `${dayName(d.getUTCDay())} ${d.getUTCDate()} ${monthName(d.getUTCMonth())}${today}`;
}

function fmtDayHeader(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `<span class="day-name">${dayName(d.getUTCDay())}</span>` +
         `<span class="day-num">${d.getUTCDate()}</span>` +
         `<span class="day-mon">${monthName(d.getUTCMonth())}</span>`;
}

// ---------- View switching ----------

function switchView(view) {
  const showTasks = view === 'tasks';
  const showSchedule = view === 'schedule';
  const showPlan = view === 'plan';
  const showMonthlySummary = view === 'monthly-summary' && currentUser?.isAdmin;

  document.getElementById('nav-tasks').classList.toggle('active', showTasks);
  document.getElementById('nav-schedule').classList.toggle('active', showSchedule);
  document.getElementById('nav-plan').classList.toggle('active', showPlan);
  document.getElementById('nav-monthly').classList.toggle('active', showMonthlySummary);

  document.getElementById('my-tasks-section').style.display = showTasks ? 'block' : 'none';
  document.getElementById('schedule-section').style.display = showSchedule ? 'block' : 'none';
  document.getElementById('plan-section').style.display =
    showPlan && currentUser?.isAdmin ? 'block' : 'none';
  document.getElementById('monthly-summary-section').style.display =
    showMonthlySummary ? 'block' : 'none';

  if (showPlan && !planLoaded) initPlan();
  if (showMonthlySummary) {
    monthlySummaryLoaded = true;
    loadMonthlySummary();
  }
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
          <td>${escapeHtml(s.program_name)}${s.is_sudden ? ` <span class="mini-tag sudden">${escapeHtml(t('tag.sudden'))}</span>` : ''}</td>
          <td><span class="cat-tag ${escapeHtml(s.category)}">${escapeHtml(s.category)}</span></td>
          <td>${s.start_time ? fmtTime(s.start_time) : '—'}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</td>
          <td class="pts">${Number(s.points).toFixed(1)}</td>
          <td>${statusPill(s.status)}</td>
        </tr>`).join('');
    }

    const done = data.sessions.filter(s => s.status === 'completed');
    const earned = done.reduce((a, s) => a + Number(s.points), 0);
    const planned = visible.reduce((a, s) => a + Number(s.points), 0);

    totals.innerHTML = `
      <div class="totals-row">
        <span>${t('totals.sessions')} <strong>${visible.length}</strong></span>
        <span>${t('totals.completed')} <strong>${done.length}</strong></span>
        <span>${t('totals.earned')} <strong>${earned.toFixed(1)}</strong></span>
        <span>${t('totals.potential')} <strong>${planned.toFixed(1)}</strong></span>
      </div>
      ${renderMonthProgress(data.summary,
        data.summaryMonth ? monthName(data.summaryMonth.month - 1) : '')}`;
  } catch (err) {
    tbody.innerHTML = '';
    empty.style.display = 'none';
    totals.innerHTML = '';
    error.textContent = t('schedule.loadError', { msg: err.message });
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
        ? `<div class="mp-excess">${t('mp.excess', { p: excess.toFixed(1) })}</div>`
        : `<div class="mp-remaining">${t('mp.remaining', { p: (target - earned).toFixed(1) })}</div>`)
    : `<div class="mp-remaining">${t('mp.noTarget')}</div>`;
  return `
    <div class="month-progress">
      <div class="mp-label">${labelTxt}<strong>${earned.toFixed(1)}</strong> / ${target.toFixed(1)} ${t('mp.credited')} ·
        ${t('mp.sessionsDone', { done: summary.completed_sessions || 0, total: summary.total_sessions || 0 })}</div>
      ${progressBar(pct)}
      ${footer}
    </div>`;
}

// ---------- Admin week grid ----------

function slotChipHtml(s) {
  return `
    <span class="slot-chip ${escapeHtml(s.status)}${s.is_sudden ? ' sudden' : ''}"
          data-session-id="${s.session_id}"
          title="${escapeHtml(s.program_name)} · ${fmtTime(s.start_time)} · ${Number(s.points).toFixed(1)} ${t('unit.pts')} · ${escapeHtml(t('status.' + s.status))}">
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
    let html = `<thead><tr><th class="sticky-col">${t('grid.employee')}</th>`;
    for (const d of data.dates) {
      const wd = new Date(d + 'T00:00:00Z').getUTCDay();
      const cls = (d === today ? ' today' : '') + (wd === 0 || wd === 6 ? ' weekend' : '');
      html += `<th class="day-head${cls}">${fmtDayHeader(d)}</th>`;
    }
    html += `<th class="pts-head">${t('grid.pts')}</th></tr></thead><tbody>`;

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
      html += `<tr><td class="sticky-col unassigned">${escapeHtml(t('plan.unassignedRow'))}</td>`;
      for (const d of data.dates) {
        const list = unassigned[d] || [];
        html += `<td class="grid-cell${list.length ? ' has' : ''}${d === today ? ' today' : ''}"
                    data-date="${d}">${list.map(slotChipHtml).join('')}</td>`;
      }
      html += `<td class="pts-cell"></td></tr>`;
    }

    document.getElementById('admin-schedule-grid').innerHTML = html + '</tbody>';
  } catch (err) {
    error.textContent = t('schedule.loadError', { msg: err.message });
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
  document.getElementById('month-label').textContent = `${monthName(month - 1)} ${year}`;
  const res = await api(`/api/admin/schedule/monthly?year=${year}&month=${month}`);
  if (!res.ok) return;
  const { rows } = await res.json();
  const wrap = document.getElementById('month-summary-wrap');

  if (!rows.length) {
    wrap.innerHTML = `<div class="empty">${t('plan.emptyPeople')}</div>`;
    return;
  }
  wrap.innerHTML = `<table class="month-table">
    <thead><tr>
      <th>${t('grid.employee')}</th><th>${t('sth.program')}</th><th>${t('totals.completed')}</th><th>${t('sth.points')}</th>
      <th>${t('mp.target')}</th><th>${t('th.progress')}</th><th>${t('mp.excessShort', { p: '' })}</th>
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
  document.getElementById('month-label').textContent = `${monthName(month - 1)} ${year}`;
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

