# Personal Finance Management System (PFMS)

A full-stack personal finance tracker with AI-powered invoice scanning, built with Express + PostgreSQL (backend) and React + Vite + Tailwind (frontend).

## Features

- **Transaction Tracking** — Manual entry with categories, tags, accounts, merchants
- **AI Invoice Scanning** — Upload photos/scans of invoices; Z.ai GLM-5V-Turbo or Anthropic Claude Vision extracts financial data
- **Bank Statement Import** — CSV and QIF file import with auto-column detection and duplicate detection
- **Recurring Transactions** — Auto-detect subscription patterns, upcoming bills widget
- **Analytics Dashboard** — Income vs expense trends, category breakdowns, top merchants, budget tracking
- **Reports** — Monthly, annual, and custom date range reports
- **Budget Management** — Monthly budgets per category with progress tracking and alerts
- **Savings Goals** — Track savings targets with progress bars
- **Multi-Account Support** — Checking, savings, credit cards, cash, investment accounts
- **Light/Dark Theme** — Toggle between themes
- **Mobile Responsive** — Drawer sidebar, responsive grids

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 |
| AI Engine | Z.ai GLM-5V-Turbo (or Anthropic Claude Vision) |
| Image Processing | Sharp |
| Frontend | React 18, Vite, Tailwind CSS |
| Charts | Recharts |

## Quick Start

### Option A: Docker (recommended)

```bash
# 1. Clone
git clone https://github.com/vincentspereira/RNR-Personal-Finance-Management-System.git
cd RNR-Personal-Finance-Management-System

# 2. Set up environment
cp .env.example .env
# Edit .env with your ZAI_API_KEY or ANTHROPIC_API_KEY

# 3. Build and run
docker compose up --build
```

Open **http://localhost** — backend runs on port 5000, frontend on port 80.

### Option B: Local development (no Docker)

```bash
# Prerequisites: Node.js 20+, PostgreSQL 16+

# 1. Clone and install
git clone https://github.com/vincentspereira/RNR-Personal-Finance-Management-System.git
cd RNR-Personal-Finance-Management-System

# 2. Set up database
psql -U postgres -c "CREATE USER pfms WITH PASSWORD 'pfms_password';"
psql -U postgres -c "CREATE DATABASE pfms OWNER pfms;"

# 3. Configure backend
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL, ZAI_API_KEY
npm install
npm run dev    # starts on port 5000

# 4. Configure frontend (new terminal)
cd frontend
npm install
npm run dev    # starts on port 5173
```

Open **http://localhost:5173**

### Option C: One-click scripts

```bash
# Linux / macOS / WSL2
./start.sh

# Windows (PowerShell)
.\start.ps1

# Windows (cmd)
start.bat
```

This sets up the database, builds the backend, and starts both servers.

## Deployment Options

### Render (free tier available)

