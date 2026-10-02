import { handleLogin, handleCallback, handleLogout } from './auth.js';
import { readSession, parseCookies } from './session.js';
import { handleGetMyTasks, handleGetTask, handleUpdateProgress } from './api.js';

// CORS: allow only your GitHub Pages origin
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.FRONTEND_URL,
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
      return handleLogout();
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
      let response;

      if (url.pathname === '/api/me/tasks' && request.method === 'GET') {
        response = await handleGetMyTasks(env, session);
      }
      else if (url.pathname.match(/^\/api\/tasks\/\d+$/) && request.method === 'GET') {
        const taskId = parseInt(url.pathname.split('/').pop(), 10);
        response = await handleGetTask(env, session, taskId);
      }
      else if (url.pathname === '/api/progress' && request.method === 'POST') {
        const body = await request.json();
        response = await handleUpdateProgress(env, session, body);
      }
      else if (url.pathname === '/api/me') {
        response = Response.json({ email: session.email, employeeId: session.employeeId });
      }
      else {
        response = new Response('Not found', { status: 404 });
      }

      // Attach CORS headers to every response
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