/**
 * Require authenticated session. Use on routes that need auth.
 * If not authenticated, responds with 401 JSON.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

module.exports = { requireAuth };
