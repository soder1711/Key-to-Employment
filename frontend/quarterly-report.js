// ================= Admin quarterly workload report =================

let quarterlyEmployees = [];
let quarterlyReportLoaded = false;
let quarterlyRequestInFlight = false;
let latestQuarterlyData = null;

function quarterlyPoints(value) {
  const points = Number(value);
  return Number.isFinite(points) ? points.toFixed(1) : '0.0';
}

function quarterlyDemoEmployees() {
  return DEMO_MONTHLY_ROWS.map(row => ({
    employee_id: row.employee_id,
    first_name: row.first_name,
    last_name: row.last_name,
    is_active: 1,
  }));
}

async function loadQuarterlyEmployees() {
  const select = document.getElementById('quarterly-employee');
  const selected = select.value;
  if (LOCAL_DEMO) {
    quarterlyEmployees = quarterlyDemoEmployees();
  } else {
    const response = await api('/api/admin/employees');
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    if (!Array.isArray(data.employees)) throw new Error('Invalid response');
    quarterlyEmployees = data.employees;
  }
  select.innerHTML = quarterlyEmployees.map(employee => {
    const name = `${employee.first_name} ${employee.last_name}`.trim();
    return `<option value="${Number(employee.employee_id)}">${escapeHtml(name)}${Number(employee.is_active) ? '' : ` (${escapeHtml(t('staff.inactive'))})`}</option>`;
  }).join('');
  if (quarterlyEmployees.some(employee => String(employee.employee_id) === selected)) {
    select.value = selected;
  }
}

function renderQuarterlyReport(data) {
  const rows = data.months.map(month => {
    const earned = Number(month.completed_points) || 0;
    const target = Number(month.target_points) || 0;
    const variance = earned - target;
    return `<tr>
      <th scope="row">${escapeHtml(monthName(month.month - 1))}</th>
      <td><button class="summary-session-link" type="button" data-month-session
        data-employee-id="${Number(data.employee.employee_id)}" data-year="${Number(data.year)}"
        data-month="${Number(month.month)}" data-completed-points="${quarterlyPoints(earned)}"
        data-completed-sessions="${Math.max(0, Number(month.completed_sessions) || 0)}"
        data-employee-name="${escapeHtml(`${data.employee.first_name} ${data.employee.last_name}`.trim())}">
        ${quarterlyPoints(earned)} ${escapeHtml(t('unit.pts'))}</button></td>
      <td>${quarterlyPoints(target)} ${escapeHtml(t('unit.pts'))}</td>
      <td>${variance > 0 ? '+' : ''}${quarterlyPoints(variance)} ${escapeHtml(t('unit.pts'))}</td>
      <td>${Math.max(0, Number(month.completed_sessions) || 0)}</td>
    </tr>`;
  }).join('');
  const total = data.totals;
  const variance = Number(total.goal_variance) || 0;
  return `<table class="monthly-summary-table quarterly-table">
    <thead><tr><th>${escapeHtml(t('quarterly.month'))}</th><th>${escapeHtml(t('summary.points'))}</th>
      <th>${escapeHtml(t('summary.goal'))}</th><th>${escapeHtml(t('summary.variance'))}</th>
      <th>${escapeHtml(t('summary.completedTasks'))}</th></tr></thead>
    <tbody>${rows}<tr class="total-row">
      <th scope="row">${escapeHtml(t('quarterly.total'))}</th>
      <td><button class="summary-session-link" type="button" data-quarter-total
        data-employee-id="${Number(data.employee.employee_id)}" data-year="${Number(data.year)}"
        data-quarter="${Number(data.quarter)}">${quarterlyPoints(total.completed_points)} ${escapeHtml(t('unit.pts'))}</button></td>
      <td>${quarterlyPoints(total.target_points)} ${escapeHtml(t('unit.pts'))}</td>
      <td>${variance > 0 ? '+' : ''}${quarterlyPoints(variance)} ${escapeHtml(t('unit.pts'))}</td>
      <td>${Math.max(0, Number(total.completed_sessions) || 0)}</td>
    </tr></tbody>
  </table>`;
}

