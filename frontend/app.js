// ================= Event wiring =================

// ---- Language ----
document.getElementById('lang-btn').addEventListener('click', () =>
  setLang(lang === 'en' ? 'vi' : 'en'));
document.getElementById('lang-btn-login').addEventListener('click', () =>
  setLang(lang === 'en' ? 'vi' : 'en'));

// ---- Navigation & view switching ----
document.getElementById('nav-tasks').addEventListener('click', () => switchView('tasks'));
document.getElementById('nav-schedule').addEventListener('click', () => switchView('schedule'));
document.getElementById('nav-plan').addEventListener('click', () => switchView('plan'));
document.getElementById('nav-monthly').addEventListener('click', () => switchView('monthly-summary'));
document.getElementById('monthly-summary-prev').addEventListener('click', () => shiftSummaryMonth(-1));
document.getElementById('monthly-summary-next').addEventListener('click', () => shiftSummaryMonth(1));
document.getElementById('monthly-summary-current').addEventListener('click', () => {
  const now = new Date();
  monthCursor = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  document.getElementById('monthly-summary-status').style.display = 'none';
  loadMonthlySummary();
});
document.getElementById('monthly-summary-wrap').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-goal-action]');
  if (button && !button.disabled) await saveMonthlyGoal(button);
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

async function updateWeeklyTimetable(enabled, button) {
  if (!currentUser?.isAdmin || !scheduleWeekStart) return;
  let cutoffDate = null;
  if (enabled) {
    if (!confirm(t('schedule.importConfirm', { date: fmtShort(scheduleWeekStart) }))) return;
  } else {
    cutoffDate = window.prompt(t('schedule.applyFrom'), todayISO());
    if (!cutoffDate || !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate) ||
        !confirm(t('schedule.stopConfirm', { date: cutoffDate }))) return;
  }

  button.disabled = true;
  try {
    const res = await api('/api/admin/schedule/weekly-timetable', {
      method: 'POST',
      body: JSON.stringify({ enabled, ...(enabled ? { weekStart: scheduleWeekStart } : { cutoffDate }) }),
    });
    if (!res.ok) {
      alert(t('err.weeklyTemplateFailed') + (await res.text()));
      return;
    }
    const data = await res.json();
    weeklyTimetableEnabled = data.enabled;
    refreshScheduleViews();
  } catch (err) {
    alert(t('err.network') + err.message);
  } finally {
    button.disabled = false;
  }
}

document.getElementById('schedule-template-save').addEventListener('click', (e) =>
  updateWeeklyTimetable(true, e.currentTarget));
document.getElementById('schedule-template-disable').addEventListener('click', (e) =>
  updateWeeklyTimetable(false, e.currentTarget));
document.getElementById('schedule-timetable-edit').addEventListener('click', openTimetableEditor);

