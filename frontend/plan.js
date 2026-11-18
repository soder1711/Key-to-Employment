// ================= Plan board (drag & drop, ONE day at a time) =================

let planWeekStart = null;   // Monday of the week currently loaded from the API
let planDayCursor = null;   // the single day currently displayed
let planLoaded = false;
let planDates = [];
let planSessions = [];
let planPeriod = null;
let planViewMode = 'sessions';
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
              data-session-id="${s.session_id ?? ''}" data-series-id="${s.recurring_series_id ?? ''}"
              data-occurrence-date="${s.recurrence_date || s.session_date}"
              data-display-date="${s.session_date}" data-recurrence-date="${s.recurrence_date || s.session_date}"
              title="${escapeHtml(t('plan.clickOptions'))}">
         ${escapeHtml(planEmployeeName(s.employee_id))}</span>`
    : `<span class="drop-here">${escapeHtml(t('plan.dropHere'))}</span>`;
  return `
    <td class="cell-task">
      <button type="button" class="task-link" data-session-id="${s.session_id ?? ''}"
              data-series-id="${s.recurring_series_id ?? ''}"
              data-occurrence-date="${s.recurrence_date || s.session_date}"
              data-display-date="${s.session_date}" data-recurrence-date="${s.recurrence_date || s.session_date}"
              title="${escapeHtml(t('plan.clickOptions'))}">${escapeHtml(s.program_name)}${scheduleBadge(s)}</button>
      ${s.is_sudden ? `<span class="mini-tag sudden">${escapeHtml(t('tag.sudden'))}</span>` : ''}
      <span class="task-sub">${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</span>
    </td>
    <td class="cell-pts">${Number(s.points || 0).toFixed(1)}</td>
    <td class="cell-person-slot" data-session-id="${s.session_id ?? ''}"
        data-series-id="${s.recurring_series_id ?? ''}"
        data-occurrence-date="${s.recurrence_date || s.session_date}"
        data-display-date="${s.session_date}" data-recurrence-date="${s.recurrence_date || s.session_date}">${person}</td>`;
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
  if (planViewMode === 'sessions') initPlanSortables();
  else destroyPlanSortables();
}

function setPlanViewMode(mode) {
  planViewMode = currentUser?.isAdmin && mode === 'timetable' ? 'timetable' : 'sessions';
  const timetable = planViewMode === 'timetable';
  document.getElementById('plan-sessions-panel').style.display = timetable ? 'none' : 'block';
  document.getElementById('plan-timetable-panel').style.display = timetable ? 'block' : 'none';
  for (const value of ['sessions', 'timetable']) {
    const button = document.getElementById(`plan-mode-${value}`);
    button.setAttribute('aria-pressed', String(value === planViewMode));
    button.classList.toggle('ghost', value !== planViewMode);
  }
  if (timetable) loadPlanTimetable();
  else if (planLoaded) renderPlanBoard();
}

async function loadPlanTimetable() {
  const error = document.getElementById('plan-error');
  try {
    await loadRecurringEntries();
    renderTimetableEntries('plan-timetable-grid');
    error.style.display = 'none';
  } catch (err) {
    document.getElementById('plan-timetable-grid').innerHTML = '';
    error.textContent = t('plan.loadError', { msg: err.message });
    error.style.display = 'block';
  }
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
  const seriesId = Number(evt.to.dataset.seriesId);
  const occurrenceDate = evt.to.dataset.recurrenceDate || evt.to.dataset.occurrenceDate;
  if (Number.isSafeInteger(seriesId) && seriesId > 0 && occurrenceDate) {
    const occurrence = planSessions.find(item => item.recurring_series_id === seriesId &&
      item.recurrence_date === occurrenceDate);
    if (!occurrence) {
      renderPlanBoard();
      return;
    }
    renderPlanBoard();
    const change = await requestScheduleChange({ title: t('schedule.assignee'),
      summary: scheduleChangeSummary(occurrence, { ...occurrence, employeeId }),
      date: occurrenceDate > todayISO() ? occurrenceDate : todayISO(),
      occurrenceDate, allowOccurrence: true, allowReplace: true });
    if (!change) return;
    const recurrenceDate = occurrence.recurrence_date || occurrence.session_date;
    const conflictCandidate = {
      employeeId,
      weekday: new Date(`${recurrenceDate}T00:00:00Z`).getUTCDay(),
      startTime: occurrence.start_time,
      endTime: occurrence.end_time,
      startDate: occurrence.start_date || recurrenceDate,
      endDate: occurrence.end_date || null,
      effectiveFrom: change.scope === 'future' ? change.cutoffDate : undefined,
      occurrenceDate: change.scope === 'occurrence' ? recurrenceDate : undefined,
    };
    try {
      if (!await confirmRecurringRuleConflict(conflictCandidate, seriesId)) return;
      const res = await api('/api/admin/schedule/timetable', {
        method: 'POST',
        body: JSON.stringify({
          ...(change.scope === 'future'
            ? { operation: 'edit', seriesId, cutoffDate: change.cutoffDate,
                employeeId, replaceFutureExceptions: change.replaceFutureExceptions }
            : { operation: 'exception', action: 'modify', seriesId, cutoffDate: occurrenceDate,
                occurrenceDate, movedDate: occurrence.session_date, employeeId,
                programId: occurrence.program_id, startTime: occurrence.start_time,
                endTime: occurrence.end_time, points: Number(occurrence.points),
                isSudden: !!occurrence.is_sudden, notes: occurrence.notes || null }),
        }),
      });
      if (!res.ok) alert(t('err.assignFailed') + (await res.text()));
    } catch (err) {
      alert(t('err.network') + err.message);
    }
    refreshScheduleViews();
    return;
  }
  const sessionId = Number(evt.to.dataset.sessionId);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 ||
      !Number.isSafeInteger(sessionId) || sessionId < 1) {
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
  sessionByOccurrence = new Map(data.sessions.filter(s => s.is_recurring)
    .map(s => [`${s.recurring_series_id}:${s.recurrence_date || s.session_date}`, s]));
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
  if (planLoaded && planViewMode === 'timetable' && scheduleViewMode !== 'timetable') loadPlanTimetable();
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
  editingSession = false;
  document.getElementById('assign-date-row').style.display = 'none';
  document.getElementById('assign-repeat-option').style.display = 'block';
  document.getElementById('assign-submit').textContent = t('modal.add');
  document.querySelector('label[for="assign-points"]').textContent = t('modal.points');
  refreshAssignDefaults();
  openModal('assign');
}

