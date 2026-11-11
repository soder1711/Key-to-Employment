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

// ================= Schedule feature (dates & state) =================

let scheduleWeekStart = null;
let scheduleLoaded = false;
let schedMode = 'week';
let monthCursor = { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() + 1 };
let monthlySummaryLoaded = false;
let adminPrograms = [];
let adminEmployees = [];
let sessionById = new Map();
let modalEmployeeId = null;
let modalDate = null;
let currentSession = null;

function mondayOf(dateStr) {
  const base = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayISO();
  const d = new Date(base + 'T00:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function shiftISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtTime(time) { return time ? String(time).slice(0, 5) : '—'; }

function fmtShort(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${monthName(d.getUTCMonth())}`;
}

function fmtCellDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const today = iso === todayISO() ? ` · ${t('common.today')}` : '';
  return `${dayName(d.getUTCDay())} ${d.getUTCDate()} ${monthName(d.getUTCMonth())}${today}`;
}

function fmtDayHeader(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `<span class="day-name">${dayName(d.getUTCDay())}</span>` +
         `<span class="day-num">${d.getUTCDate()}</span>` +
         `<span class="day-mon">${monthName(d.getUTCMonth())}</span>`;
}

// ---------- View switching ----------

function switchView(view) {
  const showTasks = view === 'tasks';
  const showSchedule = view === 'schedule';
  const showPlan = view === 'plan';
  const showMonthlySummary = view === 'monthly-summary' && currentUser?.isAdmin;

  document.getElementById('nav-tasks').classList.toggle('active', showTasks);
  document.getElementById('nav-schedule').classList.toggle('active', showSchedule);
  document.getElementById('nav-plan').classList.toggle('active', showPlan);
  document.getElementById('nav-monthly').classList.toggle('active', showMonthlySummary);

  document.getElementById('my-tasks-section').style.display = showTasks ? 'block' : 'none';
  document.getElementById('schedule-section').style.display = showSchedule ? 'block' : 'none';
  document.getElementById('plan-section').style.display =
    showPlan && currentUser?.isAdmin ? 'block' : 'none';
  document.getElementById('monthly-summary-section').style.display =
    showMonthlySummary ? 'block' : 'none';

  if (showPlan && !planLoaded) initPlan();
  if (showMonthlySummary) {
    monthlySummaryLoaded = true;
    loadMonthlySummary();
  }
  if (showTasks) loadMyTasks();
  if (showSchedule) {
    if (!scheduleLoaded) {
      scheduleWeekStart = mondayOf();
      scheduleLoaded = true;
    }
    loadSchedule();
  }
}

function loadSchedule() {
  const isAdmin = currentUser?.isAdmin;
  document.getElementById('admin-schedule-hint').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('admin-schedule-wrap').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('worker-schedule-wrap').style.display = isAdmin ? 'none' : 'block';
  document.getElementById('my-schedule-empty').style.display = 'none';
  document.getElementById('my-week-totals').style.display = isAdmin ? 'none' : 'block';
  if (isAdmin) loadAdminSchedule();
  else loadMySchedule();
}

// ---------- Worker week ----------

async function loadMySchedule() {
  const tbody = document.getElementById('my-schedule-body');
  const empty = document.getElementById('my-schedule-empty');
  const error = document.getElementById('schedule-error');
  const totals = document.getElementById('my-week-totals');

  try {
    const res = await api(`/api/schedule?start=${scheduleWeekStart}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    scheduleWeekStart = data.weekStart;
    document.getElementById('schedule-week-label').textContent =
      `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;
    error.style.display = 'none';

    const visible = data.sessions.filter(s => s.status !== 'cancelled');
    if (!data.sessions.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      tbody.innerHTML = data.sessions.map(s => `
        <tr${s.status === 'cancelled' ? ' class="cancelled-row"' : ''}>
          <td>${fmtCellDate(s.session_date)}</td>
          <td>${escapeHtml(s.program_name)}${s.is_sudden ? ` <span class="mini-tag sudden">${escapeHtml(t('tag.sudden'))}</span>` : ''}</td>
          <td><span class="cat-tag ${escapeHtml(s.category)}">${escapeHtml(s.category)}</span></td>
          <td>${s.start_time ? fmtTime(s.start_time) : '—'}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</td>
          <td class="pts">${Number(s.points).toFixed(1)}</td>
          <td>${statusPill(s.status)}</td>
        </tr>`).join('');
    }

    const done = data.sessions.filter(s => s.status === 'completed');
    const earned = done.reduce((a, s) => a + Number(s.points), 0);
    const planned = visible.reduce((a, s) => a + Number(s.points), 0);

    totals.innerHTML = `
      <div class="totals-row">
        <span>${t('totals.sessions')} <strong>${visible.length}</strong></span>
        <span>${t('totals.completed')} <strong>${done.length}</strong></span>
        <span>${t('totals.earned')} <strong>${earned.toFixed(1)}</strong></span>
        <span>${t('totals.potential')} <strong>${planned.toFixed(1)}</strong></span>
      </div>
      ${renderMonthProgress(data.summary,
        data.summaryMonth ? monthName(data.summaryMonth.month - 1) : '')}`;
  } catch (err) {
    tbody.innerHTML = '';
    empty.style.display = 'none';
    totals.innerHTML = '';
    error.textContent = t('schedule.loadError', { msg: err.message });
    error.style.display = 'block';
  }
}

function renderMonthProgress(summary, label) {
  if (!summary) return '';
  const earned = Number(summary.completed_points || 0);
  const target = Number(summary.target_points || 0);
  const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
  const excess = target > 0 ? Math.max(0, earned - target) : 0;
  const labelTxt = label ? `${label}: ` : '';
  const footer = target > 0
    ? (excess > 0
        ? `<div class="mp-excess">${t('mp.excess', { p: excess.toFixed(1) })}</div>`
        : `<div class="mp-remaining">${t('mp.remaining', { p: (target - earned).toFixed(1) })}</div>`)
    : `<div class="mp-remaining">${t('mp.noTarget')}</div>`;
  return `
    <div class="month-progress">
      <div class="mp-label">${labelTxt}<strong>${earned.toFixed(1)}</strong> / ${target.toFixed(1)} ${t('mp.credited')} ·
        ${t('mp.sessionsDone', { done: summary.completed_sessions || 0, total: summary.total_sessions || 0 })}</div>
      ${progressBar(pct)}
      ${footer}
    </div>`;
}

// ---------- Admin week grid ----------

function slotChipHtml(s) {
  return `
    <span class="slot-chip ${escapeHtml(s.status)}${s.is_sudden ? ' sudden' : ''}"
          data-session-id="${s.session_id}"
          title="${escapeHtml(s.program_name)} · ${fmtTime(s.start_time)} · ${Number(s.points).toFixed(1)} ${t('unit.pts')} · ${escapeHtml(t('status.' + s.status))}">
      ${escapeHtml(s.program_code)}${s.start_time ? ' ' + fmtTime(s.start_time) : ''}
    </span>`;
}

async function loadAdminSchedule() {
  const error = document.getElementById('schedule-error');
  try {
    const res = await api(`/api/admin/schedule?start=${scheduleWeekStart}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    scheduleWeekStart = data.weekStart;
    adminPrograms = data.programs;
    adminEmployees = data.employees;
    sessionById = new Map(data.sessions.map(s => [s.session_id, s]));

    document.getElementById('schedule-week-label').textContent =
      `${fmtShort(data.dates[0])} – ${fmtShort(data.dates[6])}`;
    error.style.display = 'none';

    const byEmp = {};
    const unassigned = {};
    for (const s of data.sessions) {
      if (s.employee_id == null) {
        // Repeated tasks without a person yet: kept separately so they stay
        // visible in the schedule grid (Unassigned row) instead of vanishing.
        (unassigned[s.session_date] ??= []).push(s);
        continue;
      }
      (byEmp[s.employee_id] ??= {});
      (byEmp[s.employee_id][s.session_date] ??= []).push(s);
    }

    const today = todayISO();
    let html = `<thead><tr><th class="sticky-col">${t('grid.employee')}</th>`;
    for (const d of data.dates) {
      const wd = new Date(d + 'T00:00:00Z').getUTCDay();
      const cls = (d === today ? ' today' : '') + (wd === 0 || wd === 6 ? ' weekend' : '');
      html += `<th class="day-head${cls}">${fmtDayHeader(d)}</th>`;
    }
    html += `<th class="pts-head">${t('grid.pts')}</th></tr></thead><tbody>`;

    for (const emp of data.employees) {
      const name = `${emp.first_name} ${emp.last_name}`.trim();
      html += `<tr><td class="sticky-col emp-cell" title="${escapeHtml(emp.email)}">${escapeHtml(name)}</td>`;
      let weekPts = 0;
      for (const d of data.dates) {
        const list = (byEmp[emp.employee_id] || {})[d] || [];
        weekPts += list.filter(s => s.status === 'completed')
                       .reduce((a, s) => a + Number(s.points), 0);
        html += `<td class="grid-cell${list.length ? ' has' : ''}${d === today ? ' today' : ''}"
                    data-employee-id="${emp.employee_id}" data-date="${d}">
                   ${list.map(slotChipHtml).join('')}</td>`;
      }
      html += `<td class="pts-cell">${weekPts ? weekPts.toFixed(1) : ''}</td></tr>`;
    }

    // Unassigned row: repeated tasks that have no person yet still show up here
    if (Object.keys(unassigned).length) {
      html += `<tr><td class="sticky-col unassigned">${escapeHtml(t('plan.unassignedRow'))}</td>`;
      for (const d of data.dates) {
        const list = unassigned[d] || [];
        html += `<td class="grid-cell${list.length ? ' has' : ''}${d === today ? ' today' : ''}"
                    data-date="${d}">${list.map(slotChipHtml).join('')}</td>`;
      }
      html += `<td class="pts-cell"></td></tr>`;
    }

    document.getElementById('admin-schedule-grid').innerHTML = html + '</tbody>';
  } catch (err) {
    error.textContent = t('schedule.loadError', { msg: err.message });
    error.style.display = 'block';
  }
}

// ---------- Month view ----------

async function loadMonthView() {
  if (currentUser?.isAdmin) await loadAdminMonth();
  else await loadWorkerMonth();
}

async function loadAdminMonth() {
  const { year, month } = monthCursor;
  document.getElementById('month-label').textContent = `${monthName(month - 1)} ${year}`;
  const res = await api(`/api/admin/schedule/monthly?year=${year}&month=${month}`);
  if (!res.ok) return;
  const { rows } = await res.json();
  const wrap = document.getElementById('month-summary-wrap');

  if (!rows.length) {
    wrap.innerHTML = `<div class="empty">${t('plan.emptyPeople')}</div>`;
    return;
  }
  wrap.innerHTML = `<table class="month-table">
    <thead><tr>
      <th>${t('grid.employee')}</th><th>${t('sth.program')}</th><th>${t('totals.completed')}</th><th>${t('sth.points')}</th>
      <th>${t('mp.target')}</th><th>${t('th.progress')}</th><th>${t('mp.excessShort', { p: '' })}</th>
    </tr></thead>
    <tbody>${rows.map(r => {
      const earned = Number(r.completed_points);
      const target = Number(r.target_points);
      const pct = target > 0 ? Math.min(100, (earned / target) * 100) : 0;
      const excess = target > 0 ? Math.max(0, earned - target) : 0;
      return `<tr>
        <td>${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
        <td>${r.scheduled_sessions}</td>
        <td>${r.completed_sessions}</td>
        <td class="pts">${earned.toFixed(1)}</td>
        <td><input type="number" min="0" step="1" class="target-input"
                   data-employee-id="${r.employee_id}" value="${target}"></td>
        <td style="min-width:150px">${progressBar(pct)}</td>
        <td>${excess > 0 ? '+' + excess.toFixed(1) : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function loadWorkerMonth() {
  const { year, month } = monthCursor;
  document.getElementById('month-label').textContent = `${monthName(month - 1)} ${year}`;
  const probe = mondayOf(`${year}-${pad2(month)}-01`);
  const res = await api(`/api/schedule?start=${probe}&year=${year}&month=${month}`);
  if (!res.ok) return;
  const data = await res.json();
  document.getElementById('month-summary-wrap').innerHTML =
    data.summary ? renderMonthProgress(data.summary, '') : '';
}

function shiftMonth(delta) {
  let m = monthCursor.month + delta;
  let y = monthCursor.year;
  if (m < 1) { m = 12; y--; }
  if (m > 12) { m = 1; y++; }
  monthCursor = { year: y, month: m };
  loadMonthView();
}

const DEMO_MONTHLY_ROWS = [
  {
    employee_id: 1, first_name: 'Linh', last_name: 'Nguyen',
    days_1_10_points: 12.5, days_1_10_completed_sessions: 5,
    days_11_20_points: 9.5, days_11_20_completed_sessions: 4,
    days_21_end_points: 6, days_21_end_completed_sessions: 3,
    completed_points: 28, completed_sessions: 12, target_points: 24,
    target_set: 1, goal_variance: 4, points_above_goal: 4,
  },
  {
    employee_id: 2, first_name: 'Minh', last_name: 'Tran',
    days_1_10_points: 5, days_1_10_completed_sessions: 2,
    days_11_20_points: 8, days_11_20_completed_sessions: 4,
    days_21_end_points: 3, days_21_end_completed_sessions: 2,
    completed_points: 16, completed_sessions: 8, target_points: 20,
    target_set: 1, goal_variance: -4, points_above_goal: 0,
  },
  {
    employee_id: 3, first_name: 'Alex', last_name: 'Morgan',
    days_1_10_points: 0, days_1_10_completed_sessions: 0,
    days_11_20_points: 0, days_11_20_completed_sessions: 0,
    days_21_end_points: 0, days_21_end_completed_sessions: 0,
    completed_points: 0, completed_sessions: 0, target_points: 0,
    target_set: 0, goal_variance: null, points_above_goal: null,
  },
];

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
    const periodCells = periods.map(([pointsKey, countKey]) => {
      const count = Math.max(0, Number(row[countKey]) || 0);
      return `<td>${summaryPoints(row[pointsKey])} ${t('unit.pts')}` +
        `<span class="summary-cell-sub">${t('summary.tasksCount', { count })}</span></td>`;
    }).join('');
    return `<tr>
      <td class="summary-person">${escapeHtml(row.first_name)} ${escapeHtml(row.last_name)}</td>
      ${periodCells}
      <td class="pts">${summaryPoints(row.completed_points)} ${t('unit.pts')}</td>
      <td>${targetSet ? `${summaryPoints(row.target_points)} ${t('unit.pts')}` : t('summary.notSet')}</td>
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
      rows = DEMO_MONTHLY_ROWS.map(row => ({ ...row }));
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
  loadMonthlySummary();
}

// ================= Plan board (drag & drop, ONE day at a time) =================

let planWeekStart = null;   // Monday of the week currently loaded from the API
let planDayCursor = null;   // the single day currently displayed
let planLoaded = false;
let planDates = [];
let planSessions = [];
let planPeriod = null;
const planSortables = [];

function planEmployeeName(id) {
  const e = adminEmployees.find(x => x.employee_id === id);
  return e ? `${e.first_name} ${e.last_name}`.trim() : t('person.unknown');
}

function renderPool() {
  const pts = new Map();
  for (const s of planSessions) {
    if (s.status === 'cancelled' || s.employee_id == null) continue;
    pts.set(s.employee_id, (pts.get(s.employee_id) || 0) + Number(s.points || 0));
  }
  document.getElementById('pool-chips').innerHTML = adminEmployees.map(e => {
    const name = `${e.first_name} ${e.last_name}`.trim();
    const p = (pts.get(e.employee_id) || 0).toFixed(1);
    return `
      <span class="person-chip pool" data-employee-id="${e.employee_id}"
            title="${escapeHtml(name)} — ${p} ${t('unit.pts')}">
        ${escapeHtml(name)}<span class="chip-pts">${p}</span>
      </span>`;
  }).join('') || `<span class="empty">${t('plan.emptyPeople')}</span>`;
}

function planCells(s) {
  if (!s) return '<td></td><td></td><td></td>';
  const person = s.employee_id != null
    ? `<span class="person-chip assigned" data-employee-id="${s.employee_id}"
              data-session-id="${s.session_id}"
              title="${escapeHtml(t('plan.clickOptions'))}">
         ${escapeHtml(planEmployeeName(s.employee_id))}</span>`
    : `<span class="drop-here">${escapeHtml(t('plan.dropHere'))}</span>`;
  return `
    <td class="cell-task">
      <button type="button" class="task-link" data-session-id="${s.session_id}"
              title="${escapeHtml(t('plan.clickOptions'))}">${escapeHtml(s.program_name)}</button>
      ${s.is_sudden ? `<span class="mini-tag sudden">${escapeHtml(t('tag.sudden'))}</span>` : ''}
      <span class="task-sub">${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''}</span>
    </td>
    <td class="cell-pts">${Number(s.points || 0).toFixed(1)}</td>
    <td class="cell-person-slot" data-session-id="${s.session_id}">${person}</td>`;
}

function renderDayTable(date) {
  const daySessions = planSessions
    .filter(s => s.session_date === date && s.status !== 'cancelled');
  // Automatic allocation: a task belongs to Morning or Afternoon and evening
  // purely based on its start time (< 12:00 = morning). No stored period.
  const morning = daySessions.filter(s => (s.start_time || '09:00') < '12:00');
  const afternoon = daySessions.filter(s => (s.start_time || '09:00') >= '12:00');
  const total = list =>
    list.reduce((a, s) => a + Number(s.points || 0), 0).toFixed(1);
  const d = new Date(date + 'T00:00:00Z');
  const isToday = date === todayISO();

  let body = '';
  if (!morning.length && !afternoon.length) {
    body = `
      <tr>
        <td colspan="3" class="no-tasks">${escapeHtml(t('plan.noTasks'))}</td>
        <td colspan="3" class="no-tasks">${escapeHtml(t('plan.noTasks'))}</td>
      </tr>`;
  } else {
    const rows = Math.max(morning.length, afternoon.length);
    for (let i = 0; i < rows; i++) {
      body += `<tr>${planCells(morning[i])}${planCells(afternoon[i])}</tr>`;
    }
  }
  body += `
    <tr class="add-row">
      <td colspan="3"><button type="button" class="add-task-btn"
            data-date="${date}" data-period="morning">${escapeHtml(t('plan.addBtn'))}</button></td>
      <td colspan="3"><button type="button" class="add-task-btn"
            data-date="${date}" data-period="afternoon">${escapeHtml(t('plan.addBtn'))}</button></td>
    </tr>
    <tr class="total-row">
      <td colspan="2" class="total-label">${escapeHtml(t('plan.pointsTotal'))}</td>
      <td class="cell-pts">${total(morning)}</td>
      <td colspan="2" class="total-label">${escapeHtml(t('plan.pointsTotal'))}</td>
      <td class="cell-pts">${total(afternoon)}</td>
    </tr>`;

  return `
    <div class="day-block${isToday ? ' today' : ''}">
      <div class="day-block-head">
        <span class="db-day">${dayName(d.getUTCDay())}</span>
        <span class="db-date">${d.getUTCDate()} ${monthName(d.getUTCMonth())}</span>
        ${isToday ? `<span class="mini-tag today-tag">${escapeHtml(t('tag.today'))}</span>` : ''}
      </div>
      <div class="table-scroll">
        <table class="plan-table">
          <colgroup>
            <col class="col-task"><col class="col-pts"><col class="col-person">
            <col class="col-task"><col class="col-pts"><col class="col-person">
          </colgroup>
          <thead>
            <tr>
              <th colspan="3" class="period-head morning">${escapeHtml(t('plan.morning'))}</th>
              <th colspan="3" class="period-head afternoon">${escapeHtml(t('plan.afternoon'))}</th>
            </tr>
            <tr class="col-heads">
              <th>${escapeHtml(t('th.task'))}</th><th>${escapeHtml(t('sth.points'))}</th><th>${escapeHtml(t('plan.people'))}</th>
              <th>${escapeHtml(t('th.task'))}</th><th>${escapeHtml(t('sth.points'))}</th><th>${escapeHtml(t('plan.people'))}</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>`;
}

// Shows which single day is on screen, e.g. "Mon 2 November 2026"
function updatePlanDayLabel() {
  const el = document.getElementById('plan-day-label');
  if (!el || !planDayCursor) return;
  const d = new Date(planDayCursor + 'T00:00:00Z');
  el.textContent =
    `${dayName(d.getUTCDay())} ${d.getUTCDate()} ` +
    `${monthName(d.getUTCMonth())} ${d.getUTCFullYear()}`;
}

// Renders ONLY the day under planDayCursor (one table at a time)
function renderPlanBoard() {
  renderPool();
  let day = planDates.includes(planDayCursor) ? planDayCursor
    : (planDates.includes(todayISO()) ? todayISO() : planDates[0]);
  if (!day) return;
  planDayCursor = day;
  document.getElementById('plan-days').innerHTML = renderDayTable(day);
  updatePlanDayLabel();
  initPlanSortables();
}

// Jump to any day; loads that day's week when it crosses a week boundary
async function goToPlanDay(date) {
  if (!date) return;
  planDayCursor = date;
  const weekOfDate = mondayOf(date);
  try {
    if (weekOfDate !== planWeekStart) {
      planWeekStart = weekOfDate;
      await loadPlanBoard(); // renders after the new week is fetched
    } else {
      renderPlanBoard(); // same week, no network needed
    }
  } catch (err) {
    const errEl = document.getElementById('plan-error');
    errEl.textContent = t('plan.loadError', { msg: err.message });
    errEl.style.display = 'block';
  }
}

function shiftPlanDay(delta) {
  if (!planDayCursor) return;
  goToPlanDay(shiftISO(planDayCursor, delta));
}

function destroyPlanSortables() {
  while (planSortables.length) {
    try { planSortables.pop().destroy(); } catch { /* ignore */ }
  }
}

function initPlanSortables() {
  destroyPlanSortables();
  if (typeof Sortable === 'undefined') return; // SortableJS failed to load

  const pool = document.getElementById('pool-chips');
  if (pool) {
    planSortables.push(new Sortable(pool, {
      group: { name: 'people', pull: 'clone', put: false },
      sort: false,
      draggable: '.person-chip',
    }));
  }
  document.querySelectorAll('.cell-person-slot').forEach(cell => {
    planSortables.push(new Sortable(cell, {
      group: { name: 'people', pull: false, put: true },
      sort: false,
      draggable: '.person-chip',
      onAdd: onPersonDropped,
    }));
  });
}

async function onPersonDropped(evt) {
  const employeeId = Number(evt.item.dataset.employeeId);
  const sessionId = Number(evt.to.dataset.sessionId);
  if (!Number.isInteger(employeeId) || !Number.isInteger(sessionId)) {
    renderPlanBoard();
    return;
  }
  try {
    const res = await api('/api/admin/schedule/reassign', {
      method: 'POST',
      body: JSON.stringify({ sessionId, employeeId }),
    });
    if (!res.ok) alert(t('err.assignFailed') + (await res.text()));
  } catch (err) {
    alert(t('err.network') + err.message);
  }

  await loadPlanBoard(); // always re-render from saved data
  await loadMyTasks();

  // Ask about applying the same person to the following weeks
  try {
    const res = await api(`/api/admin/schedule/following?sessionId=${sessionId}`);
    if (!res.ok) return;
    const { following } = await res.json();
    if (!following || !following.length) return;
    const name = planEmployeeName(employeeId);
    pendingApply = { sessionId, employeeId };
    const withPerson = following.filter(s => s.employee_id != null).length;
    let ctx = t('apply.lead', { name: escapeHtml(name) }) + ' ' +
      (following.length === 1
        ? t('apply.count1')
        : t('apply.countN', { n: following.length })) + ' ' +
      t('apply.tail');
    if (withPerson) {
      ctx += ', ' + withPerson + ' ' +
        (withPerson === 1 ? t('apply.has1') : t('apply.hasN', { n: withPerson }));
    }
    ctx += ' ' + t('apply.ask', { name: escapeHtml(name) });
    document.getElementById('apply-context').innerHTML = ctx;
    document.getElementById('apply-override').checked = false;
    applyModal.style.display = 'flex';
  } catch { /* ignore — the single reassign already succeeded */ }
}

async function loadPlanBoard() {
  const errEl = document.getElementById('plan-error');
  const res = await api(`/api/admin/schedule?start=${planWeekStart}`);
  if (!res.ok) {
    errEl.textContent = t('plan.loadErrorStatus', { status: res.status });
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  const data = await res.json();
  planWeekStart = data.weekStart;
  planDates = data.dates;
  planSessions = data.sessions;
  adminEmployees = data.employees;
  adminPrograms = data.programs;
  sessionById = new Map(data.sessions.map(s => [s.session_id, s]));
  renderPlanBoard(); // renders only planDayCursor's table + day label
}

function initPlan() {
  planLoaded = true;
  planWeekStart = mondayOf();
  planDayCursor = todayISO(); // start on today
  loadPlanBoard();
}

function refreshScheduleViews() {
  // After plan-board changes the Schedule view follows the planned week,
  // so repeated tasks are visible there straight away.
  const planVisible =
    document.getElementById('plan-section').style.display === 'block';
  if (planVisible && planLoaded) scheduleWeekStart = planWeekStart;

  if (planLoaded) loadPlanBoard();
  scheduleLoaded = true; // schedule table always refreshes afterwards
  loadSchedule();
  loadMyTasks();
}

function openPlanAddModal(date, period) {
  planPeriod = period;
  modalEmployeeId = null; // person is added afterwards by dragging
  modalDate = date;
  document.getElementById('modal-title').textContent = t('modal.addTitle');
  document.getElementById('assign-context').textContent =
    `${fmtCellDate(date)} · ${period === 'morning' ? t('plan.morning') : t('plan.afternoon')}` +
    t('modal.dragAfter');
  populatePrograms();
  document.getElementById('assign-sudden').checked = false;
  document.getElementById('assign-notes').value = '';
  resetAssignRepeat();
  refreshAssignDefaults();
  openModal('assign');
}

// ================= Modal =================

const modal = document.getElementById('session-modal');
const programModal = document.getElementById('program-modal');
const applyModal = document.getElementById('apply-modal');

// Drag & drop "apply to all following weeks?" state
let pendingApply = null;

function openModal(which) {
  document.getElementById('modal-assign-form').style.display = which === 'assign' ? 'block' : 'none';
  document.getElementById('modal-details').style.display = which === 'details' ? 'block' : 'none';
  document.getElementById('modal-error').style.display = 'none';
  modal.style.display = 'flex';
}

function closeModal() {
  modal.style.display = 'none';
  currentSession = null;
}

function showModalError(msg) {
  const el = document.getElementById('modal-error');
  el.textContent = msg;
  el.style.display = 'block';
}

// "＋ Create new task…" entry in the task picker
const newProgramOption = () =>
  `<option value="__new__">＋ ${t('programs.new')}…</option>`;

function populatePrograms() {
  const sel = document.getElementById('assign-program');
  sel.innerHTML = adminPrograms.map(p =>
    `<option value="${p.program_id}">${escapeHtml(p.code)} — ${escapeHtml(p.name)} ` +
    `(${escapeHtml(p.category)}, ${Number(p.default_points).toFixed(1)} ${t('unit.pts')})</option>`).join('') +
    newProgramOption();
}

// Automatic allocation: tells (live) which column the task will appear in,
// decided purely by the start time.
function updateAssignPeriodHint() {
  const el = document.getElementById('assign-period-hint');
  if (!el) return;
  const start = document.getElementById('assign-start').value;
  el.textContent = start
    ? t('period.hint', { period: start < '12:00' ? t('plan.morning') : t('plan.afternoon') })
    : '';
}

function refreshAssignDefaults() {
  const sel = document.getElementById('assign-program');
  if (sel.value === '__new__') { updateAssignPeriodHint(); return; }
  const p = adminPrograms.find(x => x.program_id === Number(sel.value));
  if (!p) { updateAssignPeriodHint(); return; }

  // No period forcing any more: the program's default times are used as-is.
  // The "+ Add task…" buttons only prefill fallback times when the program
  // has no defaults; placement is always decided by the start time.
  let start = p.default_start || '';
  let end = p.default_end || '';
  if (!start && planPeriod) {
    const fallback = planPeriod === 'morning' ? ['09:00', '10:00'] : ['14:00', '15:00'];
    start = fallback[0];
    end = fallback[1];
  }
  document.getElementById('assign-start').value = start;
  document.getElementById('assign-end').value = end;

  // Automatic: program default points, doubled for sudden sessions
  const pts = Number(p.default_points || 0) *
    (document.getElementById('assign-sudden').checked ? 2 : 1);
  const ptsInput = document.getElementById('assign-points');
  ptsInput.value = pts;
  ptsInput.readOnly = true;

  updateAssignPeriodHint();
}

function resetAssignRepeat() {
  document.getElementById('assign-repeat').checked = false;
  document.getElementById('assign-repeat-weeks').value = ''; // empty = fixed schedule
  document.getElementById('assign-repeat-row').style.display = 'none';
}

function openAssignModal(employeeId, date) {
  planPeriod = null;
  modalEmployeeId = employeeId == null ? null : Number(employeeId); // null = unassigned task
  modalDate = date;
  const emp = modalEmployeeId == null
    ? null
    : adminEmployees.find(e => e.employee_id === modalEmployeeId);
  const who = modalEmployeeId == null
    ? t('person.unassigned')
    : (emp ? `${emp.first_name} ${emp.last_name}` : t('modal.employee', { id: modalEmployeeId }));
  document.getElementById('modal-title').textContent = t('modal.assignTitle');
  document.getElementById('assign-context').textContent = `${who} — ${fmtCellDate(date)}`;
  populatePrograms();
  document.getElementById('assign-sudden').checked = false;
  document.getElementById('assign-notes').value = '';
  resetAssignRepeat();
  refreshAssignDefaults();
  openModal('assign');
}

function openDetailsModal(sessionId) {
  const s = sessionById.get(sessionId);
  if (!s) return;
  currentSession = s;
  const person = s.first_name
    ? `${escapeHtml(s.first_name)} ${escapeHtml(s.last_name)}`
    : `<em>${escapeHtml(t('person.unassigned'))}</em>`;
  document.getElementById('modal-title').textContent = t('modal.detailsTitle');
  document.getElementById('detail-info').innerHTML = `
    <strong>${escapeHtml(s.program_name)}</strong> (${escapeHtml(s.category)})<br>
    ${person} · ${fmtCellDate(s.session_date)}<br>
    ${fmtTime(s.start_time)}${s.end_time ? '–' + fmtTime(s.end_time) : ''} ·
    ${Number(s.points).toFixed(1)} ${t('unit.pts')}${s.is_sudden ? ` · ${escapeHtml(t('tag.sudden'))}` : ''} ·
    <span class="status-pill ${escapeHtml(s.status)}">${escapeHtml(t('status.' + s.status))}</span>
    ${s.notes ? `<br>${escapeHtml(t('modal.notesPrefix'))}${escapeHtml(s.notes)}` : ''}`;
  openModal('details');
}

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

// ================= Event wiring =================

// ---- Language ----
document.getElementById('lang-btn').addEventListener('click', () =>
  setLang(lang === 'en' ? 'vi' : 'en'));
document.getElementById('lang-btn-login').addEventListener('click', () =>
  setLang(lang === 'en' ? 'vi' : 'en'));

// ---- Navigation & view switching ----
document.getElementById('nav-tasks').addEventListener('click', () => switchView('tasks'));
document.getElementById('nav-schedule').addEventListener('click', () => switchView('schedule'));
document.getElementById('nav-plan').addEventListener('click', () => switchView('plan'));
document.getElementById('nav-monthly').addEventListener('click', () => switchView('monthly-summary'));
document.getElementById('monthly-summary-prev').addEventListener('click', () => shiftSummaryMonth(-1));
document.getElementById('monthly-summary-next').addEventListener('click', () => shiftSummaryMonth(1));
document.getElementById('monthly-summary-current').addEventListener('click', () => {
  const now = new Date();
  monthCursor = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  loadMonthlySummary();
});

document.getElementById('schedule-prev').addEventListener('click', () => {
  scheduleWeekStart = shiftISO(scheduleWeekStart, -7);
  loadSchedule();
});
document.getElementById('schedule-next').addEventListener('click', () => {
  scheduleWeekStart = shiftISO(scheduleWeekStart, 7);
  loadSchedule();
});
document.getElementById('schedule-today').addEventListener('click', () => {
  scheduleWeekStart = mondayOf();
  loadSchedule();
});

document.getElementById('admin-schedule-grid').addEventListener('click', (e) => {
  const chip = e.target.closest('.slot-chip');
  if (chip) {
    openDetailsModal(Number(chip.dataset.sessionId));
    return;
  }
  const cell = e.target.closest('.grid-cell');
  if (cell) {
    // Unassigned-row cells have no data-employee-id -> null = unassigned task
    const raw = cell.dataset.employeeId;
    const employeeId = raw === undefined || raw === '' ? null : Number(raw);
    openAssignModal(employeeId, cell.dataset.date);
  }
});

// ---- Plan board navigation (one day at a time) ----
document.getElementById('plan-prev').addEventListener('click', () => shiftPlanDay(-1));
document.getElementById('plan-next').addEventListener('click', () => shiftPlanDay(1));
document.getElementById('plan-today').addEventListener('click', () => goToPlanDay(todayISO()));

// Arrow keys browse days while the plan view is open
document.addEventListener('keydown', (e) => {
  if (!planLoaded) return;
  if (document.getElementById('plan-section').style.display !== 'block') return;
  if (modal.style.display === 'flex' || programModal.style.display === 'flex' ||
      applyModal.style.display === 'flex') return;
  const tag = ((document.activeElement && document.activeElement.tagName) || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); shiftPlanDay(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); shiftPlanDay(1); }
});

// ---- Plan board clicks ----
document.getElementById('plan-days').addEventListener('click', (e) => {
  const addBtn = e.target.closest('.add-task-btn');
  if (addBtn) { openPlanAddModal(addBtn.dataset.date, addBtn.dataset.period); return; }
  const taskLink = e.target.closest('.task-link');
  if (taskLink) { openDetailsModal(Number(taskLink.dataset.sessionId)); return; }
  const chip = e.target.closest('.person-chip.assigned');
  if (chip) openDetailsModal(Number(chip.dataset.sessionId));
});

// ---- Modal wiring ----
document.getElementById('modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// "＋ Create new task…" opens the task types modal; otherwise recalc defaults
document.getElementById('assign-program').addEventListener('change', (e) => {
  if (e.target.value === '__new__') { openProgramModal(); return; }
  refreshAssignDefaults();
});
document.getElementById('assign-sudden').addEventListener('change', refreshAssignDefaults);

// Live allocation hint while the start time is edited
document.getElementById('assign-start').addEventListener('input', updateAssignPeriodHint);

document.getElementById('assign-repeat').addEventListener('change', (e) => {
  document.getElementById('assign-repeat-row').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('assign-submit').addEventListener('click', async (e) => {
  const btn = e.target;
  btn.disabled = true;
  try {
    // Repeat check:
    //   unchecked             -> repeatWeeks 1 (only this day, old behaviour)
    //   checked + number      -> that many weeks, capped at 53
    //   checked + empty box   -> repeatFixed: fixed weekly schedule,
    //                            backend creates one year (53 weeks)
    const repeatOn = document.getElementById('assign-repeat').checked;
    const weeksRaw = document.getElementById('assign-repeat-weeks').value.trim();
    const repeatFixed = repeatOn && weeksRaw === '';
    const repeatWeeks = repeatOn && !repeatFixed
      ? Math.min(53, Math.max(1, parseInt(weeksRaw, 10) || 1))
      : 1;

    const res = await api('/api/admin/schedule/assign', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: modalEmployeeId,
        date: modalDate,
        programId: Number(document.getElementById('assign-program').value),
        startTime: document.getElementById('assign-start').value || null,
        endTime: document.getElementById('assign-end').value || null,
        points: Number(document.getElementById('assign-points').value),
        isSudden: document.getElementById('assign-sudden').checked,
        notes: document.getElementById('assign-notes').value || null,
        repeatWeeks,
        repeatFixed,
      }),
    });
    if (!res.ok) {
      showModalError(t('err.saveFailed') + (await res.text()));
    } else {
      const data = await res.json().catch(() => null);
      closeModal();
      refreshScheduleViews();
      if (data?.repeatFixed) {
        alert(t('alert.assignFixed'));
      } else if (data?.repeatedWeeks > 1) {
        alert(t('alert.assignRepeat', { n: data.repeatedWeeks }));
      }
    }
  } catch (err) {
    showModalError(t('err.network') + err.message);
  } finally {
    btn.disabled = false;
  }
});

document.querySelectorAll('#modal-details [data-status]').forEach(b => {
  b.addEventListener('click', async () => {
    if (!currentSession) return;
    const res = await api('/api/admin/schedule/status', {
      method: 'POST',
      body: JSON.stringify({ sessionId: currentSession.session_id, status: b.dataset.status }),
    });
    if (res.ok) { closeModal(); refreshScheduleViews(); }
    else alert(t('err.statusFailed'));
  });
});

// Delete only the clicked day
document.getElementById('session-delete').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm(t('confirm.deleteDay'))) return;
  const res = await api('/api/admin/schedule/delete', {
    method: 'POST',
    body: JSON.stringify({ sessionId: currentSession.session_id }),
  });
  if (res.ok) { closeModal(); refreshScheduleViews(); }
  else alert(t('err.deleteFailed'));
});

// Delete the clicked day AND every later occurrence of the same series:
// same task, same start/end time, same weekday, from this date onward.
// Same task at a different time or weekday is never touched.
document.getElementById('session-delete-series').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm(t('confirm.deleteSeries'))) return;
  try {
    const res = await api('/api/admin/schedule/delete', {
      method: 'POST',
      body: JSON.stringify({ sessionId: currentSession.session_id, deleteFollowing: true }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      closeModal();
      refreshScheduleViews();
      const n = data?.deletedCount ?? 1;
      if (n > 1) alert(t('alert.deleteCount', { n }));
    } else {
      alert(t('err.deleteFailed') + ': ' + (await res.text()));
    }
  } catch (err) {
    alert(t('err.network') + err.message);
  }
});

// ---- Apply-to-following-weeks modal wiring (drag & drop) ----
document.getElementById('apply-close').addEventListener('click', closeApplyModal);
applyModal.addEventListener('click', (e) => { if (e.target === applyModal) closeApplyModal(); });

// "This day only": the drop already happened, nothing more to do
document.getElementById('apply-one').addEventListener('click', closeApplyModal);

document.getElementById('apply-all').addEventListener('click', async () => {
  if (!pendingApply) return closeApplyModal();
  const { sessionId, employeeId } = pendingApply;
  const override = document.getElementById('apply-override').checked;
  try {
    const res = await api('/api/admin/schedule/reassign', {
      method: 'POST',
      body: JSON.stringify({ sessionId, employeeId, applyFollowing: true, override }),
    });
    if (!res.ok) {
      alert(t('err.applyFailed') + (await res.text()));
    } else {
      const data = await res.json().catch(() => null);
      if (data?.skipped > 0) {
        alert(t('alert.applySkipped', { a: data.applied, s: data.skipped }));
      }
      refreshScheduleViews();
    }
  } catch (err) {
    alert(t('err.network') + err.message);
  }
  closeApplyModal();
});

// ---- Task types modal wiring (create / delete programs) ----
document.getElementById('manage-tasks-btn').addEventListener('click', openProgramModal);
document.getElementById('program-modal-close').addEventListener('click', closeProgramModal);
programModal.addEventListener('click', (e) => { if (e.target === programModal) closeProgramModal(); });

document.getElementById('program-submit').addEventListener('click', async (e) => {
  const btn = e.target;
  const code = document.getElementById('program-code').value.trim();
  const name = document.getElementById('program-name').value.trim();
  const category = document.getElementById('program-category').value.trim() || 'general';
  const defaultPoints = Number(document.getElementById('program-points').value);
  const defaultStart = document.getElementById('program-start').value || null;
  const defaultEnd = document.getElementById('program-end').value || null;

  document.getElementById('program-error').style.display = 'none';
  if (!code || !name) { showProgramError(t('err.codeName')); return; }
  if (!Number.isFinite(defaultPoints) || defaultPoints < 0) {
    showProgramError(t('err.points'));
    return;
  }

  btn.disabled = true;
  try {
    const res = await api('/api/admin/programs', {
      method: 'POST',
      body: JSON.stringify({ code, name, category, defaultPoints, defaultStart, defaultEnd }),
    });
    if (!res.ok) {
      showProgramError(t('err.saveFailed') + (await res.text()));
    } else {
      const data = await res.json();
      ['program-code', 'program-name', 'program-category'].forEach(
        id => document.getElementById(id).value = '');
      document.getElementById('program-points').value = 1;
      document.getElementById('program-start').value = '';
      document.getElementById('program-end').value = '';
      // Refresh the picker too; selects the new task if the assign form is open
      await refreshAdminPrograms(data.program?.program_id);
      renderProgramList();
    }
  } catch (err) {
    showProgramError(t('err.network') + err.message);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('program-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('.pm-del');
  if (!btn) return;
  if (!confirm(t('confirm.programDelete'))) return;
  document.getElementById('program-error').style.display = 'none';
  try {
    const res = await api('/api/admin/programs/delete', {
      method: 'POST',
      body: JSON.stringify({ programId: Number(btn.dataset.programId) }),
    });
    if (!res.ok) {
      showProgramError(t('err.deleteFailed') + ': ' + (await res.text()));
    } else {
      await refreshAdminPrograms();
      renderProgramList();
      if (planLoaded) loadPlanBoard(); // refresh the add-task pickers on the board
    }
  } catch (err) {
    showProgramError(t('err.network') + err.message);
  }
});

// ================= Boot =================

applyTranslations();
refreshLangButtons();
load();