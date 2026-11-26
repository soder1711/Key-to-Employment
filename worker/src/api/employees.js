import {
  logScheduleHistory, getEmployeeDirectory, findEmployeeByCodeOrEmail, findEmployeeConflictForUpdate,
  createEmployee, updateEmployee, getManagedEmployee, deactivateEmployee, reactivateEmployee
} from '../db.js';
import { requireAdmin } from './authorization.js';

export async function handleAdminListEmployees(env, session) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const employees = await getEmployeeDirectory(env.DB);
  return Response.json({ employees });
}

export async function handleAdminCreateEmployee(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid employee', { status: 400 });
  }

  const employeeCode = typeof body.employeeCode === 'string' ? body.employeeCode.trim() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!employeeCode || employeeCode.length > 32 ||
      !firstName || firstName.length > 100 ||
      !lastName || lastName.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Invalid employee', { status: 400 });
  }
  if (await findEmployeeByCodeOrEmail(env.DB, employeeCode, email)) {
    return new Response('Employee code or email already exists', { status: 409 });
  }

  const result = await createEmployee(env.DB, { employeeCode, firstName, lastName, email });
  const employee = await getManagedEmployee(env.DB, result.meta.last_row_id);
  await logScheduleHistory(
    env.DB, session.email, 'create', 'employee', employee.employee_id,
    `Added ${employee.first_name} ${employee.last_name} (${employee.employee_code})`
  );
  return Response.json({ employee }, { status: 201 });
}

export async function handleAdminUpdateEmployee(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('Invalid employee', { status: 400 });
  }
  const employeeId = Number(body.employeeId);
  const employeeCode = typeof body.employeeCode === 'string' ? body.employeeCode.trim() : '';
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!Number.isSafeInteger(employeeId) || employeeId < 1 ||
      !employeeCode || employeeCode.length > 32 ||
      !firstName || firstName.length > 100 ||
      !lastName || lastName.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response('Invalid employee', { status: 400 });
  }

  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  if (await findEmployeeConflictForUpdate(env.DB, employeeCode, email, employeeId)) {
    return new Response('Employee code or email already exists', { status: 409 });
  }

  const result = await updateEmployee(env.DB, employeeId, { employeeCode, firstName, lastName, email });
  if (result.meta.changes === 0) return new Response('Employee not found', { status: 404 });
  const updatedEmployee = await getManagedEmployee(env.DB, employeeId);
  await logScheduleHistory(
    env.DB, session.email, 'update', 'employee', employeeId,
    'Updated staff ID, name, or work email'
  );
  return Response.json({ employee: updatedEmployee });
}

export async function handleAdminDeactivateEmployee(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const employeeId = Number(body?.employeeId);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid employee identifier', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  if (employee.is_admin === 1) {
    return new Response('Administrator accounts cannot be deactivated', { status: 409 });
  }
  if (!employee.is_active) return new Response('Employee is already inactive', { status: 409 });

  const result = await deactivateEmployee(env.DB, employeeId);
  if (result.meta.changes === 0) {
    const current = await getManagedEmployee(env.DB, employeeId);
    if (!current) return new Response('Employee not found', { status: 404 });
    if (current.is_admin === 1) {
      return new Response('Administrator accounts cannot be deactivated', { status: 409 });
    }
    return new Response('Employee is already inactive', { status: 409 });
  }
  await logScheduleHistory(
    env.DB, session.email, 'deactivate', 'employee', employeeId,
    `Deactivated ${employee.first_name} ${employee.last_name} (${employee.employee_code}); work records retained`
  );
  return Response.json({ success: true });
}

export async function handleAdminReactivateEmployee(env, session, body) {
  const denied = requireAdmin(session);
  if (denied) return denied;
  const employeeId = Number(body?.employeeId);
  if (!Number.isSafeInteger(employeeId) || employeeId < 1) {
    return new Response('Invalid employee identifier', { status: 400 });
  }
  const employee = await getManagedEmployee(env.DB, employeeId);
  if (!employee) return new Response('Employee not found', { status: 404 });
  if (employee.is_admin === 1) {
    return new Response('Administrator accounts cannot be reactivated through this endpoint', { status: 409 });
  }
  if (employee.is_active) return new Response('Employee is already active', { status: 409 });

  const result = await reactivateEmployee(env.DB, employeeId);
  if (result.meta.changes === 0) {
    const current = await getManagedEmployee(env.DB, employeeId);
    if (!current) return new Response('Employee not found', { status: 404 });
    if (current.is_admin === 1) {
      return new Response('Administrator accounts cannot be reactivated through this endpoint', { status: 409 });
    }
    return new Response('Employee is already active', { status: 409 });
  }
  await logScheduleHistory(
    env.DB, session.email, 'reactivate', 'employee', employeeId,
    `Reactivated ${employee.first_name} ${employee.last_name} (${employee.employee_code})`
  );
  return Response.json({ success: true });
}
