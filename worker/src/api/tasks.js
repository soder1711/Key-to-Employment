import {
  getEmployeeTasks, getTaskDetail, updateAssignmentProgress, getAllTasks, getAnyTaskDetail, updateAssignmentProgressAsAdmin
} from '../db.js';
import { requireAdmin } from './authorization.js';

export async function handleGetMyTasks(env, session) {
  const tasks = await getEmployeeTasks(env.DB, session.employeeId);
  return Response.json({ tasks });
}

/**
 * @api {get} /api/tasks/:taskId Get my task
 * @apiName GetMyTask
 * @apiGroup Tasks
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiParam {Number} taskId Task identifier.
 * @apiSuccess {Object} task Task details for the authenticated employee.
 * @apiError 404 Task not found or not assigned to the employee.
 */
export async function handleGetTask(env, session, taskId) {
  const task = await getTaskDetail(env.DB, taskId, session.employeeId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

/**
 * @api {post} /api/progress Update task progress
 * @apiName UpdateMyProgress
 * @apiGroup Tasks
 * @apiHeader {String} Cookie Encrypted administrator session cookie.
 * @apiBody {Number} assignmentId Assignment identifier.
 * @apiBody {Number} percentage Completion percentage from 0 to 100.
 * @apiBody {String} [notes] Optional progress notes.
 * @apiSuccess {Boolean} success Always true when the update succeeds.
 * @apiError 400 Invalid percentage.
 * @apiError 403 Administrator access required.
 * @apiError 404 Assignment not found.
 */
export async function handleUpdateProgress(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const { assignmentId, percentage, notes } = body;

  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
    return new Response('Invalid percentage', { status: 400 });
  }

  const result = await updateAssignmentProgress(
    env.DB, assignmentId, session.employeeId, percentage, notes || ''
  );

  if (result.meta.changes === 0) {
    return new Response('Assignment not found or not yours', { status: 404 });
  }
  return Response.json({ success: true });
}

// ---------- Admin guard ----------

export async function handleAdminGetAllTasks(env, session, url) {
  const status = url.searchParams.get('status');
  const employeeIdParam = url.searchParams.get('employeeId');
  const employeeId = employeeIdParam ? parseInt(employeeIdParam, 10) : null;

  const tasks = await getAllTasks(env.DB, { status, employeeId });
  return Response.json({ tasks });
}

/**
 * @api {get} /api/admin/tasks/:taskId Get any task
 * @apiName AdminGetTask
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted session cookie.
 * @apiParam {Number} taskId Task identifier.
 * @apiSuccess {Object} task Task details and assignment data.
 * @apiDescription Read-only workforce workload data available to all active employees.
 * @apiError 404 Task not found.
 */
export async function handleAdminGetTask(env, session, taskId) {
  const task = await getAnyTaskDetail(env.DB, taskId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

/**
 * @api {post} /api/admin/progress Update any task progress
 * @apiName AdminUpdateProgress
 * @apiGroup AdminTasks
 * @apiHeader {String} Cookie Encrypted admin session cookie.
 * @apiBody {Number} assignmentId Assignment identifier.
 * @apiBody {Number} percentage Completion percentage from 0 to 100.
 * @apiBody {String} [notes] Optional progress notes.
 * @apiSuccess {Boolean} success Always true when the update succeeds.
 * @apiError 403 Admin access required.
 * @apiError 400 Invalid percentage.
 * @apiError 404 Assignment not found.
 */
export async function handleAdminUpdateProgress(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const { assignmentId, percentage, notes } = body;

  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
    return new Response('Invalid percentage', { status: 400 });
  }

  const result = await updateAssignmentProgressAsAdmin(
    env.DB, assignmentId, percentage, notes || ''
  );

  if (result.meta.changes === 0) {
    return new Response('Assignment not found', { status: 404 });
  }
  return Response.json({ success: true });
}

// ---------- Schedule handlers ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MAX_CORRECTION_REASON_LENGTH = 1000;
