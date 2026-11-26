import { handleLogin, handleCallback, handleLogout } from './auth.js';
import { readSession, parseCookies, buildSetCookie } from './session.js';
import { getEmployeeAuth } from './db.js';
import {
  handleGetMyTasks, handleGetTask, handleUpdateProgress,
  handleAdminGetAllTasks, handleAdminGetTask, handleAdminUpdateProgress,
  handleGetMySchedule, handleAdminGetSchedule, handleAdminAssignSession,
  handleAdminSessionStatus, handleAdminDeleteSession,
  handleAdminMonthlySummary, handleAdminSetTarget,
  handleAdminReassignSession,
  handleAdminUpdateSession, handleAdminCloneSession, handleAdminCopyScheduleWeek,
  handleAdminSetWeeklyTimetable, handleAdminGetTimetable, handleAdminRecurringTimetable,
  handleAdminListPrograms, handleAdminCreateProgram, handleAdminDeleteProgram,
  handleAdminUpdateProgram, handleAdminReactivateProgram,
  handleAdminListEmployees, handleAdminCreateEmployee, handleAdminDeactivateEmployee,
  handleAdminUpdateEmployee, handleAdminReactivateEmployee,
  handleGetScheduleHistory,
  handleAdminQuarterlySummary, handleAdminMonthlySessions,
} from './api.js';

// CORS: allow only your GitHub Pages origin
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': new URL(env.FRONTEND_URL).origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigin = new URL(env.FRONTEND_URL).origin;

    // Handle preflight
    if (request.method === 'OPTIONS') {
      if (origin !== allowedOrigin) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (request.method !== 'GET') {
      if (origin !== allowedOrigin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
        return new Response(JSON.stringify({ error: 'Expected application/json' }), {
          status: 415,
          headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
        });
      }
    }

    // -------- Public auth routes --------
    if (url.pathname === '/auth/google') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/auth/google/callback') {
      return handleCallback(request, env);
    }
    if (url.pathname === '/auth/logout') {
      return handleLogout(env);
    }

    // -------- Protected routes --------
    const cookies = parseCookies(request.headers.get('Cookie'));
    const session = await readSession(cookies.session, env.SESSION_SECRET);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
      });
    }

    try {
      const currentSession = { ...session };
      const employee = await getEmployeeAuth(env.DB, session.employeeId);

      if (!employee || !employee.is_active) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: {
            ...corsHeaders(env),
            'Content-Type': 'application/json',
            'Set-Cookie': buildSetCookie('session', '', { maxAge: 0, sameSite: 'None' }),
          },
        });
      }

      currentSession.email = employee.email;
      currentSession.isAdmin = employee.is_admin === 1;

      if (request.method !== 'GET' && !currentSession.isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
        });
      }

      let response;

      /**
       * @api {get} /api/me Get current user
       * @apiName GetCurrentUser
       * @apiGroup Users
       * @apiHeader {String} Cookie Encrypted session cookie.
       * @apiSuccess {String} email Signed-in employee email.
       * @apiSuccess {Number} employeeId Employee identifier.
       * @apiSuccess {Boolean} isAdmin Whether the employee is an administrator.
       * @apiSuccess {String} [picture] Google profile picture URL.
       * @apiError 401 Unauthorized or inactive employee.
       */
      // ---- User endpoints (self only) ----
      if (url.pathname === '/api/me' && request.method === 'GET') {
        response = Response.json({
          email: currentSession.email,
          employeeId: currentSession.employeeId,
          isAdmin: currentSession.isAdmin,
          picture: employee?.picture_url ?? null,
        });
      }
      else if (url.pathname === '/api/me/tasks' && request.method === 'GET') {
        response = await handleGetMyTasks(env, currentSession);
      }
      else if (url.pathname.match(/^\/api\/tasks\/\d+$/) && request.method === 'GET') {
        const taskId = parseInt(url.pathname.split('/').pop(), 10);
        response = await handleGetTask(env, currentSession, taskId);
      }
      else if (url.pathname === '/api/progress' && request.method === 'POST') {
        const body = await request.json();
        response = await handleUpdateProgress(env, currentSession, body);
      }

      // ---- Admin endpoints ----
      else if (url.pathname === '/api/admin/tasks' && request.method === 'GET') {
        response = await handleAdminGetAllTasks(env, currentSession, url);
      }
      else if (url.pathname.match(/^\/api\/admin\/tasks\/\d+$/) && request.method === 'GET') {
        const taskId = parseInt(url.pathname.split('/').pop(), 10);
        response = await handleAdminGetTask(env, currentSession, taskId);
      }
      else if (url.pathname === '/api/admin/progress' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminUpdateProgress(env, currentSession, body);
      }

      // ---- Task types (programs) endpoints ----
      else if (url.pathname === '/api/admin/programs' && request.method === 'GET') {
        response = await handleAdminListPrograms(env, currentSession);
      }
      else if (url.pathname === '/api/admin/programs' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminCreateProgram(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/programs/update' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminUpdateProgram(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/programs/delete' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminDeleteProgram(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/programs/reactivate' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminReactivateProgram(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/employees' && request.method === 'GET') {
        response = await handleAdminListEmployees(env, currentSession);
      }
      else if (url.pathname === '/api/admin/employees' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminCreateEmployee(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/employees/update' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminUpdateEmployee(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/employees/deactivate' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminDeactivateEmployee(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/employees/reactivate' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminReactivateEmployee(env, currentSession, body);
      }

      // ---- Schedule endpoints ----
      else if (url.pathname === '/api/schedule/history' && request.method === 'GET') {
        response = await handleGetScheduleHistory(env, url);
      }
      else if (url.pathname === '/api/schedule/monthly' && request.method === 'GET') {
        response = await handleAdminMonthlySummary(env, currentSession, url);
      }
      else if (url.pathname === '/api/schedule' && request.method === 'GET') {
        response = await handleGetMySchedule(env, currentSession, url);
      }
      else if (url.pathname === '/api/admin/schedule' && request.method === 'GET') {
        response = await handleAdminGetSchedule(env, currentSession, url);
      }
      else if (url.pathname === '/api/admin/schedule/assign' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminAssignSession(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/update' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminUpdateSession(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/clone' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminCloneSession(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/copy-week' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminCopyScheduleWeek(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/weekly-timetable' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminSetWeeklyTimetable(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/timetable' && request.method === 'GET') {
        response = await handleAdminGetTimetable(env, currentSession);
      }
      else if (url.pathname === '/api/admin/schedule/timetable' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminRecurringTimetable(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/reassign' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminReassignSession(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/status' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminSessionStatus(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/delete' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminDeleteSession(env, currentSession, body);
      }
      else if (url.pathname === '/api/admin/schedule/monthly' && request.method === 'GET') {
        response = await handleAdminMonthlySummary(env, currentSession, url);
      }
      else if (url.pathname === '/api/admin/schedule/quarterly' && request.method === 'GET') {
        response = await handleAdminQuarterlySummary(env, currentSession, url);
      }
      else if (url.pathname === '/api/admin/schedule/monthly/sessions' && request.method === 'GET') {
        response = await handleAdminMonthlySessions(env, currentSession, url);
      }
      else if (url.pathname === '/api/admin/schedule/target' && request.method === 'POST') {
        const body = await request.json();
        response = await handleAdminSetTarget(env, currentSession, body);
      }

      else {
        response = new Response('Not found', { status: 404 });
      }

      const headers = new Headers(response.headers);
      Object.entries(corsHeaders(env)).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, { status: response.status, headers });

    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
      });
    }
  },
};