/**
 * Ensures API routes never return HTML on errors.
 * Send JSON only for any /api/* request that hits an error or unhandled rejection.
 */
function apiErrorHandler(err, req, res, next) {
  if (req.path.startsWith('/api/')) {
    console.error('[API Error]', req.method, req.path, err?.message || err);
    const status = err.status ?? err.statusCode ?? 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
    return;
  }
  next(err);
}

module.exports = { apiErrorHandler };
