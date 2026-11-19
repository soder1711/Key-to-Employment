// ================= Configuration & shared helpers =================

const WORKER = 'https://task-portal.soder1234.workers.dev';
const LOCAL_DEMO = new URLSearchParams(window.location.search).get('demo') === '1' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

let currentUser = null;

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
    'nav.tasks': 'Tasks', 'nav.schedule': 'Schedule', 'nav.plan': 'Plan',
    'nav.monthly': 'Monthly summary',
    'summary.title': 'Monthly summary', 'summary.prev': '← Previous month',
    'summary.current': 'This month', 'summary.next': 'Next month →',
    'summary.daysOneToTen': 'Days 1–10', 'summary.daysElevenToTwenty': 'Days 11–20',
    'summary.daysTwentyOneToEnd': 'Days 21–end', 'summary.employee': 'Employee',
    'summary.points': 'Points earned', 'summary.estimated': 'Estimated points if all assigned sessions are completed', 'summary.goal': 'Monthly goal',
    'summary.notSet': 'Not set', 'summary.variance': 'Goal variance',
    'summary.aboveGoal': 'Points above goal', 'summary.completedTasks': 'Completed tasks',
    'summary.sharedGoal': 'Shared default: 170 points per person; admins can override for an employee and month.',
    'summary.sharedDefault': 'Shared default', 'summary.individualOverride': 'Individual override',
    'summary.goalFor': 'Monthly goal for {name}', 'summary.saveGoal': 'Save',
    'summary.useDefault': 'Use shared default', 'summary.savingGoal': 'Saving monthly goal…',
    'summary.goalSaved': 'Monthly goal saved.', 'summary.goalReset': 'Using shared default.',
    'summary.goalSaveError': 'Could not save monthly goal ({status}).',
    'summary.invalidGoal': 'Enter a goal from 0 to 10000 points.',
    'summary.tasksCount': '{count} tasks', 'summary.loading': 'Loading monthly summary…',
    'summary.error': 'Could not load monthly summary ({status}).',
    'summary.empty': 'No active employees.',
    'summary.demoNotice': 'Demo preview: sample data only; no sign-in or live data is used.',
    'summary.demoUser': 'Demo preview',
    'plan.board': 'Weekly plan table',
    'user.openMenu': 'Open profile menu',
    'user.signedInAs': 'Signed in as',
    'user.language': 'Language',
    'user.logout': 'Log out',
    'tasks.title': 'My tasks',
    'tasks.empty': 'No tasks or Plan assignments yet.',
    'th.task': 'Task', 'th.priority': 'Priority / category', 'th.status': 'Status',
    'th.date': 'Date / time', 'th.progress': 'Progress / points',
    'schedule.title': 'Schedule',
    'nav.jump': 'Go to', 'nav.chooseDate': 'Choose a date', 'nav.thisWeek': 'This week',
    'schedule.view': 'Schedule view', 'schedule.dated': 'Dated schedule', 'schedule.timetable': 'Weekly timetable',
    'schedule.tools': 'Import and copy tools', 'schedule.seriesTools': 'Series management',
    'schedule.ruleDates': '{start} to {end}', 'schedule.noEnd': 'no end date',
    'schedule.effectiveFrom': 'Latest settings from {date}', 'schedule.upcomingFrom': 'Upcoming settings from {date}',
    'schedule.confirmChange': 'Confirm change',
    'schedule.futureImpact': 'From {date}, this weekly rule changes. Past and completed sessions stay unchanged. Existing future exceptions will {policy}.',
    'schedule.occurrenceImpact': 'Only {date} is affected. The weekly rule and other occurrences stay unchanged.',
    'schedule.endImpact': 'Occurrences on or after the selected date will stop. Earlier settings and completed sessions stay unchanged.',
    'schedule.stopAllSummary': 'Stop ALL recurring entries. One-off sessions are not affected.',
    'schedule.prev': '← Prev week', 'schedule.today': 'Today', 'schedule.next': 'Next week →',
    'schedule.copyNext': 'Copy week to next week',
    'schedule.templateSave': 'Import this week into timetable',
    'schedule.templateDisable': 'Stop weekly timetable',
    'schedule.timetableEdit': 'Edit weekly timetable',
    'schedule.timetableHint': 'Weekly assignment matrix: each column is a fixed task occurrence for this week and each row is an employee. Click a task name to edit its recurring definition; assign people to individual dates in Plan.',
    'schedule.ruleContext': 'Recurring task definition: repeats on the selected weekday within its date range, with no default assignee. Assign people to each dated occurrence in Plan.',
    'schedule.invalidRange': 'End date must be on or after the start date.',
    'schedule.overlapWarning': 'This overlaps {task} ({time}) for the same person on {day}. Save anyway?',
    'schedule.timetableEmpty': 'No recurring entries yet.',
    'schedule.assigned': 'Assigned', 'schedule.notAssigned': 'Not assigned', 'schedule.unassigned': 'Unassigned',
    'schedule.noTaskOnDay': 'No fixed tasks',
    'schedule.weekly': 'Weekly', 'schedule.weeklyModified': 'Weekly - Modified',
    'schedule.day': 'Weekday', 'schedule.assignee': 'Assigned person',
    'schedule.editScope': 'Apply edit to',
    'schedule.thisFuture': 'This and future occurrences', 'schedule.onlyThis': 'Only this occurrence',
    'schedule.moveTo': 'Move occurrence to',
    'schedule.startDate': 'Starts on', 'schedule.endDate': 'Ends on (optional)',
    'schedule.applyFrom': 'Apply schedule changes from',
    'schedule.preserveExceptions': 'Replace future occurrence exceptions',
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
    'schedule.adminHint': 'Click an empty cell to add a one-off session; click a task to record completion or change its schedule. Use Weekly timetable for recurring work. Earned points count completed sessions only.',
    'schedule.loadError': 'Failed to load schedule: {msg}',
    'sth.date': 'Date', 'sth.program': 'Program', 'sth.category': 'Category',
    'sth.time': 'Time', 'sth.points': 'Points', 'sth.status': 'Status',
    'grid.employee': 'Employee', 'grid.pts': 'Earned points',
    'plan.title': 'Weekly plan', 'plan.adminTag': 'admin', 'plan.manage': 'Manage tasks',
    'plan.view': 'Plan view', 'plan.sessions': 'Dated sessions',
    'plan.timetableHint': 'Fixed recurring task occurrences with no default assignee. Click a cell to add one, or a rule to edit it.',
    'plan.hint': 'This view shows dated tasks for every day in the selected week. Drag a person onto a task to assign them for that date only; recurring weekly rules stay unchanged. Use the mode switch to view or manage weekly rules.',
    'plan.prev': '← Previous week', 'plan.today': 'Today', 'plan.next': 'Next week →',
    'plan.people': 'People',
    'plan.estimateShort': 'Est.', 'plan.earnedShort': 'Earned',
    'plan.morning': 'Morning', 'plan.afternoon': 'Afternoon and evening',
    'plan.dropHere': 'Drop person here', 'plan.noTasks': 'No tasks yet',
    'plan.addBtn': '+ Add one-off session…', 'plan.pointsTotal': 'Planned points',
    'plan.emptyPeople': 'No active employees.', 'plan.unassignedRow': 'Unassigned',
    'plan.loadError': 'Failed to load plan: {msg}',
    'plan.loadErrorStatus': 'Failed to load plan ({status}).',
    'plan.removeAssignee': 'Remove {name} from this task',
    'plan.clickOptions': 'Drag a person here to add them, or drag them here again to remove them',
    'mp.target': 'Target',
    'mp.excessShort': 'Excess',
    'status.pending': 'pending', 'status.assigned': 'assigned',
    'status.in_progress': 'in progress', 'status.active': 'active',
    'tag.sudden': 'sudden', 'tag.today': 'today',
    'login.sub': 'Sign in with your work account to view and update your tasks.',
    'login.google': 'Sign in with Google',
    'login.hint': 'Your access level is determined by your account.',
    'modal.task': 'Task', 'modal.date': 'Date', 'modal.start': 'Start', 'modal.end': 'End',
    'modal.points': 'Points (calculated automatically)', 'modal.pointsEditable': 'Points',
    'modal.sudden': ' Sudden session (doubles the points)',
    'modal.repeat': ' Copy as one-off sessions for a limited number of weeks',
    'modal.repeatWeeks': 'Repeat for (weeks, including this one)',
    'modal.repeatNote': 'Creates separate one-off sessions (max 53 weeks), not a recurring rule. For ongoing work, use Weekly timetable in Schedule.',
    'modal.notes': 'Notes', 'modal.notesPlaceholder': 'optional', 'modal.notesPrefix': 'Notes: ',
    'modal.add': 'Add one-off session',
    'modal.assignTitle': 'Add one-off session', 'modal.addTitle': 'Add one-off session',
    'modal.detailsTitle': 'Task details', 'modal.editTitle': 'Edit task',
    'modal.cloneTitle': 'Clone task to weekdays',
    'clone.chooseDays': 'Choose other weekdays in this week:',
    'modal.employee': 'Employee #{id}',
    'modal.dragAfter': ' — drag a person onto the task afterwards',
    'action.edit': 'Edit', 'action.cloneWeekdays': 'Clone to weekdays',
    'action.saveChanges': 'Save changes', 'action.back': 'Back', 'action.clone': 'Clone',
    'action.complete': '✓ Complete', 'action.reopen': '↺ Reopen', 'action.cancel': '✕ Cancel',
    'action.deleteDay': 'Delete this day',
    'programs.title': 'Tasks',
    'programs.context': 'Create new tasks or delete them from the list. Deleting a task that ' +
      'already has scheduled sessions only hides it (the sessions are kept); a task with no ' +
      'sessions is removed from the database.',
    'programs.new': 'New task', 'programs.create': 'Create task',
    'programs.listEmpty': 'No tasks in the database yet.',
    'programs.deletedTag': 'deleted', 'programs.deleteBtn': 'Delete',
    'pth.code': 'Code', 'pth.task': 'Task', 'pth.category': 'Category',
    'pth.pts': 'Default pts', 'pth.time': 'Default time', 'pth.action': 'Action',
    'plabel.code': 'Code', 'plabel.category': 'Category', 'plabel.name': 'Name',
    'plabel.points': 'Default points', 'plabel.start': 'Default start', 'plabel.end': 'Default end',
    'person.unassigned': 'Unassigned', 'person.unknown': 'Unknown',
    'period.hint': 'Appears in: {period} — allocated automatically from the start time',
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
    'tasks.projectError': 'Failed to load project tasks ({status}).',
    'tasks.planError': 'Failed to load Plan assignments ({status}).',
    'err.saveFailed': 'Save failed: ', 'err.network': 'Network error: ',
    'err.cloneDays': 'Choose at least one weekday.', 'err.cloneFailed': 'Clone failed: ',
    'err.copyWeekFailed': 'Week copy failed: ',
    'err.weeklyTemplateFailed': 'Weekly timetable update failed: ',
    'err.statusFailed': 'Status update failed', 'err.deleteFailed': 'Delete failed',
    'err.assignFailed': 'Could not assign person: ',
    'err.codeName': 'Code and name are required.',
    'err.points': 'Default points must be a number of at least 0.',
    'confirm.copyWeek': 'Copy the schedule from {from} to {to}? Existing matching sessions will not be duplicated.',
    'confirm.deleteDay': 'Delete this task? The deletion is recorded in history.',
    'confirm.programDelete': 'Delete this task? If it has scheduled sessions they are kept and the task ' +
      'is only hidden from the lists; otherwise it is removed from the database.',
    'alert.copyWeek': 'Copied {count} sessions to next week; {skipped} matching sessions were not duplicated.',
    'alert.assignRepeat': 'Task added to {n} weeks (same weekday, same time). Browse to later weeks to see it.',
    'common.today': 'today',
    'day.sun': 'Sun', 'day.mon': 'Mon', 'day.tue': 'Tue', 'day.wed': 'Wed',
    'day.thu': 'Thu', 'day.fri': 'Fri', 'day.sat': 'Sat',
    'month.1': 'January', 'month.2': 'February', 'month.3': 'March', 'month.4': 'April',
    'month.5': 'May', 'month.6': 'June', 'month.7': 'July', 'month.8': 'August',
    'month.9': 'September', 'month.10': 'October', 'month.11': 'November', 'month.12': 'December',
  },
  vi: {
    'nav.tasks': 'Nhiệm vụ', 'nav.schedule': 'Lịch', 'nav.plan': 'Kế hoạch',
    'nav.monthly': 'Tổng kết tháng',
    'summary.title': 'Tổng kết tháng', 'summary.prev': '← Tháng trước',
    'summary.current': 'Tháng này', 'summary.next': 'Tháng sau →',
    'summary.daysOneToTen': 'Ngày 1–10', 'summary.daysElevenToTwenty': 'Ngày 11–20',
    'summary.daysTwentyOneToEnd': 'Ngày 21–cuối tháng', 'summary.employee': 'Nhân viên',
    'summary.points': 'Điểm đã đạt', 'summary.estimated': 'Điểm dự kiến nếu hoàn thành mọi phiên được giao', 'summary.goal': 'Mục tiêu tháng',
    'summary.notSet': 'Chưa đặt', 'summary.variance': 'Chênh lệch mục tiêu',
    'summary.aboveGoal': 'Điểm vượt mục tiêu', 'summary.completedTasks': 'Nhiệm vụ hoàn thành',
    'summary.sharedGoal': 'Mặc định chung: 170 điểm mỗi người; quản trị viên có thể đặt riêng theo nhân viên và tháng.',
    'summary.sharedDefault': 'Mặc định chung', 'summary.individualOverride': 'Mục tiêu riêng',
    'summary.goalFor': 'Mục tiêu tháng của {name}', 'summary.saveGoal': 'Lưu',
    'summary.useDefault': 'Dùng mặc định chung', 'summary.savingGoal': 'Đang lưu mục tiêu…',
    'summary.goalSaved': 'Đã lưu mục tiêu tháng.', 'summary.goalReset': 'Đang dùng mặc định chung.',
    'summary.goalSaveError': 'Không lưu được mục tiêu tháng ({status}).',
    'summary.invalidGoal': 'Nhập mục tiêu từ 0 đến 10000 điểm.',
    'summary.tasksCount': '{count} nhiệm vụ', 'summary.loading': 'Đang tải tổng kết tháng…',
    'summary.error': 'Không tải được tổng kết tháng ({status}).',
    'summary.empty': 'Không có nhân sự đang hoạt động.',
    'summary.demoNotice': 'Bản xem trước: chỉ dùng dữ liệu mẫu; không cần đăng nhập và không dùng dữ liệu trực tiếp.',
    'summary.demoUser': 'Bản xem trước',
    'plan.board': 'Bảng kế hoạch tuần',
    'user.openMenu': 'Mở menu hồ sơ',
    'user.signedInAs': 'Đã đăng nhập bằng',
    'user.language': 'Ngôn ngữ',
    'user.logout': 'Đăng xuất',
    'tasks.title': 'Nhiệm vụ của tôi',
    'tasks.empty': 'Chưa có nhiệm vụ hay phân công Kế hoạch nào.',
    'th.task': 'Nhiệm vụ', 'th.priority': 'Ưu tiên / danh mục', 'th.status': 'Trạng thái',
    'th.date': 'Ngày / giờ', 'th.progress': 'Tiến độ / điểm',
    'schedule.title': 'Lịch',
    'nav.jump': 'Đi tới', 'nav.chooseDate': 'Chọn ngày', 'nav.thisWeek': 'Tuần này',
    'schedule.view': 'Chế độ xem lịch', 'schedule.dated': 'Lịch theo ngày', 'schedule.timetable': 'Thời khóa biểu hàng tuần',
    'schedule.tools': 'Công cụ nhập và sao chép', 'schedule.seriesTools': 'Quản lý chuỗi',
    'schedule.ruleDates': '{start} đến {end}', 'schedule.noEnd': 'không có ngày kết thúc',
    'schedule.effectiveFrom': 'Cài đặt mới nhất từ {date}', 'schedule.upcomingFrom': 'Cài đặt sắp tới từ {date}',
    'schedule.confirmChange': 'Xác nhận thay đổi',
    'schedule.futureImpact': 'Từ {date}, quy tắc hàng tuần sẽ thay đổi. Các phiên trước và đã hoàn thành không đổi. Các ngoại lệ tương lai sẽ được {policy}.',
    'schedule.occurrenceImpact': 'Chỉ ngày {date} bị ảnh hưởng. Quy tắc hàng tuần và các lần khác không đổi.',
    'schedule.endImpact': 'Các lần từ ngày được chọn trở đi sẽ dừng. Cài đặt trước đó và các phiên đã hoàn thành không đổi.',
    'schedule.stopAllSummary': 'Dừng TẤT CẢ mục lặp lại. Các phiên riêng lẻ không bị ảnh hưởng.',
    'schedule.prev': '← Tuần trước', 'schedule.today': 'Hôm nay', 'schedule.next': 'Tuần sau →',
    'schedule.copyNext': 'Sao chép tuần sang tuần sau',
    'schedule.templateSave': 'Nhập tuần này vào thời khóa biểu',
    'schedule.templateDisable': 'Tắt thời khóa biểu hàng tuần',
    'schedule.timetableEdit': 'Sửa thời khóa biểu hàng tuần',
    'schedule.timetableHint': 'Ma trận phân công tuần: mỗi cột là một công việc cố định trong tuần này và mỗi hàng là một nhân viên. Nhấn tên công việc để sửa quy tắc lặp; phân công cho từng ngày trong Kế hoạch.',
    'schedule.ruleContext': 'Định nghĩa nhiệm vụ lặp lại: lặp vào ngày trong tuần đã chọn trong khoảng ngày, không có người được giao mặc định. Giao nhân viên cho từng lần theo ngày trong Kế hoạch.',
    'schedule.invalidRange': 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
    'schedule.overlapWarning': 'Mục này trùng giờ với {task} ({time}) của cùng nhân sự vào {day}. Vẫn lưu?',
    'schedule.timetableEmpty': 'Chưa có mục lặp lại.',
    'schedule.assigned': 'Đã phân công', 'schedule.notAssigned': 'Chưa phân công', 'schedule.unassigned': 'Chưa giao',
    'schedule.noTaskOnDay': 'Không có công việc cố định',
    'schedule.weekly': 'Hàng tuần', 'schedule.weeklyModified': 'Hàng tuần - Đã sửa',
    'schedule.day': 'Ngày trong tuần', 'schedule.assignee': 'Người được giao',
    'schedule.editScope': 'Áp dụng chỉnh sửa cho',
    'schedule.thisFuture': 'Lần này và các lần sau', 'schedule.onlyThis': 'Chỉ lần này',
    'schedule.moveTo': 'Chuyển lần xuất hiện đến',
    'schedule.startDate': 'Bắt đầu từ', 'schedule.endDate': 'Kết thúc vào (không bắt buộc)',
    'schedule.applyFrom': 'Áp dụng thay đổi lịch từ ngày',
    'schedule.preserveExceptions': 'Thay thế các ngoại lệ trong tương lai',
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
    'schedule.adminHint': 'Nhấp ô trống để thêm phiên riêng lẻ; nhấp nhiệm vụ để ghi nhận hoàn thành hoặc sửa lịch. Dùng Thời khóa biểu hàng tuần cho công việc lặp lại. Điểm đã đạt chỉ tính phiên đã hoàn thành.',
    'schedule.loadError': 'Không tải được lịch: {msg}',
    'sth.date': 'Ngày', 'sth.program': 'Chương trình', 'sth.category': 'Danh mục',
    'sth.time': 'Giờ', 'sth.points': 'Điểm', 'sth.status': 'Trạng thái',
    'grid.employee': 'Nhân viên', 'grid.pts': 'Điểm đã đạt',
    'plan.title': 'Kế hoạch tuần', 'plan.adminTag': 'quản trị', 'plan.manage': 'Quản lý nhiệm vụ',
    'plan.view': 'Chế độ xem kế hoạch', 'plan.sessions': 'Phiên theo ngày',
    'plan.timetableHint': 'Các lần xuất hiện cố định của nhiệm vụ lặp lại, không có người được giao mặc định. Nhấp ô để thêm hoặc nhấp quy tắc để sửa.',
    'plan.hint': 'Chế độ này hiển thị nhiệm vụ theo ngày của cả tuần đã chọn. Kéo nhân viên vào nhiệm vụ để giao riêng cho ngày đó; quy tắc hàng tuần không thay đổi. Dùng nút chuyển chế độ để xem hoặc quản lý quy tắc hàng tuần.',
    'plan.prev': '← Tuần trước', 'plan.today': 'Hôm nay', 'plan.next': 'Tuần sau →',
    'plan.people': 'Nhân sự',
    'plan.estimateShort': 'Dự kiến', 'plan.earnedShort': 'Đã đạt',
    'plan.morning': 'Buổi sáng', 'plan.afternoon': 'Buổi chiều và tối',
    'plan.dropHere': 'Thả người vào đây', 'plan.noTasks': 'Chưa có nhiệm vụ',
    'plan.addBtn': '+ Thêm phiên riêng lẻ…', 'plan.pointsTotal': 'Điểm dự kiến',
    'plan.emptyPeople': 'Không có nhân sự đang hoạt động.', 'plan.unassignedRow': 'Chưa gán',
    'plan.loadError': 'Không tải được kế hoạch: {msg}',
    'plan.loadErrorStatus': 'Không tải được kế hoạch ({status}).',
    'plan.removeAssignee': 'Gỡ {name} khỏi nhiệm vụ này',
    'plan.clickOptions': 'Kéo nhân viên vào đây để thêm; kéo lại người đó để gỡ',
    'mp.target': 'Mục tiêu',
    'mp.excessShort': 'Vượt',
    'status.pending': 'đang chờ', 'status.assigned': 'đã gán',
    'status.in_progress': 'đang thực hiện', 'status.active': 'đang hoạt động',
    'tag.sudden': 'đột xuất', 'tag.today': 'hôm nay',
    'login.sub': 'Đăng nhập bằng tài khoản công việc để xem và cập nhật nhiệm vụ của bạn.',
    'login.google': 'Đăng nhập bằng Google',
    'login.hint': 'Quyền truy cập của bạn được xác định theo tài khoản.',
    'modal.task': 'Nhiệm vụ', 'modal.date': 'Ngày', 'modal.start': 'Bắt đầu', 'modal.end': 'Kết thúc',
    'modal.points': 'Điểm (tính tự động)', 'modal.pointsEditable': 'Điểm',
    'modal.sudden': ' Phiên đột xuất (nhân đôi điểm)',
    'modal.repeat': ' Sao chép thành phiên riêng lẻ trong số tuần giới hạn',
    'modal.repeatWeeks': 'Lặp lại (số tuần, kể cả tuần này)',
    'modal.repeatNote': 'Tạo các phiên riêng lẻ (tối đa 53 tuần), không tạo quy tắc lặp lại. Với công việc lâu dài, dùng Thời khóa biểu hàng tuần trong Lịch.',
    'modal.notes': 'Ghi chú', 'modal.notesPlaceholder': 'không bắt buộc', 'modal.notesPrefix': 'Ghi chú: ',
    'modal.add': 'Thêm phiên riêng lẻ',
    'modal.assignTitle': 'Thêm phiên riêng lẻ', 'modal.addTitle': 'Thêm phiên riêng lẻ',
    'modal.detailsTitle': 'Chi tiết nhiệm vụ', 'modal.editTitle': 'Sửa nhiệm vụ',
    'modal.cloneTitle': 'Sao chép nhiệm vụ sang các ngày trong tuần',
    'clone.chooseDays': 'Chọn các ngày khác trong tuần này:',
    'modal.employee': 'Nhân viên #{id}',
    'modal.dragAfter': ' — kéo người vào nhiệm vụ sau đó',
    'action.edit': 'Sửa', 'action.cloneWeekdays': 'Sao chép sang ngày khác',
    'action.saveChanges': 'Lưu thay đổi', 'action.back': 'Quay lại', 'action.clone': 'Sao chép',
    'action.complete': '✓ Hoàn thành', 'action.reopen': '↺ Mở lại', 'action.cancel': '✕ Hủy',
    'action.deleteDay': 'Xóa ngày này',
    'programs.title': 'Nhiệm vụ',
    'programs.context': 'Tạo nhiệm vụ mới hoặc xóa khỏi danh sách. Xóa nhiệm vụ đã có phiên lên lịch ' +
      'thì chỉ ẩn đi (các phiên được giữ); nhiệm vụ chưa có phiên sẽ bị xóa khỏi cơ sở dữ liệu.',
    'programs.new': 'Nhiệm vụ mới', 'programs.create': 'Tạo nhiệm vụ',
    'programs.listEmpty': 'Chưa có nhiệm vụ nào trong cơ sở dữ liệu.',
    'programs.deletedTag': 'đã xóa', 'programs.deleteBtn': 'Xóa',
    'pth.code': 'Mã', 'pth.task': 'Nhiệm vụ', 'pth.category': 'Danh mục',
    'pth.pts': 'Điểm mặc định', 'pth.time': 'Giờ mặc định', 'pth.action': 'Thao tác',
    'plabel.code': 'Mã', 'plabel.category': 'Danh mục', 'plabel.name': 'Tên',
    'plabel.points': 'Điểm mặc định', 'plabel.start': 'Giờ bắt đầu mặc định', 'plabel.end': 'Giờ kết thúc mặc định',
    'person.unassigned': 'Chưa gán', 'person.unknown': 'Không rõ',
    'period.hint': 'Xuất hiện ở: {period} — xếp tự động theo giờ bắt đầu',
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
    'tasks.projectError': 'Không tải được nhiệm vụ dự án ({status}).',
    'tasks.planError': 'Không tải được phân công Kế hoạch ({status}).',
    'err.saveFailed': 'Lưu thất bại: ', 'err.network': 'Lỗi mạng: ',
    'err.cloneDays': 'Hãy chọn ít nhất một ngày.', 'err.cloneFailed': 'Sao chép thất bại: ',
    'err.copyWeekFailed': 'Không sao chép được tuần: ',
    'err.weeklyTemplateFailed': 'Không cập nhật được thời khóa biểu: ',
    'err.statusFailed': 'Cập nhật trạng thái thất bại', 'err.deleteFailed': 'Xóa thất bại',
    'err.assignFailed': 'Không gán được người: ',
    'err.codeName': 'Cần nhập mã và tên.',
    'err.points': 'Điểm mặc định phải là số không âm.',
    'confirm.copyWeek': 'Sao chép lịch từ {from} sang {to}? Các phiên trùng khớp sẽ không bị sao chép thêm.',
    'confirm.deleteDay': 'Xóa nhiệm vụ này? Việc xóa được ghi lại trong lịch sử.',
    'confirm.programDelete': 'Xóa nhiệm vụ này? Nếu đã có phiên lên lịch, các phiên được giữ và nhiệm vụ ' +
      'chỉ bị ẩn khỏi danh sách; nếu chưa có phiên, nhiệm vụ bị xóa khỏi cơ sở dữ liệu.',
    'alert.copyWeek': 'Đã sao chép {count} phiên sang tuần sau; không sao chép {skipped} phiên trùng khớp.',
    'alert.assignRepeat': 'Nhiệm vụ đã được thêm vào {n} tuần (cùng ngày, cùng giờ). Chuyển đến các tuần sau để xem.',
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
    }
    if (monthlySummaryLoaded) loadMonthlySummary();
  }
}

async function api(path, opts = {}) {
  return fetch(`${WORKER}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
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
  const label = item.is_modified ? t('schedule.weeklyModified') : t('schedule.weekly');
  return ` <span class="mini-tag weekly-tag">${escapeHtml(label)}</span>`;
}

function statusPill(status) {
  return `<span class="status-pill ${escapeHtml(status)}">${escapeHtml(t('status.' + status))}</span>`;
}

const pad2 = n => String(n).padStart(2, '0');
const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDue(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00Z');
  return `${dayName(d.getUTCDay())} ${d.getUTCDate()} ${monthName(d.getUTCMonth())}`;
}

