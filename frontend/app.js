// ================= Event wiring =================

let historyPage = 1;
let historyPageCount = 1;
let historyRequestInFlight = false;

function fmtHistoryTime(value) {
  const raw = String(value);
  const timestamp = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (!Number.isFinite(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp);
}

function renderHistoryEntry(entry) {
  return `<tr>
    <td data-label="${escapeHtml(t('history.date'))}">${escapeHtml(fmtHistoryTime(entry.acted_at))}</td>
    <td data-label="${escapeHtml(t('history.actor'))}">${escapeHtml(entry.actor_email)}</td>
    <td data-label="${escapeHtml(t('history.action'))}">${escapeHtml(entry.action)}</td>
    <td data-label="${escapeHtml(t('history.record'))}">${escapeHtml(entry.entity)}${entry.entity_id == null ? '' : ` #${escapeHtml(entry.entity_id)}`}</td>
    <td data-label="${escapeHtml(t('history.details'))}">${escapeHtml(entry.details)}</td>
  </tr>`;
}

async function loadHistory(page = 1) {
  if (historyRequestInFlight) return;
  historyRequestInFlight = true;
  const tbody = document.getElementById('history-entries');
  const loading = document.getElementById('history-loading');
  const empty = document.getElementById('history-empty');
  const error = document.getElementById('history-error');
  const previous = document.getElementById('history-prev');
  const next = document.getElementById('history-next');
  tbody.innerHTML = '';
  loading.style.display = 'block';
  empty.style.display = 'none';
  error.style.display = 'none';
  previous.disabled = true;
  next.disabled = true;
  const params = new URLSearchParams({
    page: String(page),
    limit: '50',
    staff: document.getElementById('history-staff-filter').value.trim(),
    record: document.getElementById('history-record-filter').value.trim(),
    from: document.getElementById('history-from-filter').value,
    to: document.getElementById('history-to-filter').value,
  });
  try {
    const response = await api(`/api/schedule/history?${params}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const { entries, page: currentPage, pageCount } = await response.json();
    if (!Array.isArray(entries) || !Number.isInteger(currentPage) ||
        !Number.isInteger(pageCount) || pageCount < 1) throw new Error('Invalid response');
    tbody.insertAdjacentHTML('beforeend', entries.map(renderHistoryEntry).join(''));
    historyPage = currentPage;
    historyPageCount = pageCount;
    document.getElementById('history-page').value = String(historyPage);
    document.getElementById('history-page').max = String(historyPageCount);
    document.getElementById('history-page-count').textContent =
      t('history.pageOf', { count: historyPageCount });
    empty.style.display = entries.length ? 'none' : 'block';
    previous.disabled = historyPage <= 1;
    next.disabled = historyPage >= historyPageCount;
  } catch (err) {
    error.textContent = t('history.loadError', { status: err.message || 'network error' });
    error.style.display = 'block';
    document.getElementById('history-page').value = String(historyPage);
    previous.disabled = historyPage <= 1;
    next.disabled = historyPage >= historyPageCount;
  } finally {
    loading.style.display = 'none';
    historyRequestInFlight = false;
  }
}

document.getElementById('history-filter-apply').addEventListener('click', () => loadHistory(1));
document.getElementById('history-prev').addEventListener('click', () => {
  if (historyPage > 1) loadHistory(historyPage - 1);
});
document.getElementById('history-next').addEventListener('click', () => {
  if (historyPage < historyPageCount) loadHistory(historyPage + 1);
});
document.getElementById('history-page').addEventListener('change', event => {
  const page = Number(event.target.value);
  if (Number.isSafeInteger(page) && page >= 1 && page <= historyPageCount) loadHistory(page);
  else event.target.value = String(historyPage);
});
document.getElementById('history-page').addEventListener('keydown', event => {
  if (event.key === 'Enter') event.currentTarget.dispatchEvent(new Event('change'));
});