async function loadQuarterlyReport() {
  if (quarterlyRequestInFlight || !currentUser?.isAdmin) return;
  quarterlyRequestInFlight = true;
  const loading = document.getElementById('quarterly-loading');
  const wrap = document.getElementById('quarterly-report-wrap');
  const empty = document.getElementById('quarterly-empty');
  const error = document.getElementById('quarterly-error');
  const year = Number(document.getElementById('quarterly-year').value);
  const quarter = Number(document.getElementById('quarterly-quarter').value);
  loading.style.display = 'block';
  wrap.style.display = 'none';
  empty.style.display = 'none';
  error.style.display = 'none';
  try {
    if (!quarterlyReportLoaded) await loadQuarterlyEmployees();
    const selectedEmployeeId = Number(document.getElementById('quarterly-employee').value);
    if (!Number.isSafeInteger(selectedEmployeeId) || selectedEmployeeId < 1) {
      loading.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    let data;
    if (LOCAL_DEMO) {
      const monthStart = (quarter - 1) * 3 + 1;
      const employee = quarterlyEmployees.find(item => Number(item.employee_id) === selectedEmployeeId);
      const months = [0, 1, 2].map(offset => ({
        month: monthStart + offset,
        completed_points: (selectedEmployeeId === 1 ? [12.5, 9.5, 6] : selectedEmployeeId === 2 ? [5, 8, 3] : [0, 0, 0])[offset],
        target_points: selectedEmployeeId === 1 && year === monthCursor.year &&
          monthStart + offset === monthCursor.month ? 24 : 170,
        completed_sessions: (selectedEmployeeId === 1 ? [5, 4, 3] : selectedEmployeeId === 2 ? [2, 4, 2] : [0, 0, 0])[offset],
      }));
      const totals = months.reduce((sum, month) => ({
        completed_points: sum.completed_points + month.completed_points,
        target_points: sum.target_points + month.target_points,
        completed_sessions: sum.completed_sessions + month.completed_sessions,
      }), { completed_points: 0, target_points: 0, completed_sessions: 0 });
      data = {
        year, quarter, employee, months,
        totals: { ...totals, goal_variance: totals.completed_points - totals.target_points },
      };
    } else {
      const response = await api(
        `/api/admin/schedule/quarterly?employeeId=${selectedEmployeeId}&year=${year}&quarter=${quarter}`,
      );
      if (!response.ok) throw new Error(String(response.status));
      data = await response.json();
    }
    latestQuarterlyData = data;
    wrap.innerHTML = renderQuarterlyReport(data);
    wrap.style.display = 'block';
  } catch (err) {
    error.textContent = t('quarterly.error', { status: err.message || 'network error' });
    error.style.display = 'block';
  } finally {
    loading.style.display = 'none';
    quarterlyReportLoaded = true;
    quarterlyRequestInFlight = false;
  }
}

async function initQuarterlyReport() {
  if (!quarterlyReportLoaded) {
    const [year, month] = todayISO().split('-').map(Number);
    document.getElementById('quarterly-year').value = year;
    document.getElementById('quarterly-quarter').value = String(Math.floor((month - 1) / 3) + 1);
    try {
      await loadQuarterlyEmployees();
      quarterlyReportLoaded = true;
    } catch (err) {
      document.getElementById('quarterly-error').textContent =
        t('quarterly.error', { status: err.message || 'network error' });
      document.getElementById('quarterly-error').style.display = 'block';
      return;
    }
  }
  loadQuarterlyReport();
}

async function openMonthlySessions(employeeId, year, monthOrMonths, employeeName = '', demoMonths = []) {
  const months = Array.isArray(monthOrMonths) ? monthOrMonths : [monthOrMonths];
  const dialog = document.getElementById('monthly-sessions-modal');
  const loading = document.getElementById('monthly-sessions-loading');
  const wrap = document.getElementById('monthly-sessions-wrap');
  const empty = document.getElementById('monthly-sessions-empty');
  const error = document.getElementById('monthly-sessions-error');
  const monthLabel = months.map(month => `${monthName(month - 1)} ${year}`).join(' – ');
  document.getElementById('monthly-sessions-title').textContent =
    t('monthlySessions.titleFor', { name: employeeName, month: monthLabel });
  loading.style.display = 'block';
  wrap.style.display = 'none';
  empty.style.display = 'none';
  error.style.display = 'none';
  if (!dialog.open) dialog.showModal();
  try {
    const sessions = LOCAL_DEMO
      ? months.flatMap(month => {
        const summary = demoMonths.find(item => Number(item.month) === Number(month));
        const totalCents = Math.max(0, Math.round((Number(summary?.completed_points) || 0) * 100));
        const count = Math.max(0, Number(summary?.completed_sessions) || 0);
        const baseCents = count ? Math.floor(totalCents / count) : 0;
        const extraCents = count ? totalCents % count : 0;
        return Array.from({ length: count }, (_, index) => ({
          session_date: `${year}-${String(month).padStart(2, '0')}-${String(Math.min(28, index + 1)).padStart(2, '0')}`,
          program_name: t('monthlySessions.demoSession'),
          start_time: '09:00', end_time: '10:00',
          points: (baseCents + (index < extraCents ? 1 : 0)) / 100,
          status: 'completed',
        }));
      })
      : (await Promise.all(months.map(async month => {
        const response = await api(
          `/api/admin/schedule/monthly/sessions?employeeId=${employeeId}&year=${year}&month=${month}`,
        );
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        if (!Array.isArray(data.sessions)) throw new Error('Invalid response');
        return data.sessions;
      }))).flat();
    sessions.sort((left, right) => left.session_date.localeCompare(right.session_date) ||
      String(left.start_time || '').localeCompare(String(right.start_time || '')));
    if (!sessions.length) {
      empty.style.display = 'block';
      return;
    }
    wrap.innerHTML = `<table class="data-table"><thead><tr>
      <th>${escapeHtml(t('history.date'))}</th><th>${escapeHtml(t('pth.task'))}</th>
      <th>${escapeHtml(t('pth.time'))}</th><th>${escapeHtml(t('summary.points'))}</th>
      <th>${escapeHtml(t('monthlySessions.status'))}</th>
    </tr></thead><tbody>${sessions.map(session => `<tr>
      <td>${escapeHtml(session.session_date)}</td>
      <td>${escapeHtml(session.program_name || '')}</td>
      <td>${escapeHtml(fmtTimeRange(session.start_time, session.end_time))}</td>
      <td>${Number(session.points || 0).toFixed(2)} ${escapeHtml(t('unit.pts'))}</td>
      <td>${escapeHtml(t(`status.${session.status}`))}</td>
    </tr>`).join('')}</tbody></table>`;
    wrap.style.display = 'block';
  } catch (err) {
    error.textContent = t('monthlySessions.error', { status: err.message || 'network error' });
    error.style.display = 'block';
  } finally {
    loading.style.display = 'none';
  }
}

document.getElementById('quarterly-employee').addEventListener('change', loadQuarterlyReport);
document.getElementById('quarterly-year').addEventListener('change', loadQuarterlyReport);
document.getElementById('quarterly-quarter').addEventListener('change', loadQuarterlyReport);
document.getElementById('quarterly-report-wrap').addEventListener('click', event => {
  const monthButton = event.target.closest('[data-month-session]');
  if (monthButton) {
    openMonthlySessions(
      Number(monthButton.dataset.employeeId),
      Number(monthButton.dataset.year),
      Number(monthButton.dataset.month),
      monthButton.dataset.employeeName,
      [{
        month: Number(monthButton.dataset.month),
        completed_points: Number(monthButton.dataset.completedPoints),
        completed_sessions: Number(monthButton.dataset.completedSessions),
      }],
    );
  }
  const totalButton = event.target.closest('[data-quarter-total]');
  if (totalButton) {
    const firstMonth = (Number(totalButton.dataset.quarter) - 1) * 3 + 1;
    const months = [firstMonth, firstMonth + 1, firstMonth + 2];
    openMonthlySessions(
      Number(totalButton.dataset.employeeId),
      Number(totalButton.dataset.year),
      months,
      document.getElementById('quarterly-employee').selectedOptions[0]?.textContent,
      latestQuarterlyData?.months || [],
    );
  }
});
document.getElementById('monthly-sessions-close').addEventListener('click', () =>
  document.getElementById('monthly-sessions-modal').close());
document.getElementById('monthly-sessions-modal').addEventListener('click', event => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
