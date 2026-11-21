// ================= Plan board (dated week, drag & drop) =================

let planWeekStart = null;   // Monday of the week currently loaded from the API
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

function planAssignees(session) {
  if (Array.isArray(session.assignees)) return session.assignees;
  return session.employee_id == null ? [] : [{
    employee_id: session.employee_id,
    first_name: session.first_name,
    last_name: session.last_name,
  }];
}

function planSessionsForDate(date) {
  return planSessions.filter(session => session.session_date === date && session.status !== 'cancelled');
}

function renderPool() {
  const points = new Map();
  for (const s of planSessions) {
    if (s.status === 'cancelled') continue;
    for (const { employee_id: employeeId } of planAssignees(s)) {
      const total = points.get(employeeId) || { estimated: 0, earned: 0 };
      total.estimated += Number(s.points || 0);
      if (s.status === 'completed') total.earned += Number(s.points || 0);
      points.set(employeeId, total);
    }
  }
  document.getElementById('pool-chips').innerHTML = adminEmployees.map(e => {
    const name = `${e.first_name} ${e.last_name}`.trim();
    const total = points.get(e.employee_id) || { estimated: 0, earned: 0 };
    const estimated = total.estimated.toFixed(1);
    const earned = total.earned.toFixed(1);
    return `
      <span class="person-chip pool" data-employee-id="${e.employee_id}"
            title="${escapeHtml(name)} — ${escapeHtml(t('summary.estimated'))}: ${estimated} ${t('unit.pts')} · ${escapeHtml(t('totals.earned'))} ${earned} ${t('unit.pts')}">
        <span class="chip-name">${escapeHtml(name)}</span><span class="chip-pts">${t('plan.estimateShort')} ${estimated}</span>
        <span class="chip-earned">${t('plan.earnedShort')} ${earned}</span>
      </span>`;
  }).join('') || `<span class="empty">${t('plan.emptyPeople')}</span>`;
}

function planCells(s, period) {
  if (!s) return '<td></td><td></td><td></td>';
  const taskLabel = escapeHtml(`${period} · ${t('th.task')}`);
  const pointsLabel = escapeHtml(`${period} · ${t('sth.points')}`);
  const peopleLabel = escapeHtml(`${period} · ${t('plan.people')}`);
  const assignees = planAssignees(s);
  const person = assignees.length
    ? assignees.map(assignee => {
      const name = planEmployeeName(assignee.employee_id);
      return currentUser?.isAdmin
        ? `<span class="person-chip assigned" data-employee-id="${assignee.employee_id}"
                  title="${escapeHtml(t('plan.clickOptions'))}"><span class="chip-name">${escapeHtml(name)}</span>
                  <button type="button" class="assigned-remove" data-employee-id="${assignee.employee_id}"
                          aria-label="${escapeHtml(t('plan.removeAssignee', { name }))}"
                          title="${escapeHtml(t('plan.removeAssignee', { name }))}">×</button></span>`
        : `<span class="person-chip assigned"><span class="chip-name">${escapeHtml(name)}</span></span>`;
    }).join('')
    : `<span class="drop-here">${escapeHtml(t('plan.dropHere'))}</span>`;
  const taskName = currentUser?.isAdmin
    ? `<button type="button" class="task-link" data-session-id="${s.session_id ?? ''}"
              data-series-id="${s.recurring_series_id ?? ''}"
              data-occurrence-date="${s.recurrence_date || s.session_date}"
              data-display-date="${s.session_date}" data-recurrence-date="${s.recurrence_date || s.session_date}"
              title="${escapeHtml(t('plan.clickOptions'))}">${escapeHtml(s.program_name)}${scheduleBadge(s)}${deletedProgramBadge(s)}</button>`
    : `<span>${escapeHtml(s.program_name)}${scheduleBadge(s)}${deletedProgramBadge(s)}</span>`;
  return `
    <td class="cell-task" data-label="${taskLabel}">
      ${taskName}
      ${s.is_sudden ? `<span class="mini-tag sudden">${escapeHtml(t('tag.sudden'))}</span>` : ''}
      <span class="task-sub">${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</span>
    </td>
    <td class="cell-pts" data-label="${pointsLabel}">${Number(s.points || 0).toFixed(1)}</td>
    <td class="cell-person-slot" data-label="${peopleLabel}" data-session-id="${s.session_id ?? ''}"
        data-series-id="${s.recurring_series_id ?? ''}"
        data-occurrence-date="${s.recurrence_date || s.session_date}"
        data-display-date="${s.session_date}" data-recurrence-date="${s.recurrence_date || s.session_date}">${person}</td>`;
}