1. Fork/connect this repo to [render.com](https://render.com)
2. Create a **PostgreSQL** database (Free plan: 90 days)
3. Create a **Web Service** for the backend:
   - Root Directory: `backend`
   - Build: `npm ci && npm run build`
   - Start: `node dist/server.js`
   - Set env vars: `DATABASE_URL`, `ZAI_API_KEY`, `JWT_SECRET`, `CORS_ORIGIN`
4. Create a **Static Site** for the frontend:
   - Root Directory: `frontend`
   - Build: `npm ci && npm run build`
   - Publish: `dist`
   - Add rewrite rule: `/* → /index.html`

See `render.yaml` for one-click Blueprint deployment.

### Fly.io (free tier: 3 shared-cpu-1x VMs)

```bash
fly launch
fly secrets set ZAI_API_KEY=your_key JWT_SECRET=random_string DATABASE_URL=your_db_url
fly deploy
```

See `fly.toml` for configuration.

### Railway (free trial $5 credit)

1. Connect GitHub repo
2. Add PostgreSQL plugin
3. Deploy backend and frontend separately
4. Set environment variables via dashboard

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/profile` | Get profile |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List with filters (date, category, type, account, tags, search, minAmount, maxAmount, merchant) |
| GET | `/api/transactions/:id` | Single transaction |
| POST | `/api/transactions` | Create |
| PUT | `/api/transactions/:id` | Update |
| DELETE | `/api/transactions/:id` | Delete |
| POST | `/api/transactions/bulk` | Bulk create |
| GET | `/api/transactions/export` | Export CSV/JSON |
| POST | `/api/transactions/import/preview` | Upload CSV/QIF for preview |
| POST | `/api/transactions/import/confirm` | Confirm import |

### Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| PUT | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Archive account |
| GET | `/api/accounts/:id/balance` | Get account balance |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category (with optional reassignment) |

### Scans (AI Receipt Scanning)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scans/upload` | Upload receipt images |
| GET | `/api/scans/:id/status` | Check processing status |
| GET | `/api/scans/:id/results` | Get extraction results |
| POST | `/api/scans/:id/confirm` | Confirm and create transactions from extracted data |
| POST | `/api/scans/:id/retry` | Retry a failed scan |
| GET | `/api/scans` | List scan history |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | Income/expense summary with period comparison |
| GET | `/api/analytics/by-category` | Spending breakdown by category |
| GET | `/api/analytics/trends` | Monthly income vs expense trends |
| GET | `/api/analytics/top-merchants` | Top merchants by spending |
| GET | `/api/analytics/cashflow` | Daily cashflow data |
| GET | `/api/analytics/budget-vs-actual` | Budget vs actual spending |
| GET | `/api/analytics/recurring` | Detected recurring transaction patterns |
| GET | `/api/analytics/net-worth` | Net worth calculation |
| GET | `/api/analytics/budget-alerts` | Budget threshold alerts |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/monthly` | Monthly financial report |
| GET | `/api/reports/annual` | Annual financial report |
| POST | `/api/reports/custom` | Custom date range report |
| GET | `/api/reports/net-worth` | Net worth over time |

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | List budgets with actual spending |
| POST | `/api/budgets` | Create budget |
| PUT | `/api/budgets/:id` | Update budget |
| DELETE | `/api/budgets/:id` | Delete budget |

### Recurring Patterns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recurring` | List detected recurring patterns |
| GET | `/api/recurring/upcoming` | Upcoming bills (next N days) |
| POST | `/api/recurring/refresh` | Re-detect patterns from transactions |
| PUT | `/api/recurring/:id/toggle` | Enable/disable a pattern |

### Savings Goals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/savings-goals` | List goals |
| POST | `/api/savings-goals` | Create goal |
| PUT | `/api/savings-goals/:id` | Update goal (add contributions) |
| DELETE | `/api/savings-goals/:id` | Delete goal |

## Running Tests

```bash
# Backend
cd backend
npm test                  # All tests with coverage (85% threshold)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e          # End-to-end tests only

# Frontend
cd frontend
npm test                  # Run tests with coverage
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 5000 | Backend server port |
| `NODE_ENV` | development | Environment |
| `DATABASE_URL` | postgresql://pfms:pfms_password@localhost:5433/pfms | PostgreSQL connection |
| `ZAI_API_KEY` | — | Z.ai Vision API key (for invoice scanning) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (alternative vision provider) |
| `VISION_PROVIDER` | zai | Vision provider: `zai` or `anthropic` |
| `UPLOAD_DIR` | ./uploads | File upload directory |
| `MAX_FILE_SIZE_MB` | 20 | Max upload file size |
| `CORS_ORIGIN` | http://localhost:5173 | Allowed CORS origin |
| `JWT_SECRET` | — | JWT signing secret (change in production) |
| `JWT_EXPIRES_IN` | 7d | Token expiry |

## Project Structure

```
RNR-Personal-Finance-Management-System/
├── backend/
│   ├── src/
│   │   ├── routes/          # Express routes
│   │   ├── controllers/     # Request/response logic
│   │   ├── services/        # Business logic, DB queries, AI
│   │   ├── models/          # Migrations, seeds
│   │   ├── middleware/      # Auth, error handling, rate limiting
│   │   ├── config.ts
│   │   ├── db.ts
│   │   └── server.ts
│   ├── migrations/          # Numbered SQL migrations (001_init.sql ...)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Transactions, Scan, Analytics, Reports, Budgets, Settings
│   │   ├── components/      # Charts, Tables, Cards, Modals, Sidebar
│   │   ├── hooks/           # useAuth, useTheme
│   │   ├── api/             # API client
│   │   └── main.jsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── render.yaml
├── fly.toml
├── start.sh / start.bat / start.ps1
└── README.md
```
