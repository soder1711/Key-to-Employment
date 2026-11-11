// ================= Task types (create / delete programs) =================

let allPrograms = [];

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
      ? `<button type="button" class="btn small danger pm-del" data-program-id="${p.program_id}">${escapeHtml(t('programs.deleteBtn'))}</button>`
      : `<span class="mini-tag pm-deleted-tag">${escapeHtml(t('programs.deletedTag'))}</span>`;
    return `<tr${p.is_active ? '' : ' class="cancelled-row"'}>
      <td class="pm-code">${escapeHtml(p.code)}</td>
      <td>${escapeHtml(p.name)}</td>
      <td><span class="cat-tag ${escapeHtml(p.category)}">${escapeHtml(p.category)}</span></td>
      <td class="pts">${Number(p.default_points || 0).toFixed(1)}</td>
      <td>${time}</td>
      <td class="pm-action">${action}</td>
    </tr>`;
  }).join('');
}

function showProgramError(msg) {
  const el = document.getElementById('program-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function openProgramModal() {
  document.getElementById('program-error').style.display = 'none';
  programModal.style.display = 'flex';
  await refreshAdminPrograms();
  renderProgramList();
}

function closeProgramModal() {
  programModal.style.display = 'none';
}

// ---- Apply-to-following-weeks modal ----

function closeApplyModal() {
  applyModal.style.display = 'none';
  pendingApply = null;
}

