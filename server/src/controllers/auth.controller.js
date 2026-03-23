const authService = require('../services/auth.service');

// Must match session name in server index.js (memehouse.sid)
const SESSION_COOKIE_NAME = 'memehouse.sid';

/**
 * POST /api/auth/login
 * Body: { email, password }
 * On success: set session, return { user: { id, email, role, operator_id } }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    console.log('[auth] POST /api/auth/login request', email ? `${email.slice(0, 3)}***` : 'no email');
    if (!email || !password) {
      console.log('[auth] login failed: email and password required');
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await authService.authenticate(String(email).trim(), password);
    if (!user) {
      console.log('[auth] login failed: invalid credentials');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.user = { id: user.id, email: user.email, role: user.role, operator_id: user.operator_id ?? null };
    req.session.save((err) => {
      if (err) {
        console.error('[auth] login session save:', err.message);
        return res.status(500).json({ error: 'Session error' });
      }
      console.log('[auth] login success:', user.email, 'role=', user.role);
      res.status(200).json({ user: req.session.user });
    });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /api/auth/logout
 * Destroy session and clear session cookie (name must match server session config).
 */
function logout(req, res) {
  console.log('[auth] POST /api/auth/logout');
  req.session.destroy((err) => {
    if (err) {
      console.error('[auth] logout error:', err.message);
      return res.status(500).json({ error: 'Logout failed' });
    }
    const clearCookie = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax` +
      (process.env.NODE_ENV === 'production' ? '; Secure' : '');
    res.setHeader('Set-Cookie', clearCookie);
    console.log('[auth] logout success');
    res.status(200).json({ ok: true });
  });
}

/**
 * GET /api/auth/me
 * Return current user from session, or 401.
 */
async function me(req, res) {
  try {
    if (!req.session || !req.session.user) {
      console.log('[auth] GET /api/auth/me: not authenticated');
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await authService.findById(req.session.user.id);
    if (!user) {
      req.session.destroy(() => {});
      console.log('[auth] GET /api/auth/me: session invalid (user not found)');
      return res.status(401).json({ error: 'Session invalid' });
    }
    console.log('[auth] GET /api/auth/me: ok', user.email);
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        operator_id: user.operator_id ?? null,
      },
    });
  } catch (err) {
    console.error('[auth] me error:', err.message);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

module.exports = { login, logout, me };
