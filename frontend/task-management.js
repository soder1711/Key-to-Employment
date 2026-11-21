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
    const action = `<button type="button" class="btn small ghost pm-edit" data-program-id="${p.program_id}">${escapeHtml(t('programs.edit'))}</button>` +
      (p.is_active
        ? `<button type="button" class="btn small danger pm-del" data-program-id="${p.program_id}">${escapeHtml(t('programs.deleteBtn'))}</button>`
        : `<span class="mini-tag pm-deleted-tag">${escapeHtml(t('programs.deletedTag'))}</span>
           <button type="button" class="btn small ghost pm-reactivate" data-program-id="${p.program_id}">${escapeHtml(t('programs.reactivateBtn'))}</button>`);
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
  cancelProgramEdit();
  document.getElementById('program-error').style.display = 'none';
  if (!programModal.open) programModal.showModal();
  await refreshAdminPrograms();
  renderProgramList();
}

function closeProgramModal() {
  cancelProgramEdit();
  if (programModal.open) programModal.close();
}

function cancelProgramEdit() {
  editingProgramId = null;
  document.getElementById('program-form-title').textContent = t('programs.new');
  document.getElementById('program-submit').textContent = t('programs.create');
  document.getElementById('program-cancel-edit').style.display = 'none';
  document.getElementById('program-code').disabled = false;
  document.getElementById('program-category').disabled = false;
  ['program-code', 'program-name', 'program-category'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('program-points').value = '1';
  document.getElementById('program-start').value = '';
  document.getElementById('program-end').value = '';
}

function beginProgramEdit(programId) {
  const program = allPrograms.find(item => Number(item.program_id) === Number(programId));
  if (!program) return;
  editingProgramId = Number(program.program_id);
  document.getElementById('program-form-title').textContent = t('programs.editTitle');
  document.getElementById('program-submit').textContent = t('programs.saveEdit');
  document.getElementById('program-cancel-edit').style.display = 'block';
  document.getElementById('program-code').value = program.code;
  document.getElementById('program-category').value = program.category;
  document.getElementById('program-code').disabled = true;
  document.getElementById('program-category').disabled = true;
  document.getElementById('program-name').value = program.name;
  document.getElementById('program-points').value = program.default_points;
  document.getElementById('program-start').value = program.default_start || '';
  document.getElementById('program-end').value = program.default_end || '';
  document.getElementById('program-error').style.display = 'none';
}