async function loadStaffDirectory() {
  if (!currentUser?.isAdmin) return;
  const tbody = document.getElementById('staff-entries');
  const empty = document.getElementById('staff-empty');
  const error = document.getElementById('staff-error');
  error.style.display = 'none';
  try {
    const response = await api('/api/admin/employees');
    if (!response.ok) throw new Error(String(response.status));
    const { employees } = await response.json();
    if (!Array.isArray(employees)) throw new Error('Invalid response');
    tbody.innerHTML = employees.map(employee => {
      const name = `${employee.first_name} ${employee.last_name}`.trim();
      const active = Number(employee.is_active) === 1;
      const status = active ? t('staff.active') : t('staff.inactive');
      const isAdmin = Number(employee.is_admin) === 1;
      const action = isAdmin
        ? '—'
        : active
          ? `<button class="btn danger small" type="button" data-deactivate-employee="${Number(employee.employee_id)}">${escapeHtml(t('staff.deactivate'))}</button>`
          : `<button class="btn small" type="button" data-reactivate-employee="${Number(employee.employee_id)}">${escapeHtml(t('staff.reactivate'))}</button>`;
      return `<tr>
        <td data-label="${escapeHtml(t('staff.code'))}">${escapeHtml(employee.employee_code)}</td>
        <td data-label="${escapeHtml(t('summary.employee'))}">${escapeHtml(name)}${Number(employee.is_admin) === 1 ? ` (${escapeHtml(t('plan.adminTag'))})` : ''}</td>
        <td data-label="${escapeHtml(t('staff.email'))}">${escapeHtml(employee.email)}</td>
        <td data-label="${escapeHtml(t('staff.status'))}">${escapeHtml(status)}</td>
        <td data-label="${escapeHtml(t('staff.action'))}">${action}</td>
      </tr>`;
    }).join('');
    empty.style.display = employees.length ? 'none' : 'block';
    staffLoaded = true;
  } catch (err) {
    error.textContent = t('staff.loadError', { status: err.message || 'network error' });
    error.style.display = 'block';
  }
}

// ---- Language ----
const profileMenu = document.getElementById('profile-menu-panel');
const profileMenuToggle = document.getElementById('profile-menu-toggle');
const profileMenuContainer = document.querySelector('.profile-menu');
const closeProfileMenu = () => {
  profileMenu.hidden = true;
  profileMenuToggle.setAttribute('aria-expanded', 'false');
};

profileMenuToggle.addEventListener('click', () => {
  const isOpening = profileMenu.hidden;
  profileMenu.hidden = !isOpening;
  profileMenuToggle.setAttribute('aria-expanded', String(isOpening));
  if (isOpening) profileMenu.querySelector('button:not([hidden])')?.focus();
});
document.addEventListener('click', (event) => {
  if (!profileMenuContainer.contains(event.target)) closeProfileMenu();
});
profileMenuContainer.addEventListener('focusout', (event) => {
  if (!profileMenuContainer.contains(event.relatedTarget)) closeProfileMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !profileMenu.hidden) {
    closeProfileMenu();
    profileMenuToggle.focus();
  }
});

document.getElementById('lang-btn').addEventListener('click', () =>
  setLang(lang === 'en' ? 'vi' : 'en'));
document.getElementById('lang-btn-login').addEventListener('click', () =>
  setLang(lang === 'en' ? 'vi' : 'en'));

// ---- Navigation & view switching ----
document.getElementById('nav-tasks').addEventListener('click', () => switchView('tasks'));
document.getElementById('nav-schedule').addEventListener('click', () => switchView('schedule'));
document.getElementById('nav-plan').addEventListener('click', () => switchView('plan'));
document.getElementById('nav-monthly').addEventListener('click', () => switchView('monthly-summary'));
document.getElementById('nav-quarterly').addEventListener('click', () => switchView('quarterly-report'));
document.getElementById('nav-history').addEventListener('click', () => switchView('history'));
document.getElementById('nav-staff').addEventListener('click', () => switchView('staff'));
document.getElementById('monthly-summary-prev').addEventListener('click', () => shiftSummaryMonth(-1));
document.getElementById('monthly-summary-next').addEventListener('click', () => shiftSummaryMonth(1));
document.getElementById('monthly-summary-current').addEventListener('click', () => {
  const [year, month] = todayISO().split('-').map(Number);
  monthCursor = { year, month };
  document.getElementById('monthly-summary-status').style.display = 'none';
  loadMonthlySummary();
});
document.getElementById('monthly-summary-wrap').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-goal-action]');
  if (button && !button.disabled) await saveMonthlyGoal(button);
  const sessionLink = event.target.closest('[data-month-session]');
  if (sessionLink) {
    openMonthlySessions(
      Number(sessionLink.dataset.employeeId),
      Number(sessionLink.dataset.year),
      Number(sessionLink.dataset.month),
      sessionLink.dataset.employeeName,
      [{
        month: Number(sessionLink.dataset.month),
        completed_points: Number(sessionLink.dataset.completedPoints),
        completed_sessions: Number(sessionLink.dataset.completedSessions),
      }],
    );
  }
});

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
document.getElementById('schedule-jump-date').addEventListener('change', (event) => {
  if (!event.target.value) return;
  scheduleWeekStart = mondayOf(event.target.value);
  event.target.closest('details').open = false;
  loadSchedule();
});