function renderDayTable(date) {
  const daySessions = planSessionsForDate(date);
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
      body += `<tr>${planCells(morning[i], t('plan.morning'))}${planCells(afternoon[i], t('plan.afternoon'))}</tr>`;
    }
  }
  if (currentUser?.isAdmin) body += `
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

function updatePlanWeekLabel() {
  const el = document.getElementById('plan-week-label');
  if (!el || !planDates.length) return;
  el.textContent = `${fmtCellDate(planDates[0])} – ${fmtCellDate(planDates[planDates.length - 1])}`;
}

function renderPlanBoard() {
  renderPool();
  if (!planDates.length) {
    document.getElementById('plan-days').innerHTML = '';
    destroyPlanSortables();
    return;
  }
  document.getElementById('plan-days').innerHTML = planDates.map(renderDayTable).join('');
  updatePlanWeekLabel();
  if (planViewMode === 'sessions' && currentUser?.isAdmin) initPlanSortables();
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

// Jump to the week containing a date.
async function goToPlanWeek(date) {
  if (!date) return;
  const weekOfDate = mondayOf(date);
  if (weekOfDate === planWeekStart) return;
  planWeekStart = weekOfDate;
  try {
    await loadPlanBoard();
  } catch (err) {
    const errEl = document.getElementById('plan-error');
    errEl.textContent = t('plan.loadError', { msg: err.message });
    errEl.style.display = 'block';
  }
}

function shiftPlanWeek(delta) {
  if (!planWeekStart) return;
  goToPlanWeek(shiftISO(planWeekStart, delta * 7));
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
      filter: '.assigned-remove',
      preventOnFilter: false,
      onAdd: onPersonDropped,
    }));
  });
}

function planAssignmentTarget(cell) {
  const seriesId = Number(cell.dataset.seriesId);
  const occurrenceDate = cell.dataset.recurrenceDate || cell.dataset.occurrenceDate;
  const sessionId = Number(cell.dataset.sessionId);
  const recurring = Number.isSafeInteger(seriesId) && seriesId > 0 && occurrenceDate;
  const occurrence = planSessions.find(item => recurring
    ? Number(item.recurring_series_id) === seriesId && item.recurrence_date === occurrenceDate
    : Number(item.session_id) === sessionId);
  if (!occurrence || (!recurring && (!Number.isSafeInteger(sessionId) || sessionId < 1))) return null;
  return { seriesId, occurrenceDate, sessionId, recurring, occurrence };
}

async function savePlanAssignment(cell, employeeId, assigned, target) {
  if (!currentUser?.isAdmin) return;
  target = target || planAssignmentTarget(cell);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !target) {
    renderPlanBoard();
    return;
  }
  renderPlanBoard();
  try {
    const res = await api('/api/admin/schedule/reassign', {
      method: 'POST',
      body: JSON.stringify({
        ...(target.recurring
          ? { seriesId: target.seriesId, occurrenceDate: target.occurrenceDate }
          : { sessionId: target.sessionId }),
        employeeId, assigned,
      }),
    });
    if (!res.ok) await showNotice(t('err.assignFailed') + (await res.text()));
  } catch (err) {
    await showNotice(t('err.network') + err.message);
  }

  await loadPlanBoard();
  await loadMyTasks();
}

async function removePlanAssignee(cell, employeeId) {
  await savePlanAssignment(cell, Number(employeeId), false);
}

async function onPersonDropped(evt) {
  if (!currentUser?.isAdmin) return;
  const employeeId = Number(evt.item.dataset.employeeId);
  const target = planAssignmentTarget(evt.to);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !target) {
    renderPlanBoard();
    return;
  }
  const assignees = planAssignees(target.occurrence);
  const assigned = !assignees.some(person => Number(person.employee_id) === employeeId);
  await savePlanAssignment(evt.to, employeeId, assigned, target);
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
  document.getElementById('plan-hint').textContent =
    t(currentUser?.isAdmin ? 'plan.adminHint' : 'plan.viewerHint');
  document.getElementById('plan-mode-switch').style.display =
    currentUser?.isAdmin ? 'flex' : 'none';
  sessionById = new Map(data.sessions.map(s => [s.session_id, s]));
  sessionByOccurrence = new Map(data.sessions.filter(s => s.is_recurring)
    .map(s => [`${s.recurring_series_id}:${s.recurrence_date || s.session_date}`, s]));
  renderPlanBoard();
}

function initPlan() {
  planLoaded = true;
  planWeekStart = mondayOf();
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

