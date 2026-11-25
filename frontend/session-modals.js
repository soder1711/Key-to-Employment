// ================= Modal =================

const modal = document.getElementById('session-modal');
const programModal = document.getElementById('program-modal');

let editingSession = false;
let editingTimetable = false;
let currentRule = null;
let currentRuleOccurrence = null;

function setCorrectionReasonRequired(required) {
  const field = document.getElementById('correction-reason-field');
  const input = document.getElementById('correction-reason');
  field.style.display = required ? 'block' : 'none';
  input.required = required;
  input.disabled = !required;
  input.value = '';
}

function scheduleChangeSummary(before, after) {
  const describe = item => {
    const program = adminPrograms.find(p => p.program_id === Number(item.programId ?? item.program_id));
    const employeeId = item.employeeId !== undefined ? item.employeeId : item.employee_id;
    const employee = adminEmployees.find(e => e.employee_id === Number(employeeId));
    const details = [program?.name || item.program_name, employee ? `${employee.first_name} ${employee.last_name}`.trim() : t('person.unassigned'),
      dayName(Number(item.weekday ?? new Date(`${item.session_date}T00:00:00Z`).getUTCDay())),
      fmtTime(item.startTime !== undefined ? item.startTime : item.start_time),
      fmtTime(item.endTime !== undefined ? item.endTime : item.end_time),
      `${Number(item.points).toFixed(1)} ${t('unit.pts')}`];
    const startDate = item.startDate ?? item.start_date;
    if (startDate) details.push(t('schedule.ruleDates', { start: startDate,
      end: (item.endDate !== undefined ? item.endDate : item.end_date) || t('schedule.noEnd') }));
    if (item.isSudden ?? item.is_sudden) details.push(t('tag.sudden'));
    details.push(`${t('modal.notesPrefix')}${item.notes || '—'}`);
    return details.join(' · ');
  };
  return `${describe(before)} → ${describe(after)}`;
}

function requestScheduleChange({ title, summary, date = todayISO(), occurrenceDate = null,
  allowOccurrence = false, scope = 'future', allowReplace = false, minDate = todayISO(), impact = null }) {
  const dialog = document.getElementById('schedule-change-dialog');
  if (dialog.open) return Promise.resolve(null);
  const form = document.getElementById('schedule-change-form');
  const scopeInput = document.getElementById('schedule-change-scope');
  const dateInput = document.getElementById('schedule-change-date');
  const replace = document.getElementById('schedule-change-replace');
  const previousFocus = document.activeElement;
  document.getElementById('schedule-change-title').textContent = title;
  document.getElementById('schedule-change-summary').textContent = summary;
  scopeInput.value = scope;
  scopeInput.disabled = !allowOccurrence;
  dateInput.value = date;
  dateInput.min = minDate;
  replace.checked = false;
  const updateImpact = () => {
    const future = scopeInput.value === 'future';
    dateInput.disabled = !future;
    document.getElementById('schedule-change-date-wrap').style.display = future ? 'block' : 'none';
    document.getElementById('schedule-change-replace-wrap').style.display = future && allowReplace ? 'flex' : 'none';
    document.getElementById('schedule-change-impact').textContent = impact || (future
      ? t('schedule.futureImpact', { date: dateInput.value,
          policy: t(replace.checked && allowReplace ? 'schedule.exceptionReplaced' : 'schedule.exceptionPreserved') })
      : t('schedule.occurrenceImpact', { date: occurrenceDate }));
  };
  updateImpact();
  return new Promise(resolve => {
    let result = null;
    const submit = event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      result = { scope: scopeInput.value, cutoffDate: scopeInput.value === 'future' ? dateInput.value : occurrenceDate,
        replaceFutureExceptions: scopeInput.value === 'future' && allowReplace && replace.checked };
      dialog.close();
    };
    const cancel = () => dialog.close();
    const finish = () => {
      form.removeEventListener('submit', submit);
      form.removeEventListener('input', updateImpact);
      document.getElementById('schedule-change-cancel').removeEventListener('click', cancel);
      previousFocus?.focus();
      resolve(result);
    };
    form.addEventListener('submit', submit);
    form.addEventListener('input', updateImpact);
    document.getElementById('schedule-change-cancel').addEventListener('click', cancel);
    dialog.addEventListener('close', finish, { once: true });
    dialog.showModal();
  });
}

