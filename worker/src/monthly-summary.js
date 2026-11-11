export const DEFAULT_MONTHLY_TARGET_POINTS = 170;

const INTERVALS = [
  { points: 'days_1_10_points', count: 'days_1_10_completed_sessions', start: 1, end: 10 },
  { points: 'days_11_20_points', count: 'days_11_20_completed_sessions', start: 11, end: 20 },
  { points: 'days_21_end_points', count: 'days_21_end_completed_sessions', start: 21, end: 31 },
];

export function monthlyDateRange(year, month) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Invalid year or month');
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${year}-${String(month).padStart(2, '0')}-`;
  return {
    start: `${prefix}01`,
    end: `${prefix}${String(lastDay).padStart(2, '0')}`,
  };
}

export function aggregateMonthlyRows(rows) {
  const employees = new Map();
  for (const row of rows) {
    let summary = employees.get(row.employee_id);
    if (!summary) {
      summary = {
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        total_sessions: 0,
        completed_sessions: 0,
        scheduled_sessions: 0,
        completed_points: 0,
        potential_points: 0,
        target_points: Number(row.target_is_override) === 1
          ? Number(row.target_points) || 0
          : DEFAULT_MONTHLY_TARGET_POINTS,
        target_set: true,
        target_is_override: Number(row.target_is_override) === 1,
      };
      for (const interval of INTERVALS) {
        summary[interval.points] = 0;
        summary[interval.count] = 0;
      }
      employees.set(row.employee_id, summary);
    }

    if (row.session_id == null) continue;
    const points = Number(row.points);
    const sessionPoints = Number.isFinite(points) ? points : 0;
    summary.total_sessions++;
    if (row.status !== 'cancelled') summary.potential_points += sessionPoints;
    if (row.status === 'scheduled') summary.scheduled_sessions++;
    if (row.status !== 'completed') continue;

    summary.completed_sessions++;
    summary.completed_points += sessionPoints;
    const day = Number(String(row.session_date || '').slice(8, 10));
    const interval = INTERVALS.find(period => day >= period.start && day <= period.end);
    if (interval) {
      summary[interval.points] += sessionPoints;
      summary[interval.count]++;
    }
  }

  return [...employees.values()].map(summary => {
    const goalVariance = summary.completed_points - summary.target_points;
    return {
      ...summary,
      goal_variance: goalVariance,
      points_above_goal: Math.max(0, goalVariance),
    };
  });
}