async function updateWeeklyTimetable(enabled, button) {
  if (!currentUser?.isAdmin || !scheduleWeekStart) return;
  let cutoffDate = null;
  if (enabled) {
    if (!await confirmAction(t('schedule.importConfirm', { date: fmtShort(scheduleWeekStart) }))) return;
  } else {
    const change = await requestScheduleChange({ title: t('schedule.templateDisable'),
      summary: t('schedule.stopAllSummary'), impact: t('schedule.endImpact') });
    if (!change) return;
    cutoffDate = change.cutoffDate;
  }

  button.disabled = true;
  try {
    const res = await api('/api/admin/schedule/weekly-timetable', {
      method: 'POST',
      body: JSON.stringify({ enabled, ...(enabled ? { weekStart: scheduleWeekStart } : { cutoffDate }) }),
    });
    if (!res.ok) {
      await showNotice(t('err.weeklyTemplateFailed') + (await res.text()));
      return;
    }
    const data = await res.json();
    weeklyTimetableEnabled = data.enabled;
    refreshScheduleViews();
  } catch (err) {
    await showNotice(t('err.network') + err.message);
  } finally {
    button.disabled = false;
  }
}

document.getElementById('schedule-template-save').addEventListener('click', (e) =>
  updateWeeklyTimetable(true, e.currentTarget));
document.getElementById('schedule-template-disable').addEventListener('click', (e) =>
  updateWeeklyTimetable(false, e.currentTarget));
document.getElementById('schedule-mode-dated').addEventListener('click', () => setScheduleMode('dated'));
document.getElementById('schedule-mode-timetable').addEventListener('click', () => setScheduleMode('timetable'));