function openModal(which) {
  editingTimetable = which === 'rule';
  document.getElementById('assign-rule-fields').style.display = editingTimetable ? 'block' : 'none';
  document.getElementById('assign-rule-stop').style.display = editingTimetable && currentRule ? 'inline-block' : 'none';
  document.getElementById('assign-rule-start').disabled = !editingTimetable || !!currentRule;
  document.getElementById('assign-rule-start').required = editingTimetable;
  document.getElementById('assign-rule-end').disabled = !editingTimetable;
  document.getElementById('assign-program').required = editingTimetable;
  document.getElementById('assign-points').required = editingTimetable;
  document.getElementById('modal-assign-form').style.display =
    which === 'assign' || which === 'edit' || editingTimetable ? 'block' : 'none';
  document.getElementById('modal-details').style.display = which === 'details' ? 'block' : 'none';
  document.getElementById('session-clone-form').style.display = which === 'clone' ? 'block' : 'none';
  document.getElementById('modal-error').style.display = 'none';
  if (!modal.open) modal.showModal();
  const focusTarget = editingTimetable
    ? document.getElementById('assign-weekday')
    : document.getElementById(which === 'details' ? 'session-edit' :
      which === 'clone' ? 'clone-back' : 'assign-program');
  focusTarget.focus();
}

function closeModal() {
  if (modal.open) modal.close();
  currentSession = null;
  editingSession = false;
  editingTimetable = false;
  currentRule = null;
  currentRuleOccurrence = null;
  setCorrectionReasonRequired(false);
}

modal.addEventListener('close', () => {
  currentSession = null;
  editingSession = false;
  editingTimetable = false;
  currentRule = null;
  currentRuleOccurrence = null;
  setCorrectionReasonRequired(false);
});

