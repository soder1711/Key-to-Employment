const DEMO_MONTHLY_ROWS = [
  {
    employee_id: 1, first_name: 'Linh', last_name: 'Nguyen',
    days_1_10_points: 12.5, days_1_10_completed_sessions: 5,
    days_11_20_points: 9.5, days_11_20_completed_sessions: 4,
    days_21_end_points: 6, days_21_end_completed_sessions: 3,
    completed_points: 28, completed_sessions: 12,
  },
  {
    employee_id: 2, first_name: 'Minh', last_name: 'Tran',
    days_1_10_points: 5, days_1_10_completed_sessions: 2,
    days_11_20_points: 8, days_11_20_completed_sessions: 4,
    days_21_end_points: 3, days_21_end_completed_sessions: 2,
    completed_points: 16, completed_sessions: 8,
  },
  {
    employee_id: 3, first_name: 'Alex', last_name: 'Morgan',
    days_1_10_points: 0, days_1_10_completed_sessions: 0,
    days_11_20_points: 0, days_11_20_completed_sessions: 0,
    days_21_end_points: 0, days_21_end_completed_sessions: 0,
    completed_points: 0, completed_sessions: 0,
  },
];
const demoGoalOverrides = new Map([[
  `${monthCursor.year}-${monthCursor.month}-1`, 24,
]]);

function demoTargetKey(employeeId) {
  return `${monthCursor.year}-${monthCursor.month}-${employeeId}`;
}

function demoMonthlyRows() {
  return DEMO_MONTHLY_ROWS.map(row => {
    const overrideKey = demoTargetKey(row.employee_id);
    const hasOverride = demoGoalOverrides.has(overrideKey);
    const target = hasOverride ? demoGoalOverrides.get(overrideKey) : 170;
    const variance = row.completed_points - target;
    return {
      ...row,
      target_points: target,
      target_set: true,
      target_is_override: hasOverride,
      goal_variance: variance,
      points_above_goal: Math.max(0, variance),
    };
  });
}

function summaryPoints(value) {
  const points = Number(value);
  return Number.isFinite(points) ? points.toFixed(1) : '0.0';
}

function renderMonthlySummary(rows) {
  const periods = [
    ['days_1_10_points', 'days_1_10_completed_sessions', 'summary.daysOneToTen'],
    ['days_11_20_points', 'days_11_20_completed_sessions', 'summary.daysElevenToTwenty'],
    ['days_21_end_points', 'days_21_end_completed_sessions', 'summary.daysTwentyOneToEnd'],
  ];
  const periodHeaders = periods.map(([, , label]) => `<th>${t(label)}</th>`).join('');
  const body = rows.map(row => {
    const earned = Number(row.completed_points) || 0;
    const target = Number(row.target_points) || 0;
    const targetSet = row.target_set === undefined
      ? target > 0
      : Number(row.target_set) === 1;
    const varianceValue = Number(row.goal_variance);
    const variance = targetSet
      ? (Number.isFinite(varianceValue) ? varianceValue : earned - target)
      : null;
    const varianceClass = variance > 0 ? 'summary-positive' : variance < 0 ? 'summary-negative' : '';
    const varianceText = targetSet
      ? `${variance > 0 ? '+' : ''}${summaryPoints(variance)}`
      : '—';
    const aboveValue = Number(row.points_above_goal);
    const aboveGoal = targetSet
      ? summaryPoints(Number.isFinite(aboveValue) ? aboveValue : Math.max(variance, 0))
      : '—';
    const personName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
    const employeeId = Number(row.employee_id);
    const hasOverride = Boolean(row.target_is_override);
    const goalEditor = `<div class="goal-editor">
      <input class="monthly-goal-input" type="number" min="0" max="10000" step="any"
             value="${summaryPoints(target)}" data-employee-id="${employeeId}"
             aria-label="${escapeHtml(t('summary.goalFor', { name: personName }))}">
      <div class="goal-actions">
        <button class="btn small" data-goal-action="save" data-employee-id="${employeeId}">${t('summary.saveGoal')}</button>
        <button class="btn ghost small" data-goal-action="default" data-employee-id="${employeeId}"
                ${hasOverride ? '' : 'disabled'}>${t('summary.useDefault')}</button>
      </div>
      <span class="summary-cell-sub">${t(hasOverride ? 'summary.individualOverride' : 'summary.sharedDefault')}</span>
    </div>`;
    const periodCells = periods.map(([pointsKey, countKey]) => {
      const count = Math.max(0, Number(row[countKey]) || 0);
      return `<td>${summaryPoints(row[pointsKey])} ${t('unit.pts')}` +
        `<span class="summary-cell-sub">${t('summary.tasksCount', { count })}</span></td>`;
    }).join('');
    return `<tr>
      <td class="summary-person">${escapeHtml(personName)}</td>
      ${periodCells}
      <td class="pts">${summaryPoints(row.completed_points)} ${t('unit.pts')}</td>
      <td>${goalEditor}</td>
      <td class="${varianceClass}">${varianceText} ${targetSet ? t('unit.pts') : ''}</td>
      <td>${aboveGoal}${targetSet ? ` ${t('unit.pts')}` : ''}</td>
      <td>${Math.max(0, Number(row.completed_sessions) || 0)}</td>
    </tr>`;
  }).join('');

  return `<table class="monthly-summary-table">
    <thead><tr><th>${t('summary.employee')}</th>${periodHeaders}
      <th>${t('summary.points')}</th><th>${t('summary.goal')}</th>
      <th>${t('summary.variance')}</th><th>${t('summary.aboveGoal')}</th>
      <th>${t('summary.completedTasks')}</th>
    </tr></thead><tbody>${body}</tbody>
  </table>`;
}

