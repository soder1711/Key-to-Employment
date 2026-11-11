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
    'summary.points': 'Completed points', 'summary.goal': 'Monthly goal',
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
    'user.logout': 'Log out',
    'tasks.title': 'My tasks',
    'tasks.empty': 'No tasks or Plan assignments yet.',
    'th.task': 'Task', 'th.priority': 'Priority / category', 'th.status': 'Status',
    'th.date': 'Date / time', 'th.progress': 'Progress / points',
    'schedule.title': 'Schedule',
    'schedule.prev': '← Prev week', 'schedule.today': 'Today', 'schedule.next': 'Next week →',
    'schedule.empty': 'No sessions scheduled for you this week.',
    'schedule.adminHint': 'Click an empty cell to assign a session · click a chip to complete, cancel or delete it · Pts = completed points this week.',
    'schedule.loadError': 'Failed to load schedule: {msg}',
    'sth.date': 'Date', 'sth.program': 'Program', 'sth.category': 'Category',
    'sth.time': 'Time', 'sth.points': 'Points', 'sth.status': 'Status',
    'grid.employee': 'Employee', 'grid.pts': 'Pts',
    'plan.title': 'Weekly plan', 'plan.adminTag': 'admin', 'plan.manage': 'Manage tasks',
    'plan.hint': 'Drag a person from the top onto a task to give it a person. ' +
      'If the same task (same time) exists on this weekday in following weeks, a popup asks ' +
      'whether to apply the person to this day only or to all following weeks — with an option ' +
      'to override weeks that already have a person. Points are added up automatically. ' +
      'Click a task for options. One day is shown at a time — use the arrows (or ← → keys) to see another day. ' +
      '"Delete + following weeks" removes every later occurrence with the same task, same time and same weekday; anything else is kept. ' +
      'Use "Manage tasks" to create new tasks or delete them from the list.',
    'plan.prev': '← Previous day', 'plan.today': 'Today', 'plan.next': 'Next day →',
    'plan.people': 'People',
    'plan.morning': 'Morning', 'plan.afternoon': 'Afternoon and evening',
    'plan.dropHere': 'Drop person here', 'plan.noTasks': 'No tasks yet',
    'plan.addBtn': '+ Add task…', 'plan.pointsTotal': 'Points total',
    'plan.emptyPeople': 'No active employees.', 'plan.unassignedRow': 'Unassigned',
    'plan.loadError': 'Failed to load plan: {msg}',
    'plan.loadErrorStatus': 'Failed to load plan ({status}).',
    'plan.clickOptions': 'Click for options — drop a new name here to replace',
    'mp.target': 'Target',
    'mp.excessShort': 'Excess',
    'status.pending': 'pending', 'status.assigned': 'assigned',
    'status.in_progress': 'in progress', 'status.active': 'active',
    'tag.sudden': 'sudden', 'tag.today': 'today',
    'login.sub': 'Sign in with your work account to view and update your tasks.',
    'login.google': 'Sign in with Google',
    'login.hint': 'Your access level is determined by your account.',
    'modal.task': 'Task', 'modal.start': 'Start', 'modal.end': 'End',
    'modal.points': 'Points (calculated automatically)',
    'modal.sudden': ' Sudden session (doubles the points)',
    'modal.repeat': ' Repeat every week (same weekday & time)',
    'modal.repeatWeeks': 'Repeat for (weeks, including this one)',
    'modal.repeatNote': 'Type a number of weeks (max 53) — or leave the box empty for a ' +
      'fixed weekly schedule: the task is then created in every subsequent week for one year (53 weeks).',
    'modal.notes': 'Notes', 'modal.notesPlaceholder': 'optional', 'modal.notesPrefix': 'Notes: ',
    'modal.add': 'Add task',
    'modal.assignTitle': 'Assign session', 'modal.addTitle': 'Add task',
    'modal.detailsTitle': 'Task details',
    'modal.employee': 'Employee #{id}',
    'modal.dragAfter': ' — drag a person onto the task afterwards',
    'action.complete': '✓ Complete', 'action.reopen': '↺ Reopen', 'action.cancel': '✕ Cancel',
    'action.deleteDay': 'Delete this day', 'action.deleteSeries': 'Delete + following weeks',
    'apply.title': 'Apply person to following weeks?',
    'apply.override': ' Override weeks that already have a person',
    'apply.note': 'Unchecked: only weeks without a person get this person; weeks that already ' +
      'have someone keep theirs. Checked: every following week gets this person, replacing existing ones.',
    'apply.one': 'This day only', 'apply.all': 'Apply to all following weeks',
    'apply.lead': 'You put <strong>{name}</strong> on this week\u2019s task.',
    'apply.count1': 'There is <strong>1</strong> similar task',
    'apply.countN': 'There are <strong>{n}</strong> similar tasks',
    'apply.tail': 'in following weeks (same task, same time, same weekday)',
    'apply.has1': 'of which already has a person',
    'apply.hasN': 'of which already have a person',
    'apply.ask': 'Apply {name} there too?',
    'programs.title': 'Tasks',
    'programs.context': 'Create new tasks or delete them from the list. Deleting a task that ' +
      'already has scheduled sessions only hides it (the sessions are kept); a task with no ' +
      'sessions is removed from the database.',
    'programs.new': 'New task', 'programs.create': 'Create task',
    'programs.listEmpty': 'No tasks in the database yet.',
    'programs.deletedTag': 'deleted', 'programs.deleteBtn': 'Delete',
    'pth.code': 'Code', 'pth.task': 'Task', 'pth.category': 'Category',
    'pth.pts': 'Default pts', 'pth.time': 'Default time',
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
    'err.statusFailed': 'Status update failed', 'err.deleteFailed': 'Delete failed',
    'err.assignFailed': 'Could not assign person: ',
    'err.applyFailed': 'Could not apply to following weeks: ',
    'err.codeName': 'Code and name are required.',
    'err.points': 'Default points must be a number of at least 0.',
    'confirm.deleteDay': 'Delete this task? The deletion is recorded in history.',
    'confirm.deleteSeries': 'Delete this task AND every later occurrence of this task with the SAME time\n' +
      'on this weekday, from this date onward?\n\n' +
      'Same task at a different time, or on a different weekday, is kept.\n' +
      'Earlier weeks are kept. Already completed sessions are kept (they count toward points). ' +
      'The deletion is recorded in history.',
    'confirm.programDelete': 'Delete this task? If it has scheduled sessions they are kept and the task ' +
      'is only hidden from the lists; otherwise it is removed from the database.',
    'alert.deleteCount': 'Deleted {n} sessions from this date onward.',
    'alert.assignRepeat': 'Task added to {n} weeks (same weekday, same time). Browse to later weeks to see it.',
    'alert.assignFixed': 'Fixed schedule added: the task repeats every week for one year (53 weeks). Browse to later weeks to see it.',
    'alert.applySkipped': 'Applied to {a} following week(s); skipped {s} that already had a person.',
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
    'summary.points': 'Điểm hoàn thành', 'summary.goal': 'Mục tiêu tháng',
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
    'user.logout': 'Đăng xuất',
    'tasks.title': 'Nhiệm vụ của tôi',
    'tasks.empty': 'Chưa có nhiệm vụ hay phân công Kế hoạch nào.',
    'th.task': 'Nhiệm vụ', 'th.priority': 'Ưu tiên / danh mục', 'th.status': 'Trạng thái',
    'th.date': 'Ngày / giờ', 'th.progress': 'Tiến độ / điểm',
    'schedule.title': 'Lịch',
    'schedule.prev': '← Tuần trước', 'schedule.today': 'Hôm nay', 'schedule.next': 'Tuần sau →',
    'schedule.empty': 'Không có phiên nào được lên lịch cho bạn trong tuần này.',
    'schedule.adminHint': 'Nhấp vào ô trống để gán phiên · nhấp vào thẻ để hoàn thành, hủy hoặc xóa · Điểm = điểm đã hoàn thành trong tuần.',
    'schedule.loadError': 'Không tải được lịch: {msg}',
    'sth.date': 'Ngày', 'sth.program': 'Chương trình', 'sth.category': 'Danh mục',
    'sth.time': 'Giờ', 'sth.points': 'Điểm', 'sth.status': 'Trạng thái',
    'grid.employee': 'Nhân viên', 'grid.pts': 'Điểm',
    'plan.title': 'Kế hoạch tuần', 'plan.adminTag': 'quản trị', 'plan.manage': 'Quản lý nhiệm vụ',
    'plan.hint': 'Kéo một người từ phía trên vào một nhiệm vụ để gán người. ' +
      'Nếu cùng nhiệm vụ (cùng giờ) tồn tại ở ngày trong tuần này ở các tuần sau, một cửa sổ sẽ hỏi ' +
      'bạn muốn gán người chỉ cho ngày này hay cho tất cả các tuần sau — kèm tùy chọn ghi đè các tuần đã có người. ' +
      'Điểm được cộng tự động. Nhấp vào nhiệm vụ để xem tùy chọn. Mỗi lần hiển thị một ngày — dùng mũi tên (hoặc phím ← →) để xem ngày khác. ' +
      '"Xóa + các tuần sau" xóa mọi lần xuất hiện sau có cùng nhiệm vụ, cùng giờ, cùng ngày trong tuần; những cái khác được giữ. ' +
      'Dùng "Quản lý nhiệm vụ" để tạo nhiệm vụ mới hoặc xóa khỏi danh sách.',
    'plan.prev': '← Ngày trước', 'plan.today': 'Hôm nay', 'plan.next': 'Ngày sau →',
    'plan.people': 'Nhân sự',
    'plan.morning': 'Buổi sáng', 'plan.afternoon': 'Buổi chiều và tối',
    'plan.dropHere': 'Thả người vào đây', 'plan.noTasks': 'Chưa có nhiệm vụ',
    'plan.addBtn': '+ Thêm nhiệm vụ…', 'plan.pointsTotal': 'Tổng điểm',
    'plan.emptyPeople': 'Không có nhân sự đang hoạt động.', 'plan.unassignedRow': 'Chưa gán',
    'plan.loadError': 'Không tải được kế hoạch: {msg}',
    'plan.loadErrorStatus': 'Không tải được kế hoạch ({status}).',
    'plan.clickOptions': 'Nhấp để xem tùy chọn — thả tên khác vào đây để thay thế',
    'mp.target': 'Mục tiêu',
    'mp.excessShort': 'Vượt',
    'status.pending': 'đang chờ', 'status.assigned': 'đã gán',
    'status.in_progress': 'đang thực hiện', 'status.active': 'đang hoạt động',
    'tag.sudden': 'đột xuất', 'tag.today': 'hôm nay',
    'login.sub': 'Đăng nhập bằng tài khoản công việc để xem và cập nhật nhiệm vụ của bạn.',
    'login.google': 'Đăng nhập bằng Google',
    'login.hint': 'Quyền truy cập của bạn được xác định theo tài khoản.',
    'modal.task': 'Nhiệm vụ', 'modal.start': 'Bắt đầu', 'modal.end': 'Kết thúc',
    'modal.points': 'Điểm (tính tự động)',
    'modal.sudden': ' Phiên đột xuất (nhân đôi điểm)',
    'modal.repeat': ' Lặp lại mỗi tuần (cùng ngày & giờ)',
    'modal.repeatWeeks': 'Lặp lại (số tuần, kể cả tuần này)',
    'modal.repeatNote': 'Nhập số tuần (tối đa 53) — hoặc bỏ trống ô để tạo lịch cố định: ' +
      'nhiệm vụ sẽ được tạo ở mọi tuần sau trong một năm (53 tuần).',
    'modal.notes': 'Ghi chú', 'modal.notesPlaceholder': 'không bắt buộc', 'modal.notesPrefix': 'Ghi chú: ',
    'modal.add': 'Thêm nhiệm vụ',
    'modal.assignTitle': 'Gán phiên', 'modal.addTitle': 'Thêm nhiệm vụ',
    'modal.detailsTitle': 'Chi tiết nhiệm vụ',
    'modal.employee': 'Nhân viên #{id}',
    'modal.dragAfter': ' — kéo người vào nhiệm vụ sau đó',
    'action.complete': '✓ Hoàn thành', 'action.reopen': '↺ Mở lại', 'action.cancel': '✕ Hủy',
    'action.deleteDay': 'Xóa ngày này', 'action.deleteSeries': 'Xóa + các tuần sau',
    'apply.title': 'Gán người cho các tuần sau?',
    'apply.override': ' Ghi đè các tuần đã có người',
    'apply.note': 'Bỏ chọn: chỉ những tuần chưa có người mới được gán người này; những tuần đã có ' +
      'người giữ nguyên. Chọn: mọi tuần sau đều được gán người này, thay người hiện tại.',
    'apply.one': 'Chỉ ngày này', 'apply.all': 'Áp dụng cho tất cả các tuần sau',
    'apply.lead': 'Bạn đã gán <strong>{name}</strong> cho nhiệm vụ tuần này.',
    'apply.count1': 'Có <strong>1</strong> nhiệm vụ tương tự',
    'apply.countN': 'Có <strong>{n}</strong> nhiệm vụ tương tự',
    'apply.tail': 'ở các tuần sau (cùng nhiệm vụ, cùng giờ, cùng ngày trong tuần)',
    'apply.has1': 'trong số đó đã có người',
    'apply.hasN': 'trong số đó đã có người',
    'apply.ask': 'Gán {name} ở đó luôn không?',
    'programs.title': 'Nhiệm vụ',
    'programs.context': 'Tạo nhiệm vụ mới hoặc xóa khỏi danh sách. Xóa nhiệm vụ đã có phiên lên lịch ' +
      'thì chỉ ẩn đi (các phiên được giữ); nhiệm vụ chưa có phiên sẽ bị xóa khỏi cơ sở dữ liệu.',
    'programs.new': 'Nhiệm vụ mới', 'programs.create': 'Tạo nhiệm vụ',
    'programs.listEmpty': 'Chưa có nhiệm vụ nào trong cơ sở dữ liệu.',
    'programs.deletedTag': 'đã xóa', 'programs.deleteBtn': 'Xóa',
    'pth.code': 'Mã', 'pth.task': 'Nhiệm vụ', 'pth.category': 'Danh mục',
    'pth.pts': 'Điểm mặc định', 'pth.time': 'Giờ mặc định',
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
    'err.statusFailed': 'Cập nhật trạng thái thất bại', 'err.deleteFailed': 'Xóa thất bại',
    'err.assignFailed': 'Không gán được người: ',
    'err.applyFailed': 'Không áp dụng được cho các tuần sau: ',
    'err.codeName': 'Cần nhập mã và tên.',
    'err.points': 'Điểm mặc định phải là số không âm.',
    'confirm.deleteDay': 'Xóa nhiệm vụ này? Việc xóa được ghi lại trong lịch sử.',
    'confirm.deleteSeries': 'Xóa nhiệm vụ này VÀ mọi lần xuất hiện sau của cùng nhiệm vụ, CÙNG giờ,\n' +
      'vào ngày trong tuần này, kể từ ngày này?\n\n' +
      'Cùng nhiệm vụ nhưng khác giờ, hoặc khác ngày trong tuần, sẽ được giữ.\n' +
      'Các tuần trước được giữ. Phiên đã hoàn thành được giữ (tính vào điểm). Việc xóa được ghi lại trong lịch sử.',
    'confirm.programDelete': 'Xóa nhiệm vụ này? Nếu đã có phiên lên lịch, các phiên được giữ và nhiệm vụ ' +
      'chỉ bị ẩn khỏi danh sách; nếu chưa có phiên, nhiệm vụ bị xóa khỏi cơ sở dữ liệu.',
    'alert.deleteCount': 'Đã xóa {n} phiên kể từ ngày này.',
    'alert.assignRepeat': 'Nhiệm vụ đã được thêm vào {n} tuần (cùng ngày, cùng giờ). Chuyển đến các tuần sau để xem.',
    'alert.assignFixed': 'Đã tạo lịch cố định: nhiệm vụ lặp lại mỗi tuần trong một năm (53 tuần). Chuyển đến các tuần sau để xem.',
    'alert.applySkipped': 'Đã gán cho {a} tuần sau; bỏ qua {s} tuần đã có người.',
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
}

function refreshLangButtons() {
  const other = lang === 'en' ? 'VI' : 'EN';
  const title = lang === 'en' ? 'Tiếng Việt' : 'English';
  document.getElementById('lang-btn').textContent = other;
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