function showModalError(msg) {
  const el = document.getElementById('modal-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// "＋ Create new task…" entry in the task picker
const newProgramOption = () =>
  `<option value="__new__">＋ ${t('programs.new')}…</option>`;

function populatePrograms(currentProgramId = null, currentSession = null) {
  const sel = document.getElementById('assign-program');
  const programs = [...adminPrograms];
  if (currentSession && !programs.some(p => p.program_id === currentProgramId)) {
    programs.push({
      program_id: currentProgramId,
      code: currentSession.program_code,
      name: currentSession.program_name,
      category: currentSession.category,
      default_points: currentSession.program_default_points ??
        (currentSession.is_sudden ? Number(currentSession.points || 0) / 2 : currentSession.points),
      is_deleted: Number(currentSession.program_is_active) === 0,
    });
  }
  sel.innerHTML = programs.map(p =>
    `<option value="${p.program_id}">${escapeHtml(p.code)} — ${escapeHtml(p.name)} ` +
    `(${escapeHtml(p.category)}, ${Number(p.default_points).toFixed(1)} ${t('unit.pts')}` +
    `${p.is_deleted ? `, ${t('programs.deletedTag')}` : ''})</option>`).join('') +
    newProgramOption();
}

// Automatic allocation: tells (live) which column the task will appear in,
// decided purely by the start time.
function updateAssignPeriodHint() {
  const el = document.getElementById('assign-period-hint');
  if (!el) return;
  const start = document.getElementById('assign-start').value;
  el.textContent = start
    ? t('period.hint', { period: start < '12:00' ? t('plan.morning') : t('plan.afternoon') })
    : '';
}

function refreshAssignDefaults() {
  const sel = document.getElementById('assign-program');
  if (sel.value === '__new__') { updateAssignPeriodHint(); return; }
  const p = adminPrograms.find(x => x.program_id === Number(sel.value)) ||
    (currentRule && Number(currentRule.program_id) === Number(sel.value)
      ? {
          default_points: currentRule.program_default_points,
          default_start: currentRule.start_time,
          default_end: currentRule.end_time,
        }
      : null);
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
  ptsInput.readOnly = !editingSession && !editingTimetable;

  updateAssignPeriodHint();
}

function refreshTimetableDefaultPoints() {
  const programId = Number(document.getElementById('assign-program').value);
  const program = adminPrograms.find(item => item.program_id === programId);
  const defaultPoints = program?.default_points ??
    (currentRule && Number(currentRule.program_id) === programId
      ? currentRule.program_default_points
      : null);
  if (defaultPoints == null) return;
  document.getElementById('assign-points').value =
    Number(defaultPoints) * (document.getElementById('assign-sudden').checked ? 2 : 1);
}

function populateRulePickers() {
  const weekday = document.getElementById('assign-weekday');
  const dayValue = weekday.value;
  weekday.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(day =>
    `<option value="${day}">${escapeHtml(dayName(day))}</option>`).join('');
  if (dayValue) weekday.value = dayValue;
}

function openRuleModal(weekday, rule = null, occurrence = null) {
  currentSession = null;
  currentRule = rule;
  currentRuleOccurrence = occurrence;
  editingSession = false;
  setCorrectionReasonRequired(!!rule);
  planPeriod = null;
  openModal('rule');
  populateRulePickers();
  document.getElementById('assign-weekday').value = String(rule?.weekday ?? weekday);
  document.getElementById('assign-rule-start').value = rule?.start_date || todayISO();
  document.getElementById('assign-rule-end').value = rule?.end_date || '';
  document.getElementById('assign-date-row').style.display = 'none';
  document.getElementById('assign-repeat-option').style.display = 'none';
  resetAssignRepeat();
  populatePrograms(rule?.program_id, rule);
  document.getElementById('assign-sudden').checked = !!rule?.is_sudden;
  refreshAssignDefaults();
  if (rule) {
    document.getElementById('assign-program').value = String(rule.program_id);
    document.getElementById('assign-start').value = rule.start_time || '';
    document.getElementById('assign-end').value = rule.end_time || '';
    document.getElementById('assign-points').value = rule.points;
  }
  document.getElementById('assign-notes').value = rule?.notes || '';
  document.querySelector('label[for="assign-points"]').textContent = t('modal.pointsEditable');
  translateRuleModal();
  document.getElementById('assign-weekday').focus();
}

function translateRuleModal() {
  const title = t(currentRule ? 'schedule.saveEntry' : 'schedule.createEntry');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('assign-submit').textContent = title;
  document.querySelector('label[for="assign-points"]').textContent = t('modal.pointsEditable');
  document.getElementById('assign-context').textContent = currentRule
    ? `${currentRule.program_name} · ${t('schedule.effectiveFrom', { date: currentRule.effective_from })}`
    : t('schedule.ruleContext');
}

async function confirmRecurringRuleConflict(candidate, excludedSeriesId = null) {
  if (candidate.employeeId == null && candidate.employee_id == null) return true;
  await loadRecurringEntries();
  const employeeId = Number(candidate.employeeId ?? candidate.employee_id);
  const weekday = Number(candidate.weekday);
  const candidateStart = candidate.occurrenceDate || candidate.effectiveFrom || candidate.startDate || todayISO();
  const candidateEnd = candidate.occurrenceDate || candidate.endDate || '9999-12-31';
  const startTime = candidate.startTime ?? candidate.start_time;
  const endTime = candidate.endTime ?? candidate.end_time;
  const conflict = recurringEntries.find(entry => {
    if (Number(entry.series_id) === Number(excludedSeriesId) ||
        Number(entry.employee_id) !== employeeId || Number(entry.weekday) !== weekday) return false;
    const entryStart = [entry.start_date, entry.effective_from].filter(Boolean).sort().at(-1);
    const entryEnd = entry.end_date || '9999-12-31';
    const datesOverlap = candidateStart <= entryEnd && entryStart <= candidateEnd;
    if (!datesOverlap) return false;
    const otherStart = entry.start_time;
    const otherEnd = entry.end_time;
    if (!startTime || !endTime || !otherStart || !otherEnd) return startTime === otherStart;
    const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const candidateStart = toMinutes(startTime);
    const otherStartMinutes = toMinutes(otherStart);
    const candidateEnd = toMinutes(endTime) + (endTime < startTime ? 1440 : 0);
    const otherEndMinutes = toMinutes(otherEnd) + (otherEnd < otherStart ? 1440 : 0);
    return [-1440, 0, 1440].some(offset =>
      candidateStart < otherEndMinutes + offset &&
      otherStartMinutes + offset < candidateEnd);
  });
  if (!conflict) return true;
  const time = fmtTimeRange(conflict.start_time, conflict.end_time);
  return await confirmAction(t('schedule.overlapWarning', {
    task: conflict.program_name, time, day: dayName(weekday),
  }));
}

async function saveTimetableRule(payload) {
  if (currentRule && !payload.correctionReason?.trim()) {
    showModalError(t('modal.correctionReasonRequired'));
    return;
  }
  const body = {
    ...payload, operation: currentRule ? 'edit' : 'create',
    weekday: Number(document.getElementById('assign-weekday').value),
    employeeId: null,
    startDate: document.getElementById('assign-rule-start').value,
    endDate: document.getElementById('assign-rule-end').value || null,
  };
  if (body.endDate && body.endDate < body.startDate) {
    showModalError(t('schedule.invalidRange'));
    return;
  }
  if (currentRule) {
    const occurrenceDate = currentRuleOccurrence?.occurrenceDate || null;
    const change = await requestScheduleChange({ title: t('schedule.saveEntry'),
      summary: scheduleChangeSummary(currentRule, body), occurrenceDate,
      date: occurrenceDate || (currentRule.effective_from > todayISO() ? currentRule.effective_from : todayISO()),
      minDate: occurrenceDate ? currentRule.start_date : todayISO(),
      allowOccurrence: !!occurrenceDate, allowReplace: true });
    if (!change) return;
    if (change.scope === 'occurrence') {
      Object.assign(body, { operation: 'exception', action: 'modify',
        seriesId: currentRule.series_id, cutoffDate: occurrenceDate,
        occurrenceDate, movedDate: occurrenceDate });
    } else {
      Object.assign(body, { seriesId: currentRule.series_id, cutoffDate: change.cutoffDate,
        replaceFutureExceptions: change.replaceFutureExceptions });
    }
  }
  if (!await confirmRecurringRuleConflict({ ...body, effectiveFrom: body.cutoffDate || body.startDate }, currentRule?.series_id)) return;
  const response = await api('/api/admin/schedule/timetable', { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text());
  closeModal();
  refreshScheduleViews();
}

async function openRecurringRuleFromOccurrence(seriesId, occurrenceDate) {
  if (!currentUser?.isAdmin) return;
  try {
    await loadRecurringEntries();
    const rule = recurringEntries.find(item => Number(item.series_id) === Number(seriesId));
    if (!rule) throw new Error('Recurring entry not found');
    openRuleModal(rule.weekday, rule, { occurrenceDate });
  } catch (err) {
    await showNotice(t('schedule.loadError', { msg: err.message }));
  }
}

function resetAssignRepeat() {
  document.getElementById('assign-repeat').checked = false;
  document.getElementById('assign-repeat-weeks').value = '';
  document.getElementById('assign-repeat-row').style.display = 'none';
}

function openAssignModal(employeeId, date) {
  editingSession = false;
  setCorrectionReasonRequired(false);
  document.getElementById('assign-date-row').style.display = 'none';
  document.querySelector('label[for="assign-date"]').textContent = t('modal.date');
  document.getElementById('assign-repeat-option').style.display = 'block';
  document.getElementById('assign-submit').textContent = t('modal.add');
  document.querySelector('label[for="assign-points"]').textContent = t('modal.points');
  document.getElementById('assign-points').readOnly = true;
  document.getElementById('assign-date').value = date;
  planPeriod = null;
  modalEmployeeId = employeeId == null ? null : Number(employeeId); // null = unassigned task
  modalDate = date;
  const emp = modalEmployeeId == null
    ? null
    : adminEmployees.find(e => e.employee_id === modalEmployeeId);
  const who = modalEmployeeId == null
    ? t('person.unassigned')
    : (emp ? `${emp.first_name} ${emp.last_name}` : t('modal.employee', { id: modalEmployeeId }));
  document.getElementById('modal-title').textContent = t('modal.assignTitle');
  document.getElementById('assign-context').textContent = `${who} — ${fmtCellDate(date)}`;
  populatePrograms();
  document.getElementById('assign-sudden').checked = false;
  document.getElementById('assign-notes').value = '';
  resetAssignRepeat();
  refreshAssignDefaults();
  openModal('assign');
}

function openDetailsModal(sessionId, seriesId = null, occurrenceDate = null) {
  setCorrectionReasonRequired(false);
  const s = seriesId != null
    ? sessionByOccurrence.get(`${seriesId}:${occurrenceDate}`)
    : sessionById.get(sessionId);
  if (!s) return;
  currentSession = s;
  const assignees = s.assignees || (s.employee_id == null ? [] : [{
    first_name: s.first_name, last_name: s.last_name,
  }]);
  const people = assignees.length
    ? assignees.map(person => `${escapeHtml(person.first_name)} ${escapeHtml(person.last_name)}`).join(', ')
    : `<em>${escapeHtml(t('person.unassigned'))}</em>`;
  document.getElementById('modal-title').textContent = t('modal.detailsTitle');
  document.getElementById('detail-info').innerHTML = `
    <strong>${escapeHtml(s.program_name)}</strong>${scheduleBadge(s)}${deletedProgramBadge(s)} (${escapeHtml(s.category)})<br>
    ${people} · ${fmtCellDate(s.session_date)}<br>
    ${escapeHtml(fmtTimeRange(s.start_time, s.end_time))} ·
    ${Number(s.points).toFixed(1)} ${t('unit.pts')}${s.is_sudden ? ` · ${escapeHtml(t('tag.sudden'))}` : ''} ·
    <span class="status-pill ${escapeHtml(s.status)}">${escapeHtml(t('status.' + s.status))}</span>
    ${(s.occurrence_notes || s.notes) ? `<br>${escapeHtml(t('modal.notesPrefix'))}${escapeHtml(s.occurrence_notes || s.notes)}` : ''}`;
  document.getElementById('recurring-details').style.display = s.is_recurring ? 'block' : 'none';
  document.getElementById('occurrence-notes').value = s.occurrence_notes || '';
  document.getElementById('session-clone').style.display = s.is_recurring ? 'none' : 'inline-block';
  document.getElementById('session-end-series').style.display = s.is_recurring ? 'inline-block' : 'none';
  document.querySelectorAll('#modal-details .modal-actions button').forEach(button => {
    button.style.display = currentUser?.isAdmin ? '' : 'none';
  });
  document.getElementById('session-delete').style.display =
    currentUser?.isAdmin ? 'inline-block' : 'none';
  document.getElementById('session-clone').style.display =
    currentUser?.isAdmin && !s.is_recurring ? 'inline-block' : 'none';
  document.getElementById('session-end-series').style.display =
    currentUser?.isAdmin && s.is_recurring ? 'inline-block' : 'none';
  openModal('details');
}

function openSessionEdit() {
  if (!currentSession) return;
  editingSession = true;
  setCorrectionReasonRequired(true);
  const s = currentSession;
  document.getElementById('modal-title').textContent = t('modal.editTitle');
  document.getElementById('assign-context').textContent =
    `${s.program_name} · ${fmtCellDate(s.session_date)}`;
  document.getElementById('assign-date-row').style.display = 'block';
  document.querySelector('label[for="assign-date"]').textContent =
    t(s.is_recurring ? 'schedule.moveTo' : 'modal.date');
  document.getElementById('assign-repeat-option').style.display = 'none';
  document.getElementById('assign-date').value = s.session_date;
  populatePrograms(s.program_id, s);
  document.getElementById('assign-program').value = String(s.program_id);
  document.getElementById('assign-start').value = fmtTime(s.start_time) === '—' ? '' : fmtTime(s.start_time);
  document.getElementById('assign-end').value = fmtTime(s.end_time) === '—' ? '' : fmtTime(s.end_time);
  document.getElementById('assign-points').value = Number(s.points || 0);
  document.querySelector('label[for="assign-points"]').textContent = t('modal.pointsEditable');
  document.getElementById('assign-points').readOnly = false;
  document.getElementById('assign-sudden').checked = !!s.is_sudden;
  document.getElementById('assign-notes').value = s.notes || '';
  document.getElementById('assign-submit').textContent = t('action.saveChanges');
  updateAssignPeriodHint();
  openModal('edit');
}

function recurringSessionPayload(s) {
  return {
    seriesId: s.recurring_series_id,
    occurrenceDate: s.recurrence_date || s.session_date,
    displayDate: s.session_date,
  };
}

function openSessionClone() {
  if (!currentSession) return;
  setCorrectionReasonRequired(false);
  const monday = mondayOf(currentSession.session_date);
  const sourceDate = currentSession.session_date;
  const options = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = shiftISO(monday, offset);
    if (date === sourceDate) continue;
    options.push(`<label class="check-row"><input type="checkbox" value="${date}">` +
      `<span>${escapeHtml(fmtCellDate(date))}</span></label>`);
  }
  document.getElementById('modal-title').textContent = t('modal.cloneTitle');
  document.getElementById('clone-date-options').innerHTML = options.join('');
  openModal('clone');
}