async function loadMonthlySummary() {
  const { year, month } = monthCursor;
  const label = document.getElementById('monthly-summary-label');
  const loading = document.getElementById('monthly-summary-loading');
  const wrap = document.getElementById('monthly-summary-wrap');
  const empty = document.getElementById('monthly-summary-empty');
  const error = document.getElementById('monthly-summary-error');
  label.textContent = `${monthName(month - 1)} ${year}`;
  loading.style.display = 'block';
  wrap.style.display = 'none';
  wrap.textContent = '';
  empty.style.display = 'none';
  error.style.display = 'none';

  try {
    let rows;
    if (LOCAL_DEMO) {
      rows = demoMonthlyRows();
    } else {
      const res = await api(`/api/admin/schedule/monthly?year=${year}&month=${month}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      rows = data.rows;
    }

    loading.style.display = 'none';
    if (!Array.isArray(rows)) throw new Error('Invalid response');
    if (!rows.length) {
      empty.style.display = 'block';
      return;
    }
    wrap.innerHTML = renderMonthlySummary(rows);
    wrap.style.display = 'block';
  } catch (err) {
    loading.style.display = 'none';
    error.textContent = t('summary.error', { status: err.message || 'network error' });
    error.style.display = 'block';
  }
}

function shiftSummaryMonth(delta) {
  let month = monthCursor.month + delta;
  let year = monthCursor.year;
  if (month < 1) { month = 12; year--; }
  if (month > 12) { month = 1; year++; }
  monthCursor = { year, month };
  document.getElementById('monthly-summary-status').style.display = 'none';
  loadMonthlySummary();
}

async function saveMonthlyGoal(button) {
  const employeeId = Number(button.dataset.employeeId);
  const useDefault = button.dataset.goalAction === 'default';
  const input = document.querySelector(`.monthly-goal-input[data-employee-id="${employeeId}"]`);
  const status = document.getElementById('monthly-summary-status');
  const row = button.closest('tr');
  const rowButtons = [...row.querySelectorAll('button[data-goal-action]')];
  let targetPoints;

  if (!Number.isSafeInteger(employeeId) || employeeId < 1) return;
  if (!useDefault) {
    targetPoints = Number(input.value);
    if (input.value.trim() === '' || !Number.isFinite(targetPoints) ||
        targetPoints < 0 || targetPoints > 10000) {
      status.textContent = t('summary.invalidGoal');
      status.className = 'summary-status error';
      status.style.display = 'block';
      return;
    }
  }

  rowButtons.forEach(item => { item.disabled = true; });
  status.textContent = t('summary.savingGoal');
  status.className = 'summary-status';
  status.style.display = 'block';

  try {
    if (LOCAL_DEMO) {
      const overrideKey = demoTargetKey(employeeId);
      if (useDefault) demoGoalOverrides.delete(overrideKey);
      else demoGoalOverrides.set(overrideKey, targetPoints);
    } else {
      const body = {
        employeeId,
        year: monthCursor.year,
        month: monthCursor.month,
        ...(useDefault ? { useDefault: true } : { targetPoints }),
      };
      const res = await api('/api/admin/schedule/target', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
    }
    await loadMonthlySummary();
    status.textContent = t(useDefault ? 'summary.goalReset' : 'summary.goalSaved');
    status.className = 'summary-status summary-status-success';
    status.style.display = 'block';
  } catch (err) {
    status.textContent = t('summary.goalSaveError', { status: err.message || 'network error' });
    status.className = 'summary-status error';
    status.style.display = 'block';
    rowButtons.forEach(item => { item.disabled = false; });
  }
}

