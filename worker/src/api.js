import {
  getEmployeeTasks,
  getTaskDetail,
  updateAssignmentProgress,
  getAllTasks,
  getAnyTaskDetail,
  updateAssignmentProgressAsAdmin,
} from './db.js';

export async function handleGetMyTasks(env, session) {
  const tasks = await getEmployeeTasks(env.DB, session.employeeId);
  return Response.json({ tasks });
}

export async function handleGetTask(env, session, taskId) {
  const task = await getTaskDetail(env.DB, taskId, session.employeeId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

export async function handleUpdateProgress(env, session, body) {
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

function requireAdmin(session) {
  if (!session?.isAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// ---------- Admin handlers ----------

export async function handleAdminGetAllTasks(env, session, url) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const status = url.searchParams.get('status');
  const employeeIdParam = url.searchParams.get('employeeId');
  const employeeId = employeeIdParam ? parseInt(employeeIdParam, 10) : null;

  const tasks = await getAllTasks(env.DB, { status, employeeId });
  return Response.json({ tasks });
}

export async function handleAdminGetTask(env, session, taskId) {
  const denied = requireAdmin(session);
  if (denied) return denied;

  const task = await getAnyTaskDetail(env.DB, taskId);
  if (!task) return new Response('Not found', { status: 404 });
  return Response.json({ task });
}

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