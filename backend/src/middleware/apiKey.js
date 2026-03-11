const logger = require('../utils/logger');

/**
 * API Key authentication middleware.
 *
 * Checks for a valid API key in the X-API-Key header.
 * In development mode (NODE_ENV=development), auth is bypassed.
 *
 * Security notes:
 * - Key is compared using a constant-time check (crypto.timingSafeEqual)
 *   to prevent timing attacks.
 * - Key should be ≥32 random characters generated via `openssl rand -hex 32`.
 */
const crypto = require('crypto');

module.exports = function apiKeyMiddleware(req, res, next) {
  const apiKey = process.env.API_SECRET_KEY;

  // Skip auth in development if no key is configured
  if (process.env.NODE_ENV === 'development' && !apiKey) {
    logger.warn('API key auth bypassed — development mode, no key set');
    return next();
  }

  if (!apiKey) {
    logger.error('API_SECRET_KEY not configured in environment');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const provided = req.headers['x-api-key'];

  if (!provided) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  // Constant-time comparison to prevent timing attacks
  try {
    const a = Buffer.from(apiKey);
    const b = Buffer.from(provided);
    const valid =
      a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!valid) {
      logger.warn('Invalid API key attempt', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid API key' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};
