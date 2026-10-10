const WORKER = 'https://task-portal.soder1234.workers.dev';

async function api(path, opts = {}) {
  return fetch(`${WORKER}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
}

function priorityBadge(priority) {
  return `<span class="badge ${priority}">${priority}</span>`;
}

function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return `
    <div class="progress-row">
      <div class="progress"><div class="progress-fill" style="width:${p}%"></div></div>
      <span class="pct">${p}%</span>
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderMyTask(t) {
  return `
    <li class="task-item">
      <div class="task-top">
        <strong>${escapeHtml(t.task_code)}</strong>
        <span class="task-title">${escapeHtml(t.title)}</span>
        ${priorityBadge(t.priority)}
      </div>
      ${progressBar(t.completion_percentage)}
      <div class="meta">
        ${escapeHtml(t.assignment_status)}
        ${t.deadline ? '· due ' + escapeHtml(t.deadline) : ''}
      </div>
    </li>`;
}

function renderAdminTask(t) {
  const assignee = t.employee_email
    ? `${escapeHtml(t.first_name || '')} ${escapeHtml(t.last_name || '')} &lt;${escapeHtml(t.employee_email)}&gt;`
    : '<em>unassigned</em>';
  const hasAssignment = t.assignment_id != null;
  return `
    <li class="task-item">
      <div class="task-top">
        <strong>${escapeHtml(t.task_code)}</strong>
        <span class="task-title">${escapeHtml(t.title)}</span>
        ${priorityBadge(t.priority)}
      </div>
      <div class="meta">
        task status: ${escapeHtml(t.status)}
        ${t.deadline ? '· due ' + escapeHtml(t.deadline) : ''}
        ${hasAssignment ? `· assigned to ${assignee}` : ''}
      </div>
      ${hasAssignment ? `
        ${progressBar(t.completion_percentage)}
        <div class="progress-form" data-assignment-id="${t.assignment_id}">
          <input type="number" min="0" max="100" value="${t.completion_percentage}" />
          <button type="button" class="btn small save-progress">Save</button>
        </div>
      ` : ''}
    </li>`;
}

async function loadMyTasks() {
  const res = await api('/api/me/tasks');
  if (!res.ok) return;
  const { tasks } = await res.json();
  const ul = document.getElementById('my-tasks');
  const empty = document.getElementById('my-tasks-empty');
  if (!tasks.length) {
    ul.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    ul.innerHTML = tasks.map(renderMyTask).join('');
  }
  document.getElementById('my-tasks-section').style.display = 'block';
}

async function loadAllTasks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.employeeId) params.set('employeeId', filters.employeeId);
  const qs = params.toString();
  const res = await api('/api/admin/tasks' + (qs ? `?${qs}` : ''));
  const errEl = document.getElementById('admin-error');
  if (!res.ok) {
    errEl.textContent = res.status === 403
      ? 'Admin access required.'
      : `Failed to load tasks (${res.status}).`;
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  const { tasks } = await res.json();
  const ul = document.getElementById('all-tasks');
  const empty = document.getElementById('all-tasks-empty');
  if (!tasks.length) {
    ul.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    ul.innerHTML = tasks.map(renderAdminTask).join('');
  }
  document.getElementById('admin-section').style.display = 'block';
}

document.getElementById('all-tasks').addEventListener('click', async (e) => {
  if (!e.target.classList.contains('save-progress')) return;
  const form = e.target.closest('.progress-form');
  const assignmentId = parseInt(form.dataset.assignmentId, 10);
  const input = form.querySelector('input[type="number"]');
  const percentage = parseInt(input.value, 10);

  if (Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
    alert('Percentage must be between 0 and 100');
    return;
  }

  e.target.disabled = true;
  e.target.textContent = 'Saving…';
  try {
    const res = await api('/api/admin/progress', {
      method: 'POST',
      body: JSON.stringify({ assignmentId, percentage, notes: '' }),
    });
    if (!res.ok) {
      const txt = await res.text();
      alert('Save failed: ' + txt);
    } else {
      e.target.textContent = 'Saved';
      setTimeout(() => { e.target.textContent = 'Save'; e.target.disabled = false; }, 1200);
    }
  } catch (err) {
    alert('Network error: ' + err.message);
    e.target.textContent = 'Save';
    e.target.disabled = false;
  }
});

document.getElementById('apply-filters').addEventListener('click', () => {
  loadAllTasks({
    status: document.getElementById('filter-status').value,
    employeeId: document.getElementById('filter-employee').value,
  });
});
document.getElementById('clear-filters').addEventListener('click', () => {
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-employee').value = '';
  loadAllTasks();
});

async function load() {
  const me = await api('/api/me');

  if (me.status === 401) {
    document.getElementById('signin-section').style.display = 'flex';
    document.getElementById('signin-link').href = `${WORKER}/auth/google`;
    return;
  }

  const user = await me.json();
  document.getElementById('app').style.display = 'block';
  document.getElementById('user').textContent =
    user.email + (user.isAdmin ? ' (admin)' : '');

  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.style.display = 'inline-block';
  logoutBtn.addEventListener('click', () => {
    window.location.href = `${WORKER}/auth/logout`;
  });

  await loadMyTasks();

  if (user.isAdmin) {
    await loadAllTasks();
  }
}

load();