document.getElementById('schedule-copy-next').addEventListener('click', async (e) => {
  if (!currentUser?.isAdmin || !scheduleWeekStart) return;
  const targetWeekStart = shiftISO(scheduleWeekStart, 7);
  if (!confirm(t('confirm.copyWeek', {
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
      alert(t('err.copyWeekFailed') + (await res.text()));
      return;
    }
    const data = await res.json();
    scheduleWeekStart = data.targetWeekStart;
    refreshScheduleViews();
    alert(t('alert.copyWeek', {
      count: data.createdCount, skipped: data.skippedCount,
    }));
  } catch (err) {
    alert(t('err.network') + err.message);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('admin-schedule-grid').addEventListener('click', (e) => {
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

// ---- Plan board navigation (one day at a time) ----
document.getElementById('plan-prev').addEventListener('click', () => shiftPlanDay(-1));
document.getElementById('plan-next').addEventListener('click', () => shiftPlanDay(1));
document.getElementById('plan-today').addEventListener('click', () => goToPlanDay(todayISO()));

// Arrow keys browse days while the plan view is open
document.addEventListener('keydown', (e) => {
  if (!planLoaded) return;
  if (document.getElementById('plan-section').style.display !== 'block') return;
  if (modal.style.display === 'flex' || programModal.style.display === 'flex') return;
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
  if (taskLink) { openDetailsFromElement(taskLink); return; }
  const chip = e.target.closest('.person-chip.assigned');
  if (chip) openDetailsFromElement(chip);
});

document.getElementById('timetable-entry-list').addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-timetable-edit]');
  if (editButton) {
    editRecurringEntry(Number(editButton.dataset.timetableEdit));
    return;
  }
  const endButton = event.target.closest('[data-timetable-end]');
  if (!endButton) return;
  const cutoffDate = window.prompt(t('schedule.applyFrom'), todayISO());
  if (!cutoffDate || !/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate) ||
      !confirm(t('schedule.endSeriesConfirm', { date: cutoffDate }))) return;
  const response = await api('/api/admin/schedule/timetable', {
    method: 'POST',
    body: JSON.stringify({ operation: 'end', seriesId: Number(endButton.dataset.timetableEnd), cutoffDate }),
  });
  if (!response.ok) {
    document.getElementById('timetable-editor-error').textContent = await response.text();
    document.getElementById('timetable-editor-error').style.display = 'block';
    return;
  }
  resetRecurringEditor();
  await loadTimetableEditor();
  refreshScheduleViews();
});

document.getElementById('recurring-cancel-edit').addEventListener('click', resetRecurringEditor);
document.getElementById('timetable-entry-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const seriesId = Number(document.getElementById('recurring-series-id').value) || null;
  const cutoffDate = document.getElementById('recurring-cutoff').value;
  const replaceFutureExceptions = document.getElementById('recurring-replace-exceptions').checked;
  if (seriesId && (!cutoffDate || !confirm(t('schedule.recurringEditConfirm', {
    date: cutoffDate,
    policy: t(replaceFutureExceptions ? 'schedule.exceptionReplaced' : 'schedule.exceptionPreserved'),
  })))) return;
  const body = {
    operation: seriesId ? 'edit' : 'create',
    ...(seriesId ? { seriesId, cutoffDate, replaceFutureExceptions } : {}),
    weekday: Number(document.getElementById('recurring-weekday').value),
    programId: Number(document.getElementById('recurring-program').value),
    employeeId: document.getElementById('recurring-employee').value
      ? Number(document.getElementById('recurring-employee').value) : null,
    startTime: document.getElementById('recurring-start').value || null,
    endTime: document.getElementById('recurring-end').value || null,
    points: Number(document.getElementById('recurring-points').value),
    isSudden: document.getElementById('recurring-sudden').checked,
    notes: document.getElementById('recurring-notes').value || null,
    startDate: document.getElementById('recurring-start-date').value,
    endDate: document.getElementById('recurring-end-date').value || null,
  };
  const error = document.getElementById('timetable-editor-error');
  error.style.display = 'none';
  const button = document.getElementById('recurring-save');
  button.disabled = true;
  try {
    const response = await api('/api/admin/schedule/timetable', {
      method: 'POST', body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await response.text());
    resetRecurringEditor();
    await loadTimetableEditor();
    refreshScheduleViews();
  } catch (err) {
    error.textContent = err.message;
    error.style.display = 'block';
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
    };
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
      const scope = document.getElementById('recurring-edit-mode').value;
      const movedDate = document.getElementById('assign-date').value;
      const seriesId = currentSession.recurring_series_id;
      if (scope === 'future') {
        const cutoffDate = document.getElementById('recurring-edit-cutoff').value;
        const replaceFutureExceptions = document.getElementById('recurring-edit-replace-exceptions').checked;
        if (!cutoffDate || !confirm(t('schedule.recurringEditConfirm', {
          date: cutoffDate,
          policy: t(replaceFutureExceptions ? 'schedule.exceptionReplaced' : 'schedule.exceptionPreserved'),
        }))) return;
        endpoint = '/api/admin/schedule/timetable';
        requestBody = {
          operation: 'edit', seriesId, cutoffDate,
          weekday: new Date(`${movedDate}T00:00:00Z`).getUTCDay(),
          replaceFutureExceptions, ...payload,
        };
      } else {
        if (!confirm(t('schedule.exceptionEditConfirm', { date: currentSession.session_date }))) return;
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
        alert(t('alert.assignRepeat', { n: data.repeatedWeeks }));
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
document.getElementById('recurring-edit-mode').addEventListener('change', (event) => {
  const showFuture = event.target.value === 'future';
  document.getElementById('recurring-edit-cutoff-wrap').style.display = showFuture ? 'block' : 'none';
  document.getElementById('recurring-edit-preserve-wrap').style.display = showFuture ? 'flex' : 'none';
});
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
    if (currentSession.is_recurring && b.dataset.status === 'cancelled' &&
        !confirm(t('schedule.cancelOccurrenceConfirm', { date: currentSession.session_date }))) return;
    const body = currentSession.is_recurring
      ? { ...recurringSessionPayload(currentSession), status: b.dataset.status,
          occurrenceNotes: document.getElementById('occurrence-notes').value || null }
      : { sessionId: currentSession.session_id, status: b.dataset.status };
    const res = await api('/api/admin/schedule/status', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.ok) { closeModal(); refreshScheduleViews(); }
    else alert(t('err.statusFailed'));
  });
});

// Delete only the clicked day
document.getElementById('session-delete').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm(t('confirm.deleteDay'))) return;
  const body = currentSession.is_recurring
    ? recurringSessionPayload(currentSession)
    : { sessionId: currentSession.session_id };
  const res = await api('/api/admin/schedule/delete', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.ok) { closeModal(); refreshScheduleViews(); }
  else alert(t('err.deleteFailed'));
});

document.getElementById('session-end-series').addEventListener('click', async () => {
  if (!currentSession?.is_recurring) return;
  const recurrenceDate = currentSession.recurrence_date || currentSession.session_date;
  const cutoffDate = recurrenceDate > todayISO() ? recurrenceDate : todayISO();
  if (!confirm(t('schedule.endSeriesConfirm', { date: cutoffDate }))) return;
  const response = await api('/api/admin/schedule/timetable', {
    method: 'POST',
    body: JSON.stringify({
      operation: 'end', seriesId: currentSession.recurring_series_id, cutoffDate,
    }),
  });
  if (!response.ok) {
    showModalError(await response.text());
    return;
  }
  closeModal();
  refreshScheduleViews();
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
  if (!code || !name) { showProgramError(t('err.codeName')); return; }
  if (!Number.isFinite(defaultPoints) || defaultPoints < 0) {
    showProgramError(t('err.points'));
    return;
  }

  btn.disabled = true;
  try {
    const res = await api('/api/admin/programs', {
      method: 'POST',
      body: JSON.stringify({ code, name, category, defaultPoints, defaultStart, defaultEnd }),
    });
    if (!res.ok) {
      showProgramError(t('err.saveFailed') + (await res.text()));
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
    showProgramError(t('err.network') + err.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('program-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.pm-del');
  if (!btn) return;
  if (!confirm(t('confirm.programDelete'))) return;
  document.getElementById('program-error').style.display = 'none';
  try {
    const res = await api('/api/admin/programs/delete', {
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

// ================= Boot =================

applyTranslations();
refreshLangButtons();
load();