document.getElementById('schedule-copy-next').addEventListener('click', async (e) => {
  if (!currentUser?.isAdmin || !scheduleWeekStart) return;
  const targetWeekStart = shiftISO(scheduleWeekStart, 7);
  if (!await confirmAction(t('confirm.copyWeek', {
    from: fmtShort(scheduleWeekStart), to: fmtShort(targetWeekStart),
  }))) return;

  const button = e.currentTarget;
  button.disabled = true;
  try {
    const res = await api('/api/admin/schedule/copy-week', {
      method: 'POST',
      body: JSON.stringify({ weekStart: scheduleWeekStart }),
    });
    if (!res.ok) {
      await showNotice(t('err.copyWeekFailed') + (await res.text()));
      return;
    }
    const data = await res.json();
    scheduleWeekStart = data.targetWeekStart;
    refreshScheduleViews();
    await showNotice(t('alert.copyWeek', {
      count: data.createdCount, skipped: data.skippedCount,
    }));
  } catch (err) {
    await showNotice(t('err.network') + err.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('admin-schedule-grid').addEventListener('click', (e) => {
  if (!currentUser?.isAdmin) return;
  const addButton = e.target.closest('.grid-add-session');
  if (addButton) {
    const cell = addButton.closest('.grid-cell');
    const raw = cell.dataset.employeeId;
    openAssignModal(raw === undefined || raw === '' ? null : Number(raw), cell.dataset.date);
    return;
  }
  const chip = e.target.closest('.slot-chip');
  if (chip) {
    openDetailsFromElement(chip);
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

// ---- Plan board navigation (one week at a time) ----
document.getElementById('plan-prev').addEventListener('click', () => shiftPlanWeek(-1));
document.getElementById('plan-next').addEventListener('click', () => shiftPlanWeek(1));
document.getElementById('plan-jump-today').addEventListener('click', (event) => {
  event.currentTarget.closest('details').open = false;
  goToPlanWeek(todayISO());
});
document.getElementById('plan-jump-week').addEventListener('click', (event) => {
  event.currentTarget.closest('details').open = false;
  goToPlanWeek(mondayOf());
});
document.getElementById('plan-jump-date').addEventListener('change', (event) => {
  if (!event.target.value) return;
  event.target.closest('details').open = false;
  goToPlanWeek(event.target.value);
});
document.getElementById('plan-mode-sessions').addEventListener('click', () => setPlanViewMode('sessions'));
document.getElementById('plan-mode-timetable').addEventListener('click', () => setPlanViewMode('timetable'));

// Arrow keys browse weeks while the plan view is open
document.addEventListener('keydown', (e) => {
  if (!planLoaded) return;
  if (document.getElementById('plan-section').style.display !== 'block') return;
  if (planViewMode !== 'sessions') return;
  if (document.getElementById('schedule-change-dialog').open) return;
  if (modal.open || programModal.open) return;
  if (document.activeElement?.closest?.('.nav-jump')) return;
  const tag = ((document.activeElement && document.activeElement.tagName) || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); shiftPlanWeek(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); shiftPlanWeek(1); }
});

// ---- Plan board clicks ----
document.getElementById('plan-days').addEventListener('click', (e) => {
  const addBtn = e.target.closest('.add-task-btn');
  if (addBtn) { openPlanAddModal(addBtn.dataset.date, addBtn.dataset.period); return; }
  const removeBtn = e.target.closest('.assigned-remove');
  if (removeBtn) {
    e.preventDefault();
    e.stopPropagation();
    const cell = removeBtn.closest('.cell-person-slot');
    if (cell) removePlanAssignee(cell, removeBtn.dataset.employeeId);
    return;
  }
  const taskLink = e.target.closest('.task-link');
  if (taskLink) {
    if (taskLink.dataset.seriesId) {
      openRecurringRuleFromOccurrence(taskLink.dataset.seriesId,
        taskLink.dataset.recurrenceDate || taskLink.dataset.occurrenceDate);
    } else {
      openDetailsFromElement(taskLink);
    }
    return;
  }
  const chip = e.target.closest('.person-chip.assigned');
  if (chip) openDetailsFromElement(chip);
});

function handleTimetableGridClick(event) {
  const addButton = event.target.closest('[data-timetable-add]');
  if (addButton) {
    openRuleModal(Number(addButton.dataset.timetableAdd));
    return;
  }
  const editButton = event.target.closest('[data-timetable-edit]');
  if (editButton) {
    if (editButton.dataset.occurrenceDate) {
      openRecurringRuleFromOccurrence(editButton.dataset.timetableEdit, editButton.dataset.occurrenceDate);
      return;
    }
    const rule = recurringEntries.find(item => Number(item.series_id) === Number(editButton.dataset.timetableEdit));
    if (rule) openRuleModal(rule.weekday, rule);
    return;
  }
  const cell = event.target.closest('.grid-cell');
  if (cell) openRuleModal(Number(cell.dataset.weekday));
}

document.getElementById('timetable-grid').addEventListener('click', handleTimetableGridClick);
document.getElementById('plan-timetable-grid').addEventListener('click', handleTimetableGridClick);

document.getElementById('assign-rule-stop').addEventListener('click', async (event) => {
  if (!editingTimetable || !currentRule) return;
  const entry = currentRule;
  const change = await requestScheduleChange({ title: t('schedule.endSeries'),
    summary: entry.program_name, impact: t('schedule.endImpact') });
  if (!change) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await api('/api/admin/schedule/timetable', {
      method: 'POST',
      body: JSON.stringify({ operation: 'end', seriesId: entry.series_id, cutoffDate: change.cutoffDate }),
    });
    if (!response.ok) throw new Error(await response.text());
    closeModal();
    refreshScheduleViews();
  } catch (err) {
    showModalError(err.message);
  } finally {
    button.disabled = false;
  }
});

// ---- Modal wiring ----
document.getElementById('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// "＋ Create new task…" opens the task types modal; otherwise recalc defaults
document.getElementById('assign-program').addEventListener('change', (e) => {
  if (e.target.value === '__new__') { openProgramModal(); return; }
  refreshAssignDefaults();
});
document.getElementById('assign-sudden').addEventListener('change', () => {
  if (!editingTimetable) { refreshAssignDefaults(); return; }
  refreshTimetableDefaultPoints();
});

// Live allocation hint while the start time is edited
document.getElementById('assign-start').addEventListener('input', updateAssignPeriodHint);

document.getElementById('assign-repeat').addEventListener('change', (e) => {
  document.getElementById('assign-repeat-row').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('modal-assign-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('assign-submit');
  if (btn.disabled) return;
  const correctionReason = document.getElementById('correction-reason').value.trim();
  btn.disabled = true;
  try {
    const repeatOn = document.getElementById('assign-repeat').checked;
    const weeksRaw = document.getElementById('assign-repeat-weeks').value.trim();
    const repeatWeeks = repeatOn
      ? Math.min(53, Math.max(1, parseInt(weeksRaw, 10) || 1))
      : 1;

    const isEditing = editingSession && currentSession;
    const payload = {
      programId: Number(document.getElementById('assign-program').value),
      startTime: document.getElementById('assign-start').value || null,
      endTime: document.getElementById('assign-end').value || null,
      points: Number(document.getElementById('assign-points').value),
      isSudden: document.getElementById('assign-sudden').checked,
      notes: document.getElementById('assign-notes').value || null,
      ...(correctionReason ? { correctionReason } : {}),
    };
    if (editingTimetable) {
      await saveTimetableRule(payload);
      return;
    }
    let endpoint = isEditing ? '/api/admin/schedule/update' : '/api/admin/schedule/assign';
    let requestBody = isEditing
      ? { ...payload, sessionId: currentSession.session_id, sessionDate: document.getElementById('assign-date').value }
      : {
          ...payload,
          employeeId: modalEmployeeId,
          date: modalDate,
          repeatWeeks,
        };
    if (isEditing && currentSession.is_recurring) {
      const movedDate = document.getElementById('assign-date').value;
      const seriesId = currentSession.recurring_series_id;
      const occurrenceDate = currentSession.recurrence_date || currentSession.session_date;
      const weekday = new Date(`${movedDate}T00:00:00Z`).getUTCDay();
      const change = await requestScheduleChange({ title: t('modal.editTitle'),
        summary: `${scheduleChangeSummary(currentSession, { ...currentSession, ...payload, weekday })}\n${currentSession.session_date} → ${movedDate}`,
        date: occurrenceDate > todayISO() ? occurrenceDate : todayISO(), occurrenceDate,
        allowOccurrence: true, allowReplace: true });
      if (!change) return;
      if (!await confirmRecurringRuleConflict({
        employeeId: currentSession.employee_id, weekday, ...payload,
        startDate: currentSession.start_date || occurrenceDate,
        endDate: currentSession.end_date || null,
        effectiveFrom: change.scope === 'future' ? change.cutoffDate : undefined,
        occurrenceDate: change.scope === 'occurrence' ? occurrenceDate : undefined,
      }, seriesId)) return;
      if (change.scope === 'future') {
        endpoint = '/api/admin/schedule/timetable';
        requestBody = {
          operation: 'edit', seriesId, cutoffDate: change.cutoffDate,
          weekday, replaceFutureExceptions: change.replaceFutureExceptions, ...payload,
        };
      } else {
        endpoint = '/api/admin/schedule/timetable';
        requestBody = {
          operation: 'exception', action: 'modify', seriesId,
          cutoffDate: currentSession.recurrence_date || currentSession.session_date,
          occurrenceDate: currentSession.recurrence_date || currentSession.session_date,
          movedDate, employeeId: currentSession.employee_id, ...payload,
        };
      }
    }
    const res = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) {
      showModalError(t('err.saveFailed') + (await res.text()));
    } else {
      const data = await res.json().catch(() => null);
      closeModal();
      refreshScheduleViews();
      if (!isEditing && data?.repeatedWeeks > 1) {
        await showNotice(t('alert.assignRepeat', { n: data.repeatedWeeks }));
      }
    }
  } catch (err) {
    showModalError(t('err.network') + err.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('session-edit').addEventListener('click', openSessionEdit);
document.getElementById('session-clone').addEventListener('click', openSessionClone);
document.getElementById('clone-back').addEventListener('click', () => {
  if (currentSession) openDetailsModal(currentSession.session_id);
});
document.getElementById('clone-submit').addEventListener('click', async (e) => {
  if (!currentSession) return;
  const dates = [...document.querySelectorAll('#clone-date-options input:checked')].map(input => input.value);
  if (!dates.length) {
    showModalError(t('err.cloneDays'));
    return;
  }
  const button = e.currentTarget;
  button.disabled = true;
  try {
    const res = await api('/api/admin/schedule/clone', {
      method: 'POST',
      body: JSON.stringify({ sessionId: currentSession.session_id, dates }),
    });
    if (!res.ok) {
      showModalError(t('err.cloneFailed') + (await res.text()));
    } else {
      closeModal();
      refreshScheduleViews();
    }
  } catch (err) {
    showModalError(t('err.network') + err.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll('#modal-details [data-status]').forEach(b => {
  b.addEventListener('click', async () => {
    if (!currentSession) return;
    if (currentSession.is_recurring && b.dataset.status === 'cancelled') {
      const change = await requestScheduleChange({ title: t('action.cancel'), summary: currentSession.program_name,
        scope: 'occurrence', occurrenceDate: currentSession.session_date });
      if (!change) return;
    }
    const body = currentSession.is_recurring
      ? { ...recurringSessionPayload(currentSession), status: b.dataset.status,
          occurrenceNotes: document.getElementById('occurrence-notes').value || null }
      : { sessionId: currentSession.session_id, status: b.dataset.status };
    const res = await api('/api/admin/schedule/status', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.ok) { closeModal(); refreshScheduleViews(); }
    else await showNotice(t('err.statusFailed'));
  });
});

// Delete only the clicked day
document.getElementById('session-delete').addEventListener('click', async () => {
  if (!currentSession) return;
  if (currentSession.is_recurring) {
    const change = await requestScheduleChange({ title: t('action.deleteDay'), summary: currentSession.program_name,
      scope: 'occurrence', occurrenceDate: currentSession.session_date });
    if (!change) return;
  } else if (!await confirmAction(t('confirm.deleteDay'))) return;
  const body = currentSession.is_recurring
    ? recurringSessionPayload(currentSession)
    : { sessionId: currentSession.session_id };
  const res = await api('/api/admin/schedule/delete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.ok) { closeModal(); refreshScheduleViews(); }
  else await showNotice(t('err.deleteFailed'));
});

document.getElementById('session-end-series').addEventListener('click', async () => {
  if (!currentSession?.is_recurring) return;
  const recurrenceDate = currentSession.recurrence_date || currentSession.session_date;
  const change = await requestScheduleChange({ title: t('schedule.endSeries'), summary: currentSession.program_name,
    date: recurrenceDate > todayISO() ? recurrenceDate : todayISO(), impact: t('schedule.endImpact') });
  if (!change) return;
  try {
    const response = await api('/api/admin/schedule/timetable', {
      method: 'POST',
      body: JSON.stringify({ operation: 'end', seriesId: currentSession.recurring_series_id, cutoffDate: change.cutoffDate }),
    });
    if (!response.ok) throw new Error(await response.text());
    closeModal();
    refreshScheduleViews();
  } catch (err) {
    showModalError(err.message);
  }
});

document.getElementById('occurrence-notes-save').addEventListener('click', async () => {
  if (!currentSession?.is_recurring) return;
  const response = await api('/api/admin/schedule/status', {
    method: 'POST',
    body: JSON.stringify({
      ...recurringSessionPayload(currentSession),
      status: currentSession.status,
      occurrenceNotes: document.getElementById('occurrence-notes').value,
    }),
  });
  if (!response.ok) {
    showModalError(await response.text());
    return;
  }
  closeModal();
  refreshScheduleViews();
});

// ---- Task types modal wiring (create / delete programs) ----
document.getElementById('manage-tasks-btn').addEventListener('click', openProgramModal);
document.getElementById('program-modal-close').addEventListener('click', closeProgramModal);
document.getElementById('program-cancel-edit').addEventListener('click', cancelProgramEdit);
programModal.addEventListener('click', (e) => { if (e.target === programModal) closeProgramModal(); });

document.getElementById('program-submit').addEventListener('click', async (e) => {
  const btn = e.target;
  const isEditing = editingProgramId !== null;
  const code = document.getElementById('program-code').value.trim();
  const name = document.getElementById('program-name').value.trim();
  const category = document.getElementById('program-category').value.trim() || 'general';
  const defaultPoints = Number(document.getElementById('program-points').value);
  const defaultStart = document.getElementById('program-start').value || null;
  const defaultEnd = document.getElementById('program-end').value || null;

  document.getElementById('program-error').style.display = 'none';
  if ((!isEditing && !code) || !name) { showProgramError(t('err.codeName')); return; }
  if (!Number.isFinite(defaultPoints) || defaultPoints < 0 || defaultPoints > 100 ||
      (defaultStart && defaultEnd && defaultStart === defaultEnd)) {
    showProgramError(t('err.points'));
    return;
  }

  btn.disabled = true;
  try {
    const res = await api(isEditing ? '/api/admin/programs/update' : '/api/admin/programs', {
      method: 'POST',
      body: JSON.stringify({
        ...(isEditing ? { programId: editingProgramId } : { code, category }),
        name, defaultPoints, defaultStart, defaultEnd,
      }),
    });
    if (!res.ok) {
      showProgramError(t('err.saveFailed') + (await res.text()));
    } else {
      const data = await res.json();
      cancelProgramEdit();
      // Refresh the picker too; selects the new task if the assign form is open
      await refreshAdminPrograms(data.program?.program_id);
      renderProgramList();
    }
  } catch (err) {
    showProgramError(t('err.network') + err.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('program-list').addEventListener('click', async (e) => {
  const editButton = e.target.closest('.pm-edit');
  if (editButton) {
    beginProgramEdit(Number(editButton.dataset.programId));
    return;
  }
  const btn = e.target.closest('.pm-del, .pm-reactivate');
  if (!btn) return;
  const reactivating = btn.matches('.pm-reactivate');
  if (!await confirmAction(t(reactivating ? 'confirm.programReactivate' : 'confirm.programDelete'))) return;
  document.getElementById('program-error').style.display = 'none';
  try {
    const res = await api(reactivating
      ? '/api/admin/programs/reactivate'
      : '/api/admin/programs/delete', {
      method: 'POST',
      body: JSON.stringify({ programId: Number(btn.dataset.programId) }),
    });
    if (!res.ok) {
      showProgramError(t('err.deleteFailed') + ': ' + (await res.text()));
    } else {
      await refreshAdminPrograms();
      renderProgramList();
      if (planLoaded) loadPlanBoard(); // refresh the add-task pickers on the board
    }
  } catch (err) {
    showProgramError(t('err.network') + err.message);
  }
});

document.getElementById('staff-add-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('staff-status');
  const error = document.getElementById('staff-error');
  error.style.display = 'none';
  status.style.display = 'none';
  const body = {
    employeeCode: document.getElementById('staff-code').value.trim(),
    firstName: document.getElementById('staff-first-name').value.trim(),
    lastName: document.getElementById('staff-last-name').value.trim(),
    email: document.getElementById('staff-email').value.trim(),
  };
  try {
    const response = await api('/api/admin/employees', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(String(response.status));
    form.reset();
    await loadStaffDirectory();
    status.textContent = t('staff.added');
    status.className = 'summary-status summary-status-success';
    status.style.display = 'block';
  } catch (err) {
    error.textContent = t('staff.addError', { status: err.message || 'network error' });
    error.style.display = 'block';
  }
});

document.getElementById('staff-entries').addEventListener('click', async event => {
  const button = event.target.closest('[data-deactivate-employee], [data-reactivate-employee]');
  if (!button || !currentUser?.isAdmin) return;
  const deactivating = button.hasAttribute('data-deactivate-employee');
  const action = deactivating ? 'deactivate' : 'reactivate';
  const employeeId = Number(button.dataset.deactivateEmployee ?? button.dataset.reactivateEmployee);
  const name = button.closest('tr').children[1].textContent;
  const confirmation = deactivating ? 'staff.confirmDeactivate' : 'staff.confirmReactivate';
  if (!await confirmAction(t(confirmation, { name }))) return;
  const error = document.getElementById('staff-error');
  const status = document.getElementById('staff-status');
  error.style.display = 'none';
  status.style.display = 'none';
  button.disabled = true;
  try {
    const response = await api(`/api/admin/employees/${action}`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
    if (!response.ok) throw new Error(String(response.status));
    await loadStaffDirectory();
    status.textContent = t(deactivating ? 'staff.deactivated' : 'staff.reactivated');
    status.className = 'summary-status summary-status-success';
    status.style.display = 'block';
  } catch (err) {
    const errorKey = deactivating ? 'staff.deactivateError' : 'staff.reactivateError';
    error.textContent = t(errorKey, { status: err.message || 'network error' });
    error.style.display = 'block';
    button.disabled = false;
  }
});

// ================= Boot =================

applyTranslations();
refreshLangButtons();
load();