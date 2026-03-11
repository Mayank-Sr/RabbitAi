require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const analyzeRouter = require('./routes/analyze');
const healthRouter = require('./routes/health');
const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const { apiKeyAuth } = require('./middleware/apiKeyAuth');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security Middleware ─────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Trim spaces and trailing slashes from each allowed origin
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim().replace(/\/$/, ''));

console.log('[CORS] Allowed origins:', allowedOrigins);

// Handle preflight OPTIONS for all routes first
app.options('*', cors());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Swagger, Postman)
    if (!origin) return callback(null, true);

    // Normalise incoming origin - remove trailing slash
    const normOrigin = origin.replace(/\/$/, '');

    if (allowedOrigins.includes(normOrigin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.error(`[CORS BLOCKED] Origin: "${origin}" | Allowed: [${allowedOrigins.join(', ')}]`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  credentials: true,
}));

// ── Global Rate Limiter ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Upload rate limit exceeded. Max 10 uploads per minute.' },
});

app.use(globalLimiter);
app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));

// ── Swagger Docs ────────────────────────────────────────────────────
const swaggerDoc = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
  customCss: '.swagger-ui .topbar { background: #0f172a; }',
  customSiteTitle: 'Sales Insight Automator API',
}));

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/analyze', uploadLimiter, apiKeyAuth, analyzeRouter);

// ── Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});

module.exports = app;
