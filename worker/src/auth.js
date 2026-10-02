import {
  createSession, readSession, parseCookies, buildSetCookie,
} from './session.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function randomString(bytes = 32) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(input) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Step 1: Redirect to Google
export async function handleLogin(request, env) {
  const url = new URL(request.url);
  const state = randomString();
  const codeVerifier = randomString(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const redirectUri = `${url.origin}/auth/google/callback`;

  // Store state + verifier in short-lived encrypted cookie
  const oauthCookie = await createSession(
    { state, codeVerifier },
    env.SESSION_SECRET
  );

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authUrl.toString(),
      'Set-Cookie': buildSetCookie('oauth_state', oauthCookie, { maxAge: 600, sameSite: 'None' }),
    },
  });
}

// Step 2: Handle callback from Google
export async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (!code || !returnedState) {
    return new Response('Missing code or state', { status: 400 });
  }

  const cookies = parseCookies(request.headers.get('Cookie'));
  const stateCookie = await readSession(cookies.oauth_state, env.SESSION_SECRET);

  if (!stateCookie || stateCookie.state !== returnedState) {
    return new Response('Invalid state (CSRF protection)', { status: 403 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: stateCookie.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    return new Response('Token exchange failed: ' + await tokenRes.text(), { status: 400 });
  }

  const tokens = await tokenRes.json();

  // Fetch user info
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = await userRes.json();
  const email = user.email;
  const sub = user.sub; // stable Google ID

  if (!email) {
    return new Response('No email returned from Google', { status: 400 });
  }

  // Look up employee in D1 by email (or cf_sub for stability)
  let employee = await env.DB.prepare(
    `SELECT employee_id, is_active FROM employees WHERE cf_sub = ? OR email = ? LIMIT 1`
  ).bind(sub, email).first();

  if (!employee || !employee.is_active) {
    return new Response('Access denied: not in employee directory', { status: 403 });
  }

  // Backfill cf_sub if missing (first login)
  if (!employee.cf_sub) {
    await env.DB.prepare(
      `UPDATE employees SET cf_sub = ? WHERE employee_id = ?`
    ).bind(sub, employee.employee_id).run();
  }

  // Create session cookie
  const session = await createSession(
    { employeeId: employee.employee_id, email },
    env.SESSION_SECRET
  );

  // Redirect back to frontend
  return new Response(null, {
    status: 302,
    headers: {
      'Location': env.FRONTEND_URL + '/dashboard.html',
      'Set-Cookie': buildSetCookie('session', session, { maxAge: 604800, sameSite: 'None'}),
    },
  });
}

// Step 3: Logout
export function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': buildSetCookie('session', '', { maxAge: 0 }),
    },
  });
}