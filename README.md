# 📊 Sales Insight Automator — Rabbitt AI

> Upload a CSV/Excel sales file → AI generates an executive summary → Email delivered in seconds.

[![CI](https://github.com/your-org/sales-insight-automator/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/sales-insight-automator/actions)

---

## 🔗 Live URLs

| Service | URL |
|---------|-----|
| **Frontend** | `https://sales-insight-automator.vercel.app` |
| **Backend API** | `https://sales-insight-api.onrender.com` |
| **Swagger Docs** | `https://sales-insight-api.onrender.com/api-docs` |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React SPA on Vercel)                          │
│  • Drag-and-drop CSV/XLSX upload                        │
│  • Real-time loading states (4-step progress)           │
│  • Error / success feedback                             │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS POST /api/upload
                     │ X-API-Key header
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Node.js / Express API (on Render)                      │
│                                                         │
│  1. API Key middleware (timing-safe comparison)         │
│  2. Rate limiting (global + per-endpoint)               │
│  3. Helmet security headers                             │
│  4. Multer file validation (type + size)                │
│  5. express-validator (email sanitisation)              │
│                                                         │
│  ┌─────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │ File Parser │→ │  Gemini AI     │→ │ Email (SMTP)│  │
│  │ CSV / XLSX  │  │  1.5 Flash     │  │  Nodemailer │  │
│  └─────────────┘  └────────────────┘  └─────────────┘  │
│                                                         │
│  • Swagger / OpenAPI 3.0 at /api-docs                  │
│  • Winston structured logging                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start — Docker Compose

### Prerequisites
- Docker & Docker Compose v2+
- A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))
- SMTP credentials (Gmail App Password recommended)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/your-org/sales-insight-automator.git
cd sales-insight-automator

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in all required values

# 3. Launch the full stack
docker compose up --build

# Frontend: http://localhost
# Backend:  http://localhost:3001
# Swagger:  http://localhost:3001/api-docs
```

### Tear down
```bash
docker compose down
```

---

## 🛠️ Local Development (without Docker)

### Backend
```bash
cd backend
cp .env.example .env   # Fill in values
npm install
npm run dev            # Hot-reload via nodemon
# → http://localhost:3001
```

### Frontend
```bash
cd frontend
cp .env.example .env   # Fill in values
npm install
npm run dev
# → http://localhost:5173  (proxies /api/* to localhost:3001)
```

---

## 🔐 Security Implementation

### 1. API Key Authentication
All `/api/*` endpoints require an `X-API-Key` header. The key is validated using **`crypto.timingSafeEqual`** (Node.js built-in) to prevent [timing attacks](https://codahale.com/a-lesson-in-timing-attacks/).

```
X-API-Key: your-32-char-secret-key
```

Key generation: `openssl rand -hex 32`

### 2. Rate Limiting (`express-rate-limit`)
| Scope | Limit |
|-------|-------|
| Global (all routes) | 100 req / 15 min per IP |
| `/api/upload` | 5 req / min per IP |

### 3. HTTP Security Headers (`helmet`)
Helmet sets these headers on every response:
- `Content-Security-Policy` — restricts script, style, and font sources
- `X-Frame-Options: SAMEORIGIN` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — blocks MIME sniffing
- `Strict-Transport-Security` — enforces HTTPS in production
- `X-XSS-Protection` — legacy XSS filter

### 4. Input Validation & Sanitisation
- **File validation**: MIME type + extension allow-list, 5MB hard limit, `multer` memory storage (files never written to disk)
- **Email validation**: `express-validator` `isEmail()` + `normalizeEmail()`
- **Body sanitisation**: `trim()` + `escape()` on free-text fields

### 5. CORS
Configured with an explicit `allowedOrigins` list (from `ALLOWED_ORIGINS` env var). Wildcard `*` is never used.

### 6. No Secret Leakage
- `.env` is in `.gitignore`
- Gemini/SMTP credentials never exposed in API responses or logs
- Request IDs (UUID v4) used for log correlation instead of user data

---

## 📋 Environment Variables Reference

### Root `.env` (for docker-compose)

| Variable | Required | Description |
|----------|----------|-------------|
| `API_SECRET_KEY` | ✅ | Shared API key (≥32 chars). Generate: `openssl rand -hex 32` |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `SMTP_HOST` | ✅ | SMTP server hostname |
| `SMTP_PORT` | ✅ | SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_USER` | ✅ | SMTP login username (usually your email) |
| `SMTP_PASS` | ✅ | SMTP password / App Password |

### Backend (`backend/.env`)
Inherits all of the above, plus:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `info` | Winston log level |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated CORS origins |
| `API_BASE_URL` | `http://localhost:3001` | Shown in Swagger server list |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_API_KEY` | API key sent in `X-API-Key` header |

---

## 📁 Project Structure

```
sales-insight-automator/
├── backend/
│   ├── src/
│   │   ├── index.js               # Express app, middleware stack
│   │   ├── routes/
│   │   │   ├── upload.js          # POST /api/upload (main endpoint)
│   │   │   └── health.js          # GET /health
│   │   ├── middleware/
│   │   │   └── apiKey.js          # Timing-safe API key auth
│   │   ├── services/
│   │   │   ├── fileParser.js      # CSV + XLSX parsing & stats
│   │   │   ├── geminiService.js   # Gemini AI summary generation
│   │   │   └── emailService.js    # Nodemailer HTML email delivery
│   │   └── utils/
│   │       ├── swagger.js         # OpenAPI 3.0 spec config
│   │       └── logger.js          # Winston structured logger
│   ├── Dockerfile                 # Multi-stage, non-root user
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # React entry
│   │   ├── App.jsx                # SPA: upload form, states
│   │   └── index.css              # Design system + animations
│   ├── index.html
│   ├── vite.config.js
│   ├── nginx.conf                 # SPA routing + proxy
│   ├── Dockerfile                 # Multi-stage: Vite build + nginx
│   └── .env.example
│
├── github-workflows/
│   └── ci.yml                     # PR → lint + build + Docker validate
│
├── docker-compose.yml
├── .env.example
├── sales_q1_2026.csv              # Reference test data
└── README.md
```

> **Note**: The CI workflow file should be placed at `.github/workflows/ci.yml` in your repo.

---

## 🔄 CI/CD Pipeline

The GitHub Action (`.github/workflows/ci.yml`) triggers on every **Pull Request to `main`** and on pushes to `main`.

**Jobs:**
1. **`backend-ci`** — `npm ci` → `eslint` → `jest` → Docker image build
2. **`frontend-ci`** — `npm ci` → `eslint` → `vite build` → Docker image build
3. **`compose-validate`** — `docker compose config` syntax lint

**Deployment** (manual or extend CI):
- **Frontend → Vercel**: Connect GitHub repo, set `VITE_API_URL` + `VITE_API_KEY` as env vars, set root to `frontend/`
- **Backend → Render**: Web Service from `backend/`, set all env vars in Render dashboard

---

## 🧪 Testing the API via Swagger

1. Navigate to `/api-docs`
2. Click **Authorize** → enter your `API_SECRET_KEY`
3. Expand `POST /api/upload`
4. Click **Try it out** → upload `sales_q1_2026.csv`, enter an email
5. Execute and inspect the response

---

## 📧 Gmail SMTP Setup (Quick Guide)

1. Enable **2-Step Verification** on your Google account
2. Go to `myaccount.google.com/apppasswords`
3. Create an App Password for "Mail"
4. Use that 16-character password as `SMTP_PASS`

---

*Built by the Rabbitt AI Engineering team · Sprint delivery · 2026*
