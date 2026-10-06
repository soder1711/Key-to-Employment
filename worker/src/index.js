import { handleLogin, handleCallback, handleLogout } from './auth.js';
import { readSession, parseCookies, buildSetCookie } from './session.js';
import { getEmployeeAuth } from './db.js';
import {
  handleGetMyTasks,
  handleGetTask,
  handleUpdateProgress,
  handleAdminGetAllTasks,
  handleAdminGetTask,
  handleAdminUpdateProgress,
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

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
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
      // Normal task routes use the authenticated, encrypted cookie directly.
      // Re-check D1 only where current directory authorization is needed.
      const isAdminRoute = url.pathname.startsWith('/api/admin/');
      const isMeRoute = url.pathname === '/api/me' && request.method === 'GET';
      const currentSession = { ...session };

      if (isAdminRoute || isMeRoute) {
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
      }

      let response;

      // ---- User endpoints (self only) ----
      if (url.pathname === '/api/me' && request.method === 'GET') {
        response = Response.json({
          email: currentSession.email,
          employeeId: currentSession.employeeId,
          isAdmin: currentSession.isAdmin,
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