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
      showModalError(t('err.saveFailed') + (await res.text()));
    } else {
      const data = await res.json().catch(() => null);
      closeModal();
      refreshScheduleViews();
      if (data?.repeatFixed) {
        alert(t('alert.assignFixed'));
      } else if (data?.repeatedWeeks > 1) {
        alert(t('alert.assignRepeat', { n: data.repeatedWeeks }));
      }
    }
  } catch (err) {
    showModalError(t('err.network') + err.message);
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
    else alert(t('err.statusFailed'));
  });
});

// Delete only the clicked day
document.getElementById('session-delete').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm(t('confirm.deleteDay'))) return;
  const res = await api('/api/admin/schedule/delete', {
    method: 'POST',
    body: JSON.stringify({ sessionId: currentSession.session_id }),
  });
  if (res.ok) { closeModal(); refreshScheduleViews(); }
  else alert(t('err.deleteFailed'));
});

// Delete the clicked day AND every later occurrence of the same series:
// same task, same start/end time, same weekday, from this date onward.
// Same task at a different time or weekday is never touched.
document.getElementById('session-delete-series').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm(t('confirm.deleteSeries'))) return;
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
      if (n > 1) alert(t('alert.deleteCount', { n }));
    } else {
      alert(t('err.deleteFailed') + ': ' + (await res.text()));
    }
  } catch (err) {
    alert(t('err.network') + err.message);
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
      alert(t('err.applyFailed') + (await res.text()));
    } else {
      const data = await res.json().catch(() => null);
      if (data?.skipped > 0) {
        alert(t('alert.applySkipped', { a: data.applied, s: data.skipped }));
      }
      refreshScheduleViews();
    }
  } catch (err) {
    alert(t('err.network') + err.message);
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