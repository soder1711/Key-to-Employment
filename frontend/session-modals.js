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
const newProgramOption = () =>
  `<option value="__new__">＋ ${t('programs.new')}…</option>`;

function populatePrograms() {
  const sel = document.getElementById('assign-program');
  sel.innerHTML = adminPrograms.map(p =>
    `<option value="${p.program_id}">${escapeHtml(p.code)} — ${escapeHtml(p.name)} ` +
    `(${escapeHtml(p.category)}, ${Number(p.default_points).toFixed(1)} ${t('unit.pts')})</option>`).join('') +
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

function openDetailsModal(sessionId) {
  const s = sessionById.get(sessionId);
  if (!s) return;
  currentSession = s;
  const person = s.first_name
    ? `${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}`
    : `<em>${escapeHtml(t('person.unassigned'))}</em>`;
  document.getElementById('modal-title').textContent = t('modal.detailsTitle');
  document.getElementById('detail-info').innerHTML = `
    <strong>${escapeHtml(s.program_name)}</strong> (${escapeHtml(s.category)})<br>
    ${person} · ${fmtCellDate(s.session_date)}<br>
    ${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''} ·
    ${Number(s.points).toFixed(1)} ${t('unit.pts')}${s.is_sudden ? ` · ${escapeHtml(t('tag.sudden'))}` : ''} ·
    <span class="status-pill ${escapeHtml(s.status)}">${escapeHtml(t('status.' + s.status))}</span>
    ${s.notes ? `<br>${escapeHtml(t('modal.notesPrefix'))}${escapeHtml(s.notes)}` : ''}`;
  openModal('details');
}

