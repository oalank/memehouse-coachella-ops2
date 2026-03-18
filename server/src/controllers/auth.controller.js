const authService = require('../services/auth.service');

/**
 * POST /api/auth/login
 * Body: { email, password }
 * On success: set session, return { user: { id, email, role, operator_id } }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await authService.authenticate(String(email).trim(), password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.user = { id: user.id, email: user.email, role: user.role, operator_id: user.operator_id ?? null };
    req.session.save((err) => {
      if (err) {
        console.error('[POST /api/auth/login] session save:', err.message);
        return res.status(500).json({ error: 'Session error' });
      }
      res.status(200).json({ user: req.session.user });
    });
  } catch (err) {
    console.error('[POST /api/auth/login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /api/auth/logout
 * Destroy session.
 */
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      console.error('[POST /api/auth/logout]', err.message);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.setHeader('Set-Cookie', 'connect.sid=; Path=/; HttpOnly; Max-Age=0');
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
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await authService.findById(req.session.user.id);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Session invalid' });
    }
    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        operator_id: user.operator_id ?? null,
      },
    });
  } catch (err) {
    console.error('[GET /api/auth/me]', err.message);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

module.exports = { login, logout, me };
