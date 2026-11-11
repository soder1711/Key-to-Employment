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
  return e ? `${e.first_name} ${e.last_name}`.trim() : t('person.unknown');
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
            title="${escapeHtml(name)} — ${p} ${t('unit.pts')}">
        ${escapeHtml(name)}<span class="chip-pts">${p}</span>
      </span>`;
  }).join('') || `<span class="empty">${t('plan.emptyPeople')}</span>`;
}

function planCells(s) {
  if (!s) return '<td></td><td></td><td></td>';
  const person = s.employee_id != null
    ? `<span class="person-chip assigned" data-employee-id="${s.employee_id}"
              data-session-id="${s.session_id}"
              title="${escapeHtml(t('plan.clickOptions'))}">
         ${escapeHtml(planEmployeeName(s.employee_id))}</span>`
    : `<span class="drop-here">${escapeHtml(t('plan.dropHere'))}</span>`;
  return `
    <td class="cell-task">
      <button type="button" class="task-link" data-session-id="${s.session_id}"
              title="${escapeHtml(t('plan.clickOptions'))}">${escapeHtml(s.program_name)}</button>
      ${s.is_sudden ? `<span class="mini-tag sudden">${escapeHtml(t('tag.sudden'))}</span>` : ''}
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
        <td colspan="3" class="no-tasks">${escapeHtml(t('plan.noTasks'))}</td>
        <td colspan="3" class="no-tasks">${escapeHtml(t('plan.noTasks'))}</td>
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
            data-date="${date}" data-period="morning">${escapeHtml(t('plan.addBtn'))}</button></td>
      <td colspan="3"><button type="button" class="add-task-btn"
            data-date="${date}" data-period="afternoon">${escapeHtml(t('plan.addBtn'))}</button></td>
    </tr>
    <tr class="total-row">
      <td colspan="2" class="total-label">${escapeHtml(t('plan.pointsTotal'))}</td>
      <td class="cell-pts">${total(morning)}</td>
      <td colspan="2" class="total-label">${escapeHtml(t('plan.pointsTotal'))}</td>
      <td class="cell-pts">${total(afternoon)}</td>
    </tr>`;

  return `
    <div class="day-block${isToday ? ' today' : ''}">
      <div class="day-block-head">
        <span class="db-day">${dayName(d.getUTCDay())}</span>
        <span class="db-date">${d.getUTCDate()} ${monthName(d.getUTCMonth())}</span>
        ${isToday ? `<span class="mini-tag today-tag">${escapeHtml(t('tag.today'))}</span>` : ''}
      </div>
      <div class="table-scroll">
        <table class="plan-table">
          <colgroup>
            <col class="col-task"><col class="col-pts"><col class="col-person">
            <col class="col-task"><col class="col-pts"><col class="col-person">
          </colgroup>
          <thead>
            <tr>
              <th colspan="3" class="period-head morning">${escapeHtml(t('plan.morning'))}</th>
              <th colspan="3" class="period-head afternoon">${escapeHtml(t('plan.afternoon'))}</th>
            </tr>
            <tr class="col-heads">
              <th>${escapeHtml(t('th.task'))}</th><th>${escapeHtml(t('sth.points'))}</th><th>${escapeHtml(t('plan.people'))}</th>
              <th>${escapeHtml(t('th.task'))}</th><th>${escapeHtml(t('sth.points'))}</th><th>${escapeHtml(t('plan.people'))}</th>
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
    `${dayName(d.getUTCDay())} ${d.getUTCDate()} ` +
    `${monthName(d.getUTCMonth())} ${d.getUTCFullYear()}`;
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
    errEl.textContent = t('plan.loadError', { msg: err.message });
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
    if (!res.ok) alert(t('err.assignFailed') + (await res.text()));
  } catch (err) {
    alert(t('err.network') + err.message);
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
    let ctx = t('apply.lead', { name: escapeHtml(name) }) + ' ' +
      (following.length === 1
        ? t('apply.count1')
        : t('apply.countN', { n: following.length })) + ' ' +
      t('apply.tail');
    if (withPerson) {
      ctx += ', ' + withPerson + ' ' +
        (withPerson === 1 ? t('apply.has1') : t('apply.hasN', { n: withPerson }));
    }
    ctx += ' ' + t('apply.ask', { name: escapeHtml(name) });
    document.getElementById('apply-context').innerHTML = ctx;
    document.getElementById('apply-override').checked = false;
    applyModal.style.display = 'flex';
  } catch { /* ignore — the single reassign already succeeded */ }
}

async function loadPlanBoard() {
  const errEl = document.getElementById('plan-error');
  const res = await api(`/api/admin/schedule?start=${planWeekStart}`);
  if (!res.ok) {
    errEl.textContent = t('plan.loadErrorStatus', { status: res.status });
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
  document.getElementById('modal-title').textContent = t('modal.addTitle');
  document.getElementById('assign-context').textContent =
    `${fmtCellDate(date)} · ${period === 'morning' ? t('plan.morning') : t('plan.afternoon')}` +
    t('modal.dragAfter');
  populatePrograms();
  document.getElementById('assign-sudden').checked = false;
  document.getElementById('assign-notes').value = '';
  resetAssignRepeat();
  refreshAssignDefaults();
  openModal('assign');
}

