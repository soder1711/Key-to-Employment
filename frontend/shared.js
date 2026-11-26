// ================= Configuration & shared helpers =================

const WORKER = 'https://task-portal.soder1234.workers.dev';
const LOCAL_DEMO = new URLSearchParams(window.location.search).get('demo') === '1' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

let currentUser = null;
let staffLoaded = false;

// ================= Internationalization (EN / VI) =================

let lang = (() => {
  try {
    const saved = localStorage.getItem('lang');
    if (saved === 'en' || saved === 'vi') return saved;
  } catch { /* ignore */ }
  return (navigator.language || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
})();

const I18N = {
  en: {
    'app.name': 'Staff Scheduler', 'app.footer': '© 2026 Staff Scheduler',
    'nav.tasks': 'My week', 'nav.schedule': 'Weekly schedule', 'nav.plan': 'Planning board',
    'nav.monthly': 'Monthly summary', 'nav.quarterly': 'Quarterly report',
    'nav.history': 'History', 'nav.staff': 'Staff',
    'summary.title': 'Monthly summary', 'summary.prev': '← Previous month',
    'summary.current': 'This month', 'summary.next': 'Next month →',
    'summary.daysOneToTen': 'Days 1–10', 'summary.daysElevenToTwenty': 'Days 11–20',
    'summary.daysTwentyOneToEnd': 'Days 21–end', 'summary.employee': 'Employee',
    'summary.points': 'Points earned', 'summary.estimated': 'Estimated',
    'summary.estimatedHelp': 'Estimated points if all assigned sessions are completed',
    'summary.goal': 'Monthly goal',
    'summary.notSet': 'Not set', 'summary.variance': 'Goal variance',
    'summary.aboveGoal': 'Points above goal', 'summary.completedTasks': 'Completed sessions',
    'summary.sharedGoal': 'Shared default: 170 points per person; admins can override for an employee and month.',
    'summary.sharedDefault': 'Shared default', 'summary.individualOverride': 'Individual override',
    'summary.goalFor': 'Monthly goal for {name}', 'summary.saveGoal': 'Save',
    'summary.useDefault': 'Use shared default', 'summary.savingGoal': 'Saving monthly goal…',
    'summary.goalSaved': 'Monthly goal saved.', 'summary.goalReset': 'Using shared default.',
    'summary.goalSaveError': 'Could not save monthly goal ({status}).',
    'summary.invalidGoal': 'Enter a goal from 0 to 10000 points.',
    'summary.tasksCount': '{count} sessions', 'summary.loading': 'Loading monthly summary…',
    'summary.error': 'Could not load monthly summary ({status}).',
    'summary.empty': 'No staff records found.',
    'summary.demoNotice': 'Demo preview: sample data only; no sign-in or live data is used.',
    'summary.demoUser': 'Demo preview',
    'quarterly.title': 'Quarterly workload & eligibility',
    'quarterly.employee': 'Employee', 'quarterly.year': 'Year', 'quarterly.quarter': 'Quarter',
    'quarterly.month': 'Month', 'quarterly.total': 'Quarter total',
    'quarterly.loading': 'Loading quarterly report…',
    'quarterly.empty': 'Select an employee to view the report.',
    'quarterly.error': 'Could not load quarterly report ({status}).',
    'quarterly.q1': 'Q1', 'quarterly.q2': 'Q2', 'quarterly.q3': 'Q3', 'quarterly.q4': 'Q4',
    'plan.board': 'Weekly workload board',
    'user.openMenu': 'Open profile menu',
    'user.signedInAs': 'Signed in as',
    'user.language': 'Language',
    'user.logout': 'Log out',
    'tasks.title': 'My week',
    'tasks.empty': 'No work items or sessions scheduled for this week.',
    'th.task': 'Work item', 'th.priority': 'Priority / category', 'th.status': 'Status',
    'th.date': 'Date / time', 'th.progress': 'Progress / points',
    'schedule.title': 'Weekly schedule',
    'schedule.timezone': 'Schedule timezone: Asia/Ho_Chi_Minh (UTC+07:00).',
    'schedule.nextDay': '(next day)',
    'nav.jump': 'Go to', 'nav.chooseDate': 'Choose a date', 'nav.thisWeek': 'This week',
    'schedule.view': 'Schedule view', 'schedule.dated': 'Dated schedule', 'schedule.timetable': 'Weekly timetable',
    'schedule.tools': 'Import and copy tools', 'schedule.seriesTools': 'Series management',
    'schedule.ruleDates': '{start} to {end}', 'schedule.noEnd': 'no end date',
    'schedule.effectiveFrom': 'Latest settings from {date}', 'schedule.upcomingFrom': 'Upcoming settings from {date}',
    'schedule.confirmChange': 'Confirm change',
    'schedule.futureImpact': 'From {date}, this weekly rule changes. Completed session credits stay unchanged. Existing occurrence exceptions will {policy}.',
    'schedule.historicalFutureImpact': 'From {date}, this weekly rule changes and completed recurring-session credits are updated to match it. Status, notes, and assignments stay unchanged. Occurrence exceptions will {policy}.',
    'schedule.occurrenceImpact': 'Only {date} is affected. The weekly rule and other occurrences stay unchanged.',
    'schedule.endImpact': 'Occurrences on or after the selected date will stop. Earlier settings and completed sessions stay unchanged.',
    'schedule.stopAllSummary': 'Stop ALL recurring entries. One-off sessions are not affected.',
    'schedule.prev': '← Prev week', 'schedule.today': 'Today', 'schedule.next': 'Next week →',
    'schedule.copyNext': 'Copy week to next week',
    'schedule.templateSave': 'Import this week into timetable',
    'schedule.templateDisable': 'Stop weekly timetable',
    'schedule.timetableEdit': 'Edit weekly timetable',
    'schedule.timetableHint': 'Weekly assignment matrix: each column is a recurring programme session and each row is a staff member. Edit recurring sessions in the Planning board.',
    'schedule.ruleContext': 'Recurring programme session: repeats on the selected weekday within its date range. Assign staff to dated sessions in the Planning board.',
    'schedule.invalidRange': 'End date must be on or after the start date.',
    'schedule.overlapWarning': 'This overlaps {task} ({time}) for the same person on {day}. Save anyway?',
    'schedule.timetableEmpty': 'No recurring entries yet.',
    'schedule.assigned': 'Assigned', 'schedule.notAssigned': 'Not assigned', 'schedule.unassigned': 'Unassigned',
    'schedule.noTaskOnDay': 'No fixed sessions',
    'schedule.weekly': 'Weekly', 'schedule.weeklyModified': 'Weekly - Modified',
    'schedule.weeklyOld': 'Weekly - Old',
    'schedule.day': 'Weekday', 'schedule.assignee': 'Assigned person',
    'schedule.editScope': 'Apply edit to',
    'schedule.thisFuture': 'This and future occurrences', 'schedule.onlyThis': 'Only this occurrence',
    'schedule.moveTo': 'Move occurrence to',
    'schedule.startDate': 'Starts on', 'schedule.endDate': 'Ends on (optional)',
    'schedule.applyFrom': 'Apply schedule changes from',
    'schedule.preserveExceptions': 'Replace occurrence exceptions from this date onward',
    'schedule.saveEntry': 'Save recurring entry', 'schedule.createEntry': 'Add recurring entry',
    'schedule.cancelEdit': 'Cancel edit', 'schedule.endSeries': 'End series from date',
    'schedule.endSeriesConfirm': 'End this weekly series from {date}? Earlier settings and completed sessions will remain unchanged.',
    'schedule.recurringEditConfirm': 'Apply this schedule change to this and future occurrences from {date}? Past and completed sessions remain unchanged. Future exceptions will {policy}.',
    'schedule.exceptionEditConfirm': 'Change only the occurrence on {date}? This will be saved as a “Weekly - Modified” exception.',
    'schedule.exceptionPreserved': 'be preserved', 'schedule.exceptionReplaced': 'be replaced',
    'schedule.reassignConfirm': 'Assign this recurring entry to {name} from {date} onward? Past and completed sessions remain unchanged.',
    'schedule.cancelOccurrenceConfirm': 'Cancel only the occurrence on {date}? The weekly series will continue.',
    'schedule.replaceExceptionsConfirm': 'Replace existing future exceptions for this weekly series? Choose No to preserve them.',
    'schedule.noteSave': 'Save occurrence note', 'schedule.actualNote': 'Actual session note',
    'schedule.importConfirm': 'Import non-recurring sessions from {date} into the weekly timetable? Existing recurring entries are kept.',
    'schedule.stopConfirm': 'Stop all recurring entries from {date} onward? Earlier settings and completed sessions remain unchanged.',
    'schedule.empty': 'No sessions scheduled for you this week.',
    'schedule.adminHint': 'Click an empty cell to add a session; click a session to record completion or edit it.',
    'schedule.viewerHint': 'Read-only view of all staff sessions for the selected week.',
    'schedule.loadError': 'Failed to load schedule: {msg}',
    'schedule.addSessionFor': 'Add a session for {employee} on {date}',
    'schedule.openSession': 'Open session: {program}, {status}, {date}, {time}, {points} {unit}',
    'sth.date': 'Date', 'sth.program': 'Programme', 'sth.category': 'Category',
    'sth.time': 'Time', 'sth.points': 'Points', 'sth.status': 'Status',
    'grid.employee': 'Employee', 'grid.pts': 'Earned points',
    'plan.title': 'Planning board', 'plan.adminTag': 'admin', 'plan.manage': 'Manage programmes',
    'plan.view': 'Planning board view', 'plan.sessions': 'Dated sessions',
    'plan.timetableHint': 'Recurring programme sessions have no default assignee. Click a cell to add a session or a rule to edit it.',
    'plan.hint': 'View sessions for every day in the selected week. Drag a staff member onto a session to assign them for that date.',
    'plan.adminHint': 'View all dated sessions. Admins can assign staff, edit sessions, and manage recurring schedules.',
    'plan.viewerHint': 'Read-only view of all staff sessions for the selected week.',
    'plan.prev': '← Previous week', 'plan.today': 'Today', 'plan.next': 'Next week →',
    'plan.people': 'People',
    'plan.estimateShort': 'Est.', 'plan.earnedShort': 'Earned',
    'plan.morning': 'Morning', 'plan.afternoon': 'Afternoon and evening',
    'plan.dropHere': 'Drop person here', 'plan.noTasks': 'No sessions scheduled',
    'plan.addBtn': '+ Add one-off session…', 'plan.pointsTotal': 'Planned points',
    'plan.emptyPeople': 'No active employees.', 'plan.unassignedRow': 'Unassigned',
    'plan.loadError': 'Failed to load the planning board: {msg}',
    'plan.loadErrorStatus': 'Failed to load the planning board ({status}).',
    'plan.removeAssignee': 'Remove {name} from this task',
    'plan.clickOptions': 'Drag a person here to add them, or drag them here again to remove them',
    'mp.target': 'Target',
    'mp.excessShort': 'Excess',
    'status.pending': 'pending', 'status.assigned': 'assigned',
    'status.in_progress': 'in progress', 'status.active': 'active',
    'tag.sudden': 'sudden', 'tag.today': 'today',
    'login.sub': 'Sign in with your work account to view schedules, workload reports, and history.',
    'login.google': 'Sign in with Google',
    'login.hint': 'Your access level is determined by your account.',
    'login.loadError': 'Could not load the app. Check your connection and try again.',
    'login.retry': 'Retry',
    'modal.task': 'Programme', 'modal.date': 'Date', 'modal.start': 'Start', 'modal.end': 'End',
    'modal.points': 'Points', 'modal.pointsEditable': 'Points',
    'modal.sudden': ' Sudden session (doubles the points)',
    'modal.repeat': ' Copy as one-off sessions for a limited number of weeks',
    'modal.repeatWeeks': 'Repeat for (weeks, including this one)',
    'modal.repeatNote': 'Creates separate one-off sessions (max 53 weeks), not a recurring rule. For ongoing work, use Weekly timetable in Schedule.',
    'modal.notes': 'Notes', 'modal.notesPlaceholder': 'optional', 'modal.notesPrefix': 'Notes: ',
    'modal.correctionReason': 'Correction reason (optional)',
    'modal.correctionReasonPlaceholder': 'Explain why this record is being changed',
    'modal.add': 'Add one-off session',
    'modal.assignTitle': 'Add one-off session', 'modal.addTitle': 'Add one-off session',
    'modal.editTitle': 'Edit session',
    'modal.sessionActions': 'Session actions',
    'modal.cloneTitle': 'Copy session to weekdays',
    'clone.chooseDays': 'Choose other weekdays in this week:',
    'modal.employee': 'Employee #{id}',
    'modal.dragAfter': ' — drag a person onto the task afterwards',
    'action.cloneWeekdays': 'Clone to weekdays',
    'action.saveChanges': 'Save changes', 'action.back': 'Back', 'action.clone': 'Clone',
    'action.complete': '✓ Complete', 'action.reopen': '↺ Reopen', 'action.cancel': '✕ Cancel',
    'action.deleteDay': 'Delete this day',
    'programs.title': 'Programmes',
    'programs.edit': 'Edit defaults', 'programs.saveEdit': 'Save defaults',
    'programs.cancelEdit': 'Cancel edit', 'programs.editTitle': 'Edit programme defaults',
    'programs.context': 'Create programmes or hide them from the list. Hiding a programme with ' +
      'scheduled sessions keeps those records; a programme with no sessions is removed.',
    'programs.new': 'New programme', 'programs.create': 'Create programme',
    'programs.listEmpty': 'No programmes in the database yet.',
    'programs.deletedTag': 'deleted', 'programs.deleteBtn': 'Delete',
    'programs.reactivateBtn': 'Reactivate',
    'pth.code': 'Code', 'pth.task': 'Programme', 'pth.category': 'Category',
    'pth.pts': 'Default pts', 'pth.time': 'Default time', 'pth.action': 'Action',
    'plabel.code': 'Code', 'plabel.category': 'Category', 'plabel.name': 'Name',
    'plabel.points': 'Default points', 'plabel.start': 'Default start', 'plabel.end': 'Default end',
    'person.unassigned': 'Unassigned', 'person.unknown': 'Unknown',
    'status.scheduled': 'scheduled', 'status.completed': 'completed', 'status.cancelled': 'cancelled',
    'priority.low': 'low', 'priority.medium': 'medium', 'priority.high': 'high', 'priority.critical': 'critical',
    'unit.pts': 'pts',
    'totals.sessions': 'Sessions:', 'totals.completed': 'Completed:',
    'totals.earned': 'Points earned:', 'totals.potential': 'If all done:',
    'mp.credited': 'credited pts',
    'mp.sessionsDone': '{done} of {total} sessions completed',
    'mp.excess': 'Excess above target: +{p} pts',
    'mp.remaining': '{p} pts remaining to target',
    'mp.noTarget': 'No monthly target set',
    'tasks.projectError': 'Failed to load work items ({status}).',
    'tasks.planError': 'Failed to load planning board sessions ({status}).',
    'err.saveFailed': 'Save failed: ', 'err.network': 'Network error: ',
    'err.cloneDays': 'Choose at least one weekday.', 'err.cloneFailed': 'Clone failed: ',
    'err.copyWeekFailed': 'Week copy failed: ',
    'err.weeklyTemplateFailed': 'Weekly timetable update failed: ',
    'err.statusFailed': 'Status update failed', 'err.deleteFailed': 'Delete failed',
    'err.assignFailed': 'Could not assign person: ',
    'err.codeName': 'Code and name are required.',
    'err.points': 'Default points must be a number of at least 0.',
    'confirm.copyWeek': 'Copy the schedule from {from} to {to}? Existing matching sessions will not be duplicated.',
    'confirm.deleteDay': 'Delete this session? The deletion is recorded in history.',
    'confirm.programDelete': 'Hide or delete this programme? Existing sessions are kept.',
    'confirm.programReactivate': 'Reactivate this programme and its weekly timetable?',
    'alert.copyWeek': 'Copied {count} sessions to next week; {skipped} matching sessions were not duplicated.',
    'alert.assignRepeat': 'Session added to {n} weeks (same weekday, same time). Browse to later weeks to see it.',
    'dialog.notice': 'Notice', 'dialog.confirm': 'Confirm action',
    'dialog.ok': 'OK', 'dialog.confirmButton': 'Continue', 'dialog.cancel': 'Cancel',
    'history.title': 'Schedule history', 'history.date': 'When', 'history.actor': 'Changed by',
    'history.action': 'Action', 'history.record': 'Record', 'history.details': 'Details',
    'history.staffFilter': 'Staff member (email)', 'history.recordFilter': 'Record',
    'history.from': 'From', 'history.to': 'To', 'history.apply': 'Apply filters',
    'history.previous': '←', 'history.next': '→', 'history.page': 'Page',
    'history.pagination': 'History pagination', 'history.previousPage': 'Previous page',
    'history.nextPage': 'Next page',
    'history.pageOf': 'of {count}',
    'history.empty': 'No history entries yet.', 'history.loadError': 'Could not load history ({status}).',
    'history.loading': 'Loading history…',
    'monthlySessions.title': 'Monthly sessions',
    'monthlySessions.titleFor': '{name} · {month}',
    'monthlySessions.loading': 'Loading sessions…',
    'monthlySessions.empty': 'No sessions found for this month.',
    'monthlySessions.error': 'Could not load sessions ({status}).',
    'monthlySessions.demoSession': 'Scheduled work', 'monthlySessions.status': 'Status',
    'staff.title': 'Staff directory', 'staff.code': 'Staff ID', 'staff.firstName': 'First name',
    'staff.lastName': 'Last name', 'staff.email': 'Work email', 'staff.status': 'Status',
    'staff.action': 'Action', 'staff.active': 'Active', 'staff.inactive': 'Inactive',
    'staff.edit': 'Edit', 'staff.editTitle': 'Edit staff member', 'staff.save': 'Save changes',
    'staff.updated': 'Staff member updated.', 'staff.updateError': 'Could not update staff ({status}).',
    'staff.add': 'Add staff member', 'staff.deactivate': 'Deactivate',
    'staff.reactivate': 'Reactivate',
    'staff.empty': 'No staff records found.', 'staff.loadError': 'Could not load staff ({status}).',
    'staff.added': 'Staff member added.', 'staff.deactivated': 'Staff member deactivated; work records were retained.',
    'staff.reactivated': 'Staff member reactivated.',
    'staff.addError': 'Could not add staff ({status}).',
    'staff.deactivateError': 'Could not deactivate staff ({status}).',
    'staff.confirmDeactivate': 'Deactivate {name}? Existing schedule and work records will be retained.',
    'staff.reactivateError': 'Could not reactivate staff ({status}).',
    'staff.confirmReactivate': 'Reactivate {name}? They will be able to sign in again.',
    'tasks.monthlyProgress': 'My monthly progress',
    'common.today': 'today',
    'day.sun': 'Sun', 'day.mon': 'Mon', 'day.tue': 'Tue', 'day.wed': 'Wed',
    'day.thu': 'Thu', 'day.fri': 'Fri', 'day.sat': 'Sat',
    'month.1': 'January', 'month.2': 'February', 'month.3': 'March', 'month.4': 'April',
    'month.5': 'May', 'month.6': 'June', 'month.7': 'July', 'month.8': 'August',
    'month.9': 'September', 'month.10': 'October', 'month.11': 'November', 'month.12': 'December',
  },
  vi: {
    'app.name': 'Lịch nhân sự', 'app.footer': '© 2026 Lịch nhân sự',
    'nav.tasks': 'Tuần của tôi', 'nav.schedule': 'Lịch tuần', 'nav.plan': 'Bảng phân công',
    'nav.monthly': 'Tổng kết tháng', 'nav.quarterly': 'Báo cáo quý',
    'nav.history': 'Lịch sử', 'nav.staff': 'Nhân sự',
    'summary.title': 'Tổng kết tháng', 'summary.prev': '← Tháng trước',
    'summary.current': 'Tháng này', 'summary.next': 'Tháng sau →',
    'summary.daysOneToTen': 'Ngày 1–10', 'summary.daysElevenToTwenty': 'Ngày 11–20',
    'summary.daysTwentyOneToEnd': 'Ngày 21–cuối tháng', 'summary.employee': 'Nhân viên',
    'summary.points': 'Điểm đã đạt', 'summary.estimated': 'Dự kiến',
    'summary.estimatedHelp': 'Điểm dự kiến nếu hoàn thành mọi phiên được giao',
    'summary.goal': 'Mục tiêu tháng',
    'summary.notSet': 'Chưa đặt', 'summary.variance': 'Chênh lệch mục tiêu',
    'summary.aboveGoal': 'Điểm vượt mục tiêu', 'summary.completedTasks': 'Phiên đã hoàn thành',
    'summary.sharedGoal': 'Mặc định chung: 170 điểm mỗi người; quản trị viên có thể đặt riêng theo nhân viên và tháng.',
    'summary.sharedDefault': 'Mặc định chung', 'summary.individualOverride': 'Mục tiêu riêng',
    'summary.goalFor': 'Mục tiêu tháng của {name}', 'summary.saveGoal': 'Lưu',
    'summary.useDefault': 'Dùng mặc định chung', 'summary.savingGoal': 'Đang lưu mục tiêu…',
    'summary.goalSaved': 'Đã lưu mục tiêu tháng.', 'summary.goalReset': 'Đang dùng mặc định chung.',
    'summary.goalSaveError': 'Không lưu được mục tiêu tháng ({status}).',
    'summary.invalidGoal': 'Nhập mục tiêu từ 0 đến 10000 điểm.',
    'summary.tasksCount': '{count} phiên', 'summary.loading': 'Đang tải tổng kết tháng…',
    'summary.error': 'Không tải được tổng kết tháng ({status}).',
    'summary.empty': 'Không tìm thấy nhân sự.',
    'summary.demoNotice': 'Bản xem trước: chỉ dùng dữ liệu mẫu; không cần đăng nhập và không dùng dữ liệu trực tiếp.',
    'summary.demoUser': 'Bản xem trước',
    'quarterly.title': 'Khối lượng công việc & điều kiện theo quý',
    'quarterly.employee': 'Nhân viên', 'quarterly.year': 'Năm', 'quarterly.quarter': 'Quý',
    'quarterly.month': 'Tháng', 'quarterly.total': 'Tổng quý',
    'quarterly.loading': 'Đang tải báo cáo quý…',
    'quarterly.empty': 'Chọn nhân viên để xem báo cáo.',
    'quarterly.error': 'Không tải được báo cáo quý ({status}).',
    'quarterly.q1': 'Quý 1', 'quarterly.q2': 'Quý 2',
    'quarterly.q3': 'Quý 3', 'quarterly.q4': 'Quý 4',
    'plan.board': 'Bảng khối lượng công việc tuần',
    'user.openMenu': 'Mở menu hồ sơ',
    'user.signedInAs': 'Đã đăng nhập bằng',
    'user.language': 'Ngôn ngữ',
    'user.logout': 'Đăng xuất',
    'tasks.title': 'Tuần của tôi',
    'tasks.empty': 'Chưa có mục công việc hay phiên nào trong tuần này.',
    'th.task': 'Công việc', 'th.priority': 'Ưu tiên / danh mục', 'th.status': 'Trạng thái',
    'th.date': 'Ngày / giờ', 'th.progress': 'Tiến độ / điểm',
    'schedule.title': 'Lịch tuần',
    'schedule.timezone': 'Múi giờ lịch: Asia/Ho_Chi_Minh (UTC+07:00).',
    'schedule.nextDay': '(ngày hôm sau)',
    'nav.jump': 'Đi tới', 'nav.chooseDate': 'Chọn ngày', 'nav.thisWeek': 'Tuần này',
    'schedule.view': 'Chế độ xem lịch', 'schedule.dated': 'Lịch theo ngày', 'schedule.timetable': 'Thời khóa biểu hàng tuần',
    'schedule.tools': 'Công cụ nhập và sao chép', 'schedule.seriesTools': 'Quản lý chuỗi',
    'schedule.ruleDates': '{start} đến {end}', 'schedule.noEnd': 'không có ngày kết thúc',
    'schedule.effectiveFrom': 'Cài đặt mới nhất từ {date}', 'schedule.upcomingFrom': 'Cài đặt sắp tới từ {date}',
    'schedule.confirmChange': 'Xác nhận thay đổi',
    'schedule.futureImpact': 'Từ {date}, quy tắc hàng tuần sẽ thay đổi. Điểm của phiên đã hoàn thành không đổi. Các ngoại lệ lịch từ ngày này sẽ được {policy}.',
    'schedule.historicalFutureImpact': 'Từ {date}, quy tắc hàng tuần thay đổi và điểm của các phiên lặp đã hoàn thành sẽ được cập nhật theo quy tắc. Trạng thái, ghi chú và phân công không đổi. Các ngoại lệ sẽ được {policy}.',
    'schedule.occurrenceImpact': 'Chỉ ngày {date} bị ảnh hưởng. Quy tắc hàng tuần và các lần khác không đổi.',
    'schedule.endImpact': 'Các lần từ ngày được chọn trở đi sẽ dừng. Cài đặt trước đó và các phiên đã hoàn thành không đổi.',
    'schedule.stopAllSummary': 'Dừng TẤT CẢ mục lặp lại. Các phiên riêng lẻ không bị ảnh hưởng.',
    'schedule.prev': '← Tuần trước', 'schedule.today': 'Hôm nay', 'schedule.next': 'Tuần sau →',
    'schedule.copyNext': 'Sao chép tuần sang tuần sau',
    'schedule.templateSave': 'Nhập tuần này vào thời khóa biểu',
    'schedule.templateDisable': 'Tắt thời khóa biểu hàng tuần',
    'schedule.timetableEdit': 'Sửa thời khóa biểu hàng tuần',
    'schedule.timetableHint': 'Ma trận phân công tuần: mỗi cột là một phiên chương trình lặp lại và mỗi hàng là một nhân viên. Sửa phiên lặp trong Bảng phân công.',
    'schedule.ruleContext': 'Phiên chương trình lặp lại theo ngày đã chọn trong khoảng ngày. Giao nhân viên cho từng phiên theo ngày trong Bảng phân công.',
    'schedule.invalidRange': 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
    'schedule.overlapWarning': 'Mục này trùng giờ với {task} ({time}) của cùng nhân sự vào {day}. Vẫn lưu?',
    'schedule.timetableEmpty': 'Chưa có mục lặp lại.',
    'schedule.assigned': 'Đã phân công', 'schedule.notAssigned': 'Chưa phân công', 'schedule.unassigned': 'Chưa giao',
    'schedule.noTaskOnDay': 'Không có phiên cố định',
    'schedule.weekly': 'Hàng tuần', 'schedule.weeklyModified': 'Hàng tuần - Đã sửa',
    'schedule.weeklyOld': 'Hàng tuần - Cũ',
    'schedule.day': 'Ngày trong tuần', 'schedule.assignee': 'Người được giao',
    'schedule.editScope': 'Áp dụng chỉnh sửa cho',
    'schedule.thisFuture': 'Lần này và các lần sau', 'schedule.onlyThis': 'Chỉ lần này',
    'schedule.moveTo': 'Chuyển lần xuất hiện đến',
    'schedule.startDate': 'Bắt đầu từ', 'schedule.endDate': 'Kết thúc vào (không bắt buộc)',
    'schedule.applyFrom': 'Áp dụng thay đổi lịch từ ngày',
    'schedule.preserveExceptions': 'Thay thế các ngoại lệ từ ngày này trở đi',
    'schedule.saveEntry': 'Lưu mục lặp lại', 'schedule.createEntry': 'Thêm mục lặp lại',
    'schedule.cancelEdit': 'Hủy sửa', 'schedule.endSeries': 'Kết thúc chuỗi từ ngày',
    'schedule.endSeriesConfirm': 'Kết thúc chuỗi hàng tuần này từ {date}? Cài đặt trước đó và các phiên đã hoàn thành sẽ không đổi.',
    'schedule.recurringEditConfirm': 'Áp dụng thay đổi lịch cho lần này và các lần sau từ {date}? Các phiên trước và đã hoàn thành không đổi. Các ngoại lệ tương lai sẽ được {policy}.',
    'schedule.exceptionEditConfirm': 'Chỉ thay đổi lần xuất hiện ngày {date}? Thay đổi sẽ được lưu thành ngoại lệ “Hàng tuần - Đã sửa”.',
    'schedule.exceptionPreserved': 'giữ lại', 'schedule.exceptionReplaced': 'thay thế',
    'schedule.reassignConfirm': 'Giao mục lặp lại này cho {name} từ {date}? Các phiên trước và đã hoàn thành không đổi.',
    'schedule.cancelOccurrenceConfirm': 'Chỉ hủy lần xuất hiện ngày {date}? Chuỗi hàng tuần vẫn tiếp tục.',
    'schedule.replaceExceptionsConfirm': 'Thay thế các ngoại lệ tương lai của chuỗi này? Chọn Không để giữ nguyên.',
    'schedule.noteSave': 'Lưu ghi chú phiên', 'schedule.actualNote': 'Ghi chú phiên thực tế',
    'schedule.importConfirm': 'Nhập các phiên không lặp lại từ tuần {date} vào thời khóa biểu? Các mục lặp lại hiện có được giữ lại.',
    'schedule.stopConfirm': 'Dừng tất cả mục lặp lại từ {date}? Cài đặt trước đó và các phiên đã hoàn thành không đổi.',
    'schedule.empty': 'Không có phiên nào được lên lịch cho bạn trong tuần này.',
    'schedule.adminHint': 'Nhấp ô trống để thêm phiên; nhấp phiên để ghi nhận hoàn thành hoặc chỉnh sửa.',
    'schedule.viewerHint': 'Chế độ chỉ xem các phiên của toàn bộ nhân viên trong tuần đã chọn.',
    'schedule.loadError': 'Không tải được lịch: {msg}',
    'schedule.addSessionFor': 'Thêm phiên cho {employee} vào ngày {date}',
    'schedule.openSession': 'Mở phiên: {program}, {status}, {date}, {time}, {points} {unit}',
    'sth.date': 'Ngày', 'sth.program': 'Chương trình', 'sth.category': 'Danh mục',
    'sth.time': 'Giờ', 'sth.points': 'Điểm', 'sth.status': 'Trạng thái',
    'grid.employee': 'Nhân viên', 'grid.pts': 'Điểm đã đạt',
    'plan.title': 'Bảng phân công', 'plan.adminTag': 'quản trị', 'plan.manage': 'Quản lý chương trình',
    'plan.view': 'Chế độ xem bảng phân công', 'plan.sessions': 'Phiên theo ngày',
    'plan.timetableHint': 'Phiên chương trình lặp lại không có nhân viên được giao mặc định. Nhấp ô để thêm phiên hoặc nhấp quy tắc để sửa.',
    'plan.hint': 'Xem các phiên trong từng ngày của tuần đã chọn. Kéo nhân viên vào phiên để phân công riêng cho ngày đó.',
    'plan.adminHint': 'Xem tất cả phiên theo ngày. Quản trị viên có thể phân công nhân viên, sửa phiên và quản lý lịch lặp.',
    'plan.viewerHint': 'Chế độ chỉ xem các phiên của toàn bộ nhân viên trong tuần đã chọn.',
    'plan.prev': '← Tuần trước', 'plan.today': 'Hôm nay', 'plan.next': 'Tuần sau →',
    'plan.people': 'Nhân sự',
    'plan.estimateShort': 'Dự kiến', 'plan.earnedShort': 'Đã đạt',
    'plan.morning': 'Buổi sáng', 'plan.afternoon': 'Buổi chiều và tối',
    'plan.dropHere': 'Thả nhân viên vào đây', 'plan.noTasks': 'Không có phiên nào được lên lịch',
    'plan.addBtn': '+ Thêm phiên riêng lẻ…', 'plan.pointsTotal': 'Điểm dự kiến',
    'plan.emptyPeople': 'Không có nhân sự đang hoạt động.', 'plan.unassignedRow': 'Chưa gán',
    'plan.loadError': 'Không tải được bảng phân công: {msg}',
    'plan.loadErrorStatus': 'Không tải được bảng phân công ({status}).',
    'plan.removeAssignee': 'Gỡ {name} khỏi nhiệm vụ này',
    'plan.clickOptions': 'Kéo nhân viên vào đây để thêm; kéo lại người đó để gỡ',
    'mp.target': 'Mục tiêu',
    'mp.excessShort': 'Vượt',
    'status.pending': 'đang chờ', 'status.assigned': 'đã gán',
    'status.in_progress': 'đang thực hiện', 'status.active': 'đang hoạt động',
    'tag.sudden': 'đột xuất', 'tag.today': 'hôm nay',
    'login.sub': 'Đăng nhập bằng tài khoản công việc để xem lịch, báo cáo khối lượng và lịch sử.',
    'login.google': 'Đăng nhập bằng Google',
    'login.hint': 'Quyền truy cập của bạn được xác định theo tài khoản.',
    'login.loadError': 'Không tải được ứng dụng. Hãy kiểm tra kết nối và thử lại.',
    'login.retry': 'Thử lại',
    'modal.task': 'Chương trình', 'modal.date': 'Ngày', 'modal.start': 'Bắt đầu', 'modal.end': 'Kết thúc',
    'modal.points': 'Điểm', 'modal.pointsEditable': 'Điểm',
    'modal.sudden': ' Phiên đột xuất (nhân đôi điểm)',
    'modal.repeat': ' Sao chép thành phiên riêng lẻ trong số tuần giới hạn',
    'modal.repeatWeeks': 'Lặp lại (số tuần, kể cả tuần này)',
    'modal.repeatNote': 'Tạo các phiên riêng lẻ (tối đa 53 tuần), không tạo quy tắc lặp lại. Với công việc lâu dài, dùng Thời khóa biểu hàng tuần trong Lịch.',
    'modal.notes': 'Ghi chú', 'modal.notesPlaceholder': 'không bắt buộc', 'modal.notesPrefix': 'Ghi chú: ',
    'modal.correctionReason': 'Lý do điều chỉnh (không bắt buộc)',
    'modal.correctionReasonPlaceholder': 'Giải thích lý do thay đổi bản ghi này',
    'modal.add': 'Thêm phiên riêng lẻ',
    'modal.assignTitle': 'Thêm phiên riêng lẻ', 'modal.addTitle': 'Thêm phiên riêng lẻ',
    'modal.editTitle': 'Sửa phiên',
    'modal.sessionActions': 'Thao tác phiên',
    'modal.cloneTitle': 'Sao chép phiên sang các ngày trong tuần',
    'clone.chooseDays': 'Chọn các ngày khác trong tuần này:',
    'modal.employee': 'Nhân viên #{id}',
    'modal.dragAfter': ' — kéo người vào nhiệm vụ sau đó',
    'action.cloneWeekdays': 'Sao chép sang ngày khác',
    'action.saveChanges': 'Lưu thay đổi', 'action.back': 'Quay lại', 'action.clone': 'Sao chép',
    'action.complete': '✓ Hoàn thành', 'action.reopen': '↺ Mở lại', 'action.cancel': '✕ Hủy',
    'action.deleteDay': 'Xóa ngày này',
    'programs.title': 'Chương trình',
    'programs.edit': 'Sửa mặc định', 'programs.saveEdit': 'Lưu mặc định',
    'programs.cancelEdit': 'Hủy sửa', 'programs.editTitle': 'Sửa mặc định chương trình',
    'programs.context': 'Tạo chương trình hoặc ẩn khỏi danh sách. Các phiên đã lên lịch được giữ lại; ' +
      'chương trình chưa có phiên sẽ bị xóa.',
    'programs.new': 'Chương trình mới', 'programs.create': 'Tạo chương trình',
    'programs.listEmpty': 'Chưa có chương trình nào trong cơ sở dữ liệu.',
    'programs.deletedTag': 'đã xóa', 'programs.deleteBtn': 'Xóa',
    'programs.reactivateBtn': 'Kích hoạt lại',
    'pth.code': 'Mã', 'pth.task': 'Chương trình', 'pth.category': 'Danh mục',
    'pth.pts': 'Điểm mặc định', 'pth.time': 'Giờ mặc định', 'pth.action': 'Thao tác',
    'plabel.code': 'Mã', 'plabel.category': 'Danh mục', 'plabel.name': 'Tên',
    'plabel.points': 'Điểm mặc định', 'plabel.start': 'Giờ bắt đầu mặc định', 'plabel.end': 'Giờ kết thúc mặc định',
    'person.unassigned': 'Chưa gán', 'person.unknown': 'Không rõ',
    'status.scheduled': 'Đã lên lịch', 'status.completed': 'Đã hoàn thành', 'status.cancelled': 'Đã hủy',
    'priority.low': 'thấp', 'priority.medium': 'trung bình', 'priority.high': 'cao', 'priority.critical': 'khẩn cấp',
    'unit.pts': 'điểm',
    'totals.sessions': 'Phiên:', 'totals.completed': 'Đã hoàn thành:',
    'totals.earned': 'Điểm đã đạt:', 'totals.potential': 'Nếu hoàn thành hết:',
    'mp.credited': 'điểm đã ghi',
    'mp.sessionsDone': '{done} / {total} phiên đã hoàn thành',
    'mp.excess': 'Vượt mục tiêu: +{p} điểm',
    'mp.remaining': 'Còn {p} điểm để đạt mục tiêu',
    'mp.noTarget': 'Chưa đặt mục tiêu tháng',
    'tasks.projectError': 'Không tải được mục công việc ({status}).',
    'tasks.planError': 'Không tải được phiên trên bảng phân công ({status}).',
    'err.saveFailed': 'Lưu thất bại: ', 'err.network': 'Lỗi mạng: ',
    'err.cloneDays': 'Hãy chọn ít nhất một ngày.', 'err.cloneFailed': 'Sao chép thất bại: ',
    'err.copyWeekFailed': 'Không sao chép được tuần: ',
    'err.weeklyTemplateFailed': 'Không cập nhật được thời khóa biểu: ',
    'err.statusFailed': 'Cập nhật trạng thái thất bại', 'err.deleteFailed': 'Xóa thất bại',
    'err.assignFailed': 'Không gán được người: ',
    'err.codeName': 'Cần nhập mã và tên.',
    'err.points': 'Điểm mặc định phải là số không âm.',
    'confirm.copyWeek': 'Sao chép lịch từ {from} sang {to}? Các phiên trùng khớp sẽ không bị sao chép thêm.',
    'confirm.deleteDay': 'Xóa phiên này? Thao tác sẽ được ghi lại trong lịch sử.',
    'confirm.programDelete': 'Ẩn hoặc xóa chương trình này? Các phiên hiện có vẫn được giữ lại.',
    'confirm.programReactivate': 'Kích hoạt lại chương trình và thời khóa biểu hàng tuần?',
    'alert.copyWeek': 'Đã sao chép {count} phiên sang tuần sau; không sao chép {skipped} phiên trùng khớp.',
    'alert.assignRepeat': 'Phiên đã được thêm vào {n} tuần (cùng ngày, cùng giờ). Chuyển đến các tuần sau để xem.',
    'dialog.notice': 'Thông báo', 'dialog.confirm': 'Xác nhận thao tác',
    'dialog.ok': 'Đồng ý', 'dialog.confirmButton': 'Tiếp tục', 'dialog.cancel': 'Hủy',
    'history.title': 'Lịch sử lịch làm việc', 'history.date': 'Thời gian', 'history.actor': 'Người thay đổi',
    'history.action': 'Thao tác', 'history.record': 'Bản ghi', 'history.details': 'Chi tiết',
    'history.staffFilter': 'Nhân viên (email)', 'history.recordFilter': 'Bản ghi',
    'history.from': 'Từ ngày', 'history.to': 'Đến ngày', 'history.apply': 'Lọc',
    'history.previous': '←', 'history.next': '→', 'history.page': 'Trang',
    'history.pagination': 'Phân trang lịch sử', 'history.previousPage': 'Trang trước',
    'history.nextPage': 'Trang tiếp theo',
    'history.pageOf': 'trên {count}',
    'history.empty': 'Chưa có mục lịch sử.', 'history.loadError': 'Không tải được lịch sử ({status}).',
    'history.loading': 'Đang tải lịch sử…',
    'monthlySessions.title': 'Phiên trong tháng',
    'monthlySessions.titleFor': '{name} · {month}',
    'monthlySessions.loading': 'Đang tải phiên…',
    'monthlySessions.empty': 'Không tìm thấy phiên trong tháng này.',
    'monthlySessions.error': 'Không tải được phiên ({status}).',
    'monthlySessions.demoSession': 'Công việc đã lên lịch', 'monthlySessions.status': 'Trạng thái',
    'staff.title': 'Danh sách nhân sự', 'staff.code': 'Mã nhân viên', 'staff.firstName': 'Tên',
    'staff.lastName': 'Họ', 'staff.email': 'Email công việc', 'staff.status': 'Trạng thái',
    'staff.action': 'Thao tác', 'staff.active': 'Đang hoạt động', 'staff.inactive': 'Đã ngừng hoạt động',
    'staff.edit': 'Chỉnh sửa', 'staff.editTitle': 'Chỉnh sửa nhân viên', 'staff.save': 'Lưu thay đổi',
    'staff.updated': 'Đã cập nhật nhân viên.', 'staff.updateError': 'Không thể cập nhật nhân viên ({status}).',
    'staff.add': 'Thêm nhân viên', 'staff.deactivate': 'Ngừng hoạt động',
    'staff.reactivate': 'Kích hoạt lại',
    'staff.empty': 'Không tìm thấy nhân sự.', 'staff.loadError': 'Không tải được nhân sự ({status}).',
    'staff.added': 'Đã thêm nhân viên.', 'staff.deactivated': 'Đã ngừng hoạt động; dữ liệu công việc được giữ nguyên.',
    'staff.reactivated': 'Đã kích hoạt lại nhân viên.',
    'staff.addError': 'Không thêm được nhân viên ({status}).',
    'staff.deactivateError': 'Không thể ngừng hoạt động nhân viên ({status}).',
    'staff.confirmDeactivate': 'Ngừng hoạt động {name}? Lịch và dữ liệu công việc hiện có sẽ được giữ nguyên.',
    'staff.reactivateError': 'Không thể kích hoạt lại nhân viên ({status}).',
    'staff.confirmReactivate': 'Kích hoạt lại {name}? Nhân viên có thể đăng nhập trở lại.',
    'tasks.monthlyProgress': 'Tiến độ tháng của tôi',
    'common.today': 'hôm nay',
    'day.sun': 'Chủ Nhật', 'day.mon': 'Thứ Hai', 'day.tue': 'Thứ Ba', 'day.wed': 'Thứ Tư',
    'day.thu': 'Thứ Năm', 'day.fri': 'Thứ Sáu', 'day.sat': 'Thứ Bảy',
    'month.1': 'Tháng 1', 'month.2': 'Tháng 2', 'month.3': 'Tháng 3', 'month.4': 'Tháng 4',
    'month.5': 'Tháng 5', 'month.6': 'Tháng 6', 'month.7': 'Tháng 7', 'month.8': 'Tháng 8',
    'month.9': 'Tháng 9', 'month.10': 'Tháng 10', 'month.11': 'Tháng 11', 'month.12': 'Tháng 12',
  },
};

function t(key, vars = {}) {
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dayName = i => t('day.' + DAY_KEYS[i]);
const monthName = i => t(`month.${i + 1}`);

function showAppDialog(message, confirmation = false) {
  const dialog = document.getElementById('app-message-dialog');
  if (dialog.open) return Promise.resolve(false);
  const title = document.getElementById('app-message-title');
  const content = document.getElementById('app-message-content');
  const cancel = document.getElementById('app-message-cancel');
  const accept = document.getElementById('app-message-accept');
  title.textContent = t(confirmation ? 'dialog.confirm' : 'dialog.notice');
  content.textContent = message;
  cancel.hidden = !confirmation;
  cancel.textContent = t('dialog.cancel');
  accept.textContent = t(confirmation ? 'dialog.confirmButton' : 'dialog.ok');

  return new Promise(resolve => {
    let result = false;
    const finish = accepted => {
      result = accepted;
      dialog.close();
    };
    const onCancel = event => {
      event.preventDefault();
      finish(false);
    };
    const onClose = () => resolve(result);
    cancel.onclick = () => finish(false);
    accept.onclick = () => finish(true);
    dialog.addEventListener('cancel', onCancel, { once: true });
    dialog.addEventListener('close', onClose, { once: true });
    dialog.showModal();
    accept.focus();
  });
}

function showNotice(message) {
  return showAppDialog(message);
}

function confirmAction(message) {
  return showAppDialog(message, true);
}

function applyTranslations() {
  document.documentElement.lang = lang === 'vi' ? 'vi' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

function refreshLangButtons() {
  const other = lang === 'en' ? 'VI' : 'EN';
  const title = lang === 'en' ? 'Tiếng Việt' : 'English';
  document.getElementById('lang-btn-value').textContent = other;
  document.getElementById('lang-btn').title = title;
  const loginBtn = document.getElementById('lang-btn-login');
  loginBtn.textContent = other;
  loginBtn.title = title;
}

function setLang(newLang) {
  lang = newLang;
  try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
  applyTranslations();
  refreshLangButtons();
  // Re-render the dynamic views in the new language
  if (currentUser) {
    if (LOCAL_DEMO) {
      document.getElementById('user').textContent = t('summary.demoUser');
    } else {
      loadMyTasks();
      if (scheduleLoaded) loadSchedule();
      if (scheduleViewMode === 'timetable') {
        renderTimetableEntries();
      }
      if (editingTimetable) {
        populateRulePickers();
        translateRuleModal();
      }
      if (planLoaded) loadPlanBoard();
      if (staffLoaded && currentUser.isAdmin) loadStaffDirectory();
    }
    if (monthlySummaryLoaded) loadMonthlySummary();
    if (quarterlyReportLoaded &&
        document.getElementById('quarterly-report-section').style.display !== 'none') {
      loadQuarterlyReport();
    }
  }
}

async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (opts.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${WORKER}${path}`, {
    ...opts,
    credentials: 'include',
    headers,
  });
  if (response.status === 401 && path.startsWith('/api/')) showSignIn();
  return response;
}

function showSignIn() {
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('signin-section').style.display = 'flex';
  document.getElementById('signin-link').href = `${WORKER}/auth/google`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function priorityBadge(priority) {
  const raw = priority || 'low';
  const p = escapeHtml(t('priority.' + raw));
  return `<span class="badge ${escapeHtml(raw)}">${p}</span>`;
}

function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return `
    <div class="progress-row">
      <div class="progress"><div class="progress-fill" style="width:${p}%"></div></div>
      <span class="pct">${p}%</span>
    </div>`;
}

function scheduleBadge(item) {
  if (!item?.is_recurring) return '';
  const label = item.is_modified ? t('schedule.weeklyModified') :
    item.is_old_recurring ? t('schedule.weeklyOld') : t('schedule.weekly');
  return ` <span class="mini-tag weekly-tag">${escapeHtml(label)}</span>`;
}

function deletedProgramBadge(item) {
  if (item?.program_is_active == null || Number(item.program_is_active) !== 0) return '';
  return ` <span class="mini-tag pm-deleted-tag">${escapeHtml(t('programs.deletedTag'))}</span>`;
}

function statusPill(status) {
  return `<span class="status-pill ${escapeHtml(status)}">${escapeHtml(t('status.' + status))}</span>`;
}

const pad2 = n => String(n).padStart(2, '0');
function vietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

const todayISO = () => {
  const { year, month, day } = vietnamDateParts();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

function fmtDue(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00Z');
  return `${dayName(d.getUTCDay())} ${d.getUTCDate()} ${monthName(d.getUTCMonth())}`;
}

