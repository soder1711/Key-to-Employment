// ================= Task types (create / delete programs) =================

let allPrograms = [];
let editingProgramId = null;

// Fetches all task types (active + deleted) and refreshes the assign picker
async function refreshAdminPrograms(preferredId) {
  const res = await api('/api/admin/programs');
  if (!res.ok) return null;
  const data = await res.json();
  allPrograms = data.programs || [];
  adminPrograms = allPrograms.filter(p => p.is_active === 1);

  const sel = document.getElementById('assign-program');
  const keep = preferredId != null ? String(preferredId) : sel.value;
  populatePrograms();
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  else sel.selectedIndex = 0;
  if (sel.value !== '__new__') refreshAssignDefaults();
  return allPrograms;
}

function renderProgramList() {
  const tbody = document.getElementById('program-list');
  if (!allPrograms.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="no-tasks">${escapeHtml(t('programs.listEmpty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = allPrograms.map(p => {
    const time = (p.default_start || p.default_end)
      ? `${fmtTime(p.default_start)}–${fmtTime(p.default_end)}` : '—';
    const action = p.is_active
      ? `<button type="button" class="btn small ghost pm-edit" data-program-id="${p.program_id}">${escapeHtml(t('action.edit'))}</button>
         <button type="button" class="btn small danger pm-del" data-program-id="${p.program_id}">${escapeHtml(t('programs.deleteBtn'))}</button>`
      : `<button type="button" class="btn small ghost pm-edit" data-program-id="${p.program_id}">${escapeHtml(t('action.edit'))}</button>
         <span class="mini-tag pm-deleted-tag">${escapeHtml(t('programs.deletedTag'))}</span>`;
    return `<tr${p.is_active ? '' : ' class="cancelled-row"'}>
      <td class="pm-code" data-label="${escapeHtml(t('pth.code'))}">${escapeHtml(p.code)}</td>
      <td data-label="${escapeHtml(t('pth.task'))}">${escapeHtml(p.name)}</td>
      <td data-label="${escapeHtml(t('pth.category'))}"><span class="cat-tag ${escapeHtml(p.category)}">${escapeHtml(p.category)}</span></td>
      <td class="pts" data-label="${escapeHtml(t('pth.pts'))}">${Number(p.default_points || 0).toFixed(1)}</td>
      <td data-label="${escapeHtml(t('pth.time'))}">${time}</td>
      <td class="pm-action" data-label="${escapeHtml(t('pth.action'))}">${action}</td>
    </tr>`;
  }).join('');
}

function showProgramError(msg) {
  const el = document.getElementById('program-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function openProgramModal() {
  resetProgramEditor();
  document.getElementById('program-error').style.display = 'none';
  programModal.style.display = 'flex';
  await refreshAdminPrograms();
  renderProgramList();
}

function closeProgramModal() {
  resetProgramEditor();
  programModal.style.display = 'none';
}

function resetProgramEditor() {
  editingProgramId = null;
  ['program-code', 'program-name', 'program-category'].forEach(
    id => document.getElementById(id).value = ''
  );
  document.getElementById('program-points').value = 1;
  document.getElementById('program-start').value = '';
  document.getElementById('program-end').value = '';
  document.getElementById('program-form-title').textContent = t('programs.new');
  document.getElementById('program-submit').textContent = t('programs.create');
}

function openProgramEditor(programId) {
  const program = allPrograms.find(p => p.program_id === Number(programId));
  if (!program) return;
  editingProgramId = program.program_id;
  document.getElementById('program-error').style.display = 'none';
  document.getElementById('program-code').value = program.code || '';
  document.getElementById('program-name').value = program.name || '';
  document.getElementById('program-category').value = program.category || '';
  document.getElementById('program-points').value = Number(program.default_points || 0);
  document.getElementById('program-start').value = program.default_start || '';
  document.getElementById('program-end').value = program.default_end || '';
  document.getElementById('program-form-title').textContent = t('programs.edit');
  document.getElementById('program-submit').textContent = t('action.saveChanges');
  programModal.style.display = 'flex';
  document.getElementById('program-code').focus();
}

