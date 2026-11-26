export async function getEmployeeAuth(db, employeeId) {
  return await db.prepare(`
    SELECT employee_id, email, is_active, is_admin, picture_url
    FROM employees
    WHERE employee_id = ?
    LIMIT 1
  `).bind(employeeId).first();
}

export async function getEmployeeDirectory(db) {
  const { results } = await db.prepare(`
    SELECT employee_id, employee_code, first_name, last_name, email, is_active, is_admin
    FROM employees
    ORDER BY is_active DESC, first_name, last_name
  `).all();
  return results;
}

export async function getManagedEmployee(db, employeeId) {
  return await db.prepare(`
    SELECT employee_id, employee_code, first_name, last_name, email, is_active, is_admin
    FROM employees
    WHERE employee_id = ?
    LIMIT 1
  `).bind(employeeId).first();
}

export async function findEmployeeByCodeOrEmail(db, employeeCode, email) {
  return await db.prepare(`
    SELECT employee_id
    FROM employees
    WHERE employee_code = ? OR email = ?
    LIMIT 1
  `).bind(employeeCode, email).first();
}

export async function findEmployeeConflictForUpdate(db, employeeCode, email, employeeId) {
  return await db.prepare(`
    SELECT employee_id
    FROM employees
    WHERE (employee_code = ? OR email = ?) AND employee_id != ?
    LIMIT 1
  `).bind(employeeCode, email, employeeId).first();
}

export async function createEmployee(db, employee) {
  return await db.prepare(`
    INSERT INTO employees (employee_code, first_name, last_name, email, is_admin, is_active)
    VALUES (?, ?, ?, ?, 0, 1)
  `).bind(
    employee.employeeCode,
    employee.firstName,
    employee.lastName,
    employee.email,
  ).run();
}

export async function updateEmployee(db, employeeId, employee) {
  return await db.prepare(`
    UPDATE employees
    SET employee_code = ?, first_name = ?, last_name = ?, email = ?
    WHERE employee_id = ?
  `).bind(
    employee.employeeCode,
    employee.firstName,
    employee.lastName,
    employee.email,
    employeeId,
  ).run();
}

export async function deactivateEmployee(db, employeeId) {
  return await db.prepare(`
    UPDATE employees
    SET is_active = 0
    WHERE employee_id = ? AND is_admin = 0 AND is_active = 1
  `).bind(employeeId).run();
}

export async function reactivateEmployee(db, employeeId) {
  return await db.prepare(`
    UPDATE employees
    SET is_active = 1
    WHERE employee_id = ? AND is_admin = 0 AND is_active = 0
  `).bind(employeeId).run();
}
