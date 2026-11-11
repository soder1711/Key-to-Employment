// ================= Tasks (table view) =================

function renderMyTaskRow(task) {
  return `
    <tr>
      <td class="cell-task"><span class="task-name">${escapeHtml(task.title)}</span></td>
      <td>${priorityBadge(task.priority)}</td>
      <td>${statusPill(task.assignment_status)}</td>
      <td class="cell-due">${fmtDue(task.deadline)}</td>
      <td class="cell-progress">${progressBar(task.completion_percentage)}</td>
    </tr>`;
}

async function loadMyTasks() {
  const start = planWeekStart || mondayOf();
  const [tasksResult, planResult] = await Promise.all([
    api('/api/me/tasks'),
    api(`/api/schedule?start=${start}`),
  ]);
  const taskError = document.getElementById('project-tasks-error');
  const planError = document.getElementById('planned-tasks-error');

  let tasks = [];
  if (tasksResult.ok) {
    ({ tasks } = await tasksResult.json());
    taskError.style.display = 'none';
  } else {
    taskError.textContent = t('tasks.projectError', { status: tasksResult.status });
    taskError.style.display = 'block';
  }

  let planSessions = [];
  if (planResult.ok) {
    const data = await planResult.json();
    planSessions = data.sessions.filter(s => s.status !== 'cancelled');
    planWeekStart = data.weekStart;
    document.getElementById('my-tasks-week').textContent =
      `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;
    planError.style.display = 'none';
  } else {
    planError.textContent = t('tasks.planError', { status: planResult.status });
    planError.style.display = 'block';
  }

  const tbody = document.getElementById('my-tasks');
  const empty = document.getElementById('my-tasks-empty');
  const rows = [
    ...tasks.map(renderMyTaskRow),
    ...planSessions.map(s => `
      <tr>
        <td class="cell-task"><span class="task-name">${escapeHtml(s.program_name)}</span></td>
        <td><span class="cat-tag ${escapeHtml(s.category)}">${escapeHtml(s.category)}</span></td>
        <td>${statusPill(s.status)}</td>
        <td class="cell-due">${fmtCellDate(s.session_date)} · ${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</td>
        <td class="cell-progress">${Number(s.points || 0).toFixed(1)} ${t('unit.pts')}</td>
      </tr>`),
  ];
  if (!rows.length && tasksResult.ok && planResult.ok) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    tbody.innerHTML = rows.join('');
  }
  document.getElementById('my-tasks-section').style.display = 'block';
}

// ================= Sign-in / bootstrap =================

async function load() {
  if (LOCAL_DEMO) {
    currentUser = { email: t('summary.demoUser'), isAdmin: true };
    document.getElementById('signin-section').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user').textContent = t('summary.demoUser');
    document.getElementById('nav-tasks').style.display = 'none';
    document.getElementById('nav-schedule').style.display = 'none';
    document.getElementById('nav-plan').style.display = 'none';
    document.getElementById('nav-monthly').style.display = 'inline-block';
    document.getElementById('monthly-summary-demo').style.display = 'block';
    switchView('monthly-summary');
    return;
  }

  const me = await api('/api/me');

  if (me.status === 401) {
    document.getElementById('signin-section').style.display = 'flex';
    document.getElementById('signin-link').href = `${WORKER}/auth/google`;
    return;
  }

  const user = await me.json();
  currentUser = user;
  document.getElementById('app').style.display = 'block';
  document.getElementById('user').textContent =
    user.email + (user.isAdmin ? ' (admin)' : '');

  // Google profile picture to the right of the name
  const avatar = document.getElementById('user-avatar');
  if (user.picture) {
    avatar.src = user.picture;
    avatar.title = user.email;
    avatar.style.display = 'inline-block';
  } else {
    avatar.style.display = 'none';
  }

  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.style.display = 'inline-block';
  logoutBtn.addEventListener('click', () => {
    window.location.href = `${WORKER}/auth/logout`;
  });

  await loadMyTasks();

  if (user.isAdmin) {
    document.getElementById('nav-plan').style.display = 'inline-block';
    document.getElementById('nav-monthly').style.display = 'inline-block';
  }
}

