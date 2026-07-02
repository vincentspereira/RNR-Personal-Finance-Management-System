# Personal Finance Management System — Comprehensive Improvement Plan

**Author:** Vincent S. Pereira
**Date:** 2026-05-17
**Scope:** Full-stack audit of the PFMS codebase (backend, frontend, database, ops, security, testing, features)
**Status:** Living document

---

## 1. Executive Summary

PFMS is a well-structured full-stack personal finance app with a Node/Express + TypeScript backend, PostgreSQL persistence, and a React 18 + Vite + Tailwind frontend. It already delivers transactions, multi-account support, AI invoice scanning (Z.ai / Anthropic Vision), CSV/QIF import, analytics, reports, budgets, recurring detection, savings goals, multi-currency, and notifications.

The system is fundamentally sound, but contains a meaningful number of **correctness bugs, security gaps, scalability cliffs, and missing-product polish** that should be addressed before this can be considered production-grade.

The findings below are grouped by domain and prioritised:

- **P0 (Critical — fix before any non-toy deployment):** 8 items
- **P1 (High — fix in the next 1–2 sprints):** 14 items
- **P2 (Medium — quality / scale work):** 13 items
- **P3 (Low / nice-to-have features):** 10 items

The phased roadmap in Section 12 sequences these into 4 deliverable phases over ~8 weeks of focused effort.

---

## 2. What is working well (preserve)

Before listing problems, the things worth **keeping**:

- **Clean layered architecture**: `routes → controllers → services → db`. Each layer has a single responsibility; controllers don't talk to the DB; routes don't have logic. This is the project's biggest asset.
- **Multi-tenant by `user_id`**: every domain table has `user_id` and every service query is gated on it.
- **Idempotent migrations** using `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`. Safe to re-run.
- **Parameterised SQL everywhere I sampled** (`$1, $2 …`) — SQL injection surface is small.
- **Standardised response envelope** `{ success, data, error, meta }` across all endpoints; predictable client contract.
- **Strong test scaffolding** — Jest + ts-jest + supertest with unit / integration / e2e separation and an 85% coverage threshold for the backend.
- **Pluggable vision provider** (Z.ai or Anthropic) behind a small adapter — easy to extend.
- **CI workflow** that runs type-check, both test suites, and Docker builds on every push.
- **Two-mode duplicate detection** for imports (`import_hash`) and within-day deduping for notifications.

---

## 3. Critical Issues (P0 — must fix)

### P0-1. JWT secret falls back to a hard-coded dev string in production

**File:** `backend/src/config.ts:16`

```ts
jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
```

If `JWT_SECRET` is unset in production, **every token is forgeable** with the literal string above. The `.env.example` files even ship with weak defaults (`pfms-local-secret-change-me`, `change-this-to-a-random-secret`).

**Fix:**

- Throw on startup when `NODE_ENV === 'production'` and `JWT_SECRET` is missing or matches any known default.
- Require minimum 32 chars of entropy.
- Document `openssl rand -hex 64` in README.

### P0-2. Migrations + seeds run on every server boot

**File:** `backend/src/server.ts:94-95`

```ts
await runMigrations();
await runSeeds();
```

On every restart, every `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE` is re-issued. On managed Postgres this is fine for a single instance but:

- Two instances starting concurrently race on `ALTER TABLE` → deadlocks.
- Schema drift becomes invisible — there is no migration version table.
- Production rollouts cannot be tied to specific schema versions.

**Fix:**

- Introduce a real migrations table (`schema_migrations(version, applied_at)`).
- Move migrations to numbered files (`001_init.sql`, `002_add_user_id.sql`, …).
- Make the boot step a no-op in production; run migrations as a separate one-shot `npm run migrate` step in CI/CD.

### P0-3. Account ownership not enforced in transaction creation

**Files:** `backend/src/services/transactionService.ts:115`, `backend/src/utils/validators.ts:46`

`createTransaction` accepts an `account_id` and a `user_id` and inserts them, but never verifies the account belongs to that user. `validateAccountExists` looks up by `id` only — **no `user_id` predicate**. A user can pass another user's `account_id` and create a transaction against it (the row will still carry their own `user_id`, but it will appear in the *victim's* account when joined).

**Fix:**

- All `validate*Exists` helpers must accept and check `user_id`.
- Add a unit test that explicitly tries cross-tenant access and asserts 404.

### P0-4. Account balance computed across ALL users

**File:** `backend/src/services/accountService.ts:4-15`

```sql
LEFT JOIN transactions t ON t.account_id = a.id
```

There is no `t.user_id = $1` predicate. With multiple users sharing the same account id (currently impossible because `accounts.user_id` is enforced), this is benign. But if P0-3 is left open, account balances reflect transactions inserted by attackers.

**Fix:** Add `AND t.user_id = $1` to every aggregation join over `transactions` (also in `reportService.getNetWorth`, `analyticsService.*`).

### P0-5. Account balance math is wrong for transfers and currency

**File:** `backend/src/services/accountService.ts:4-15`

The balance formula treats only `income` and `expense`. The transactions schema has a third `type = 'transfer'` (line 80 of migrations) which is silently ignored. Multi-currency accounts also see raw sums regardless of currency.

**Fix:**

- Decide whether transfers are signed by `account_id` (i.e. need a paired counter-row), or modeled as two transactions (preferred). Update the schema and balance formula.
- Convert each transaction to the account's currency at insert time, or store `amount_in_account_currency` alongside.

### P0-6. SQL identifier injection in analytics filter

**File:** `backend/src/services/analyticsService.ts:46`

```ts
const typeFilter = type ? `AND t.type = '${type}'` : '';
```

`type` arrives from `req.query.type` straight through the controller. Even though Express decodes, this is **string-interpolated SQL**. Pass `type = "'; DROP TABLE transactions; --"` and you get a syntax error today, but any change in the wrapping query makes it exploitable. A defense-in-depth fix is cheap.

**Fix:** Use a parameterised value (`AND t.type = $N`), with `idx` tracking like every other service does.

### P0-7. SQL identifier injection in date-range CTE

**File:** `backend/src/services/analyticsService.ts:63-67`

```ts
generate_series(CURRENT_DATE - INTERVAL '${months - 1} months', …)
```

`months` is `parseInt`-ed but never bounds-checked. Passing `?months=-99999999` runs an absurd `generate_series`; passing a NaN (currently filtered) is fine, but bound it explicitly.

**Fix:** Clamp `months` to `[1, 60]` and use a parameter (Postgres allows `INTERVAL '1 month' * $N`).

### P0-8. Public `/uploads` static serving leaks user files

**File:** `backend/src/server.ts:62`

```ts
app.use('/uploads', express.static(config.uploadDir));
```

Every uploaded receipt is publicly reachable by URL. Filenames are 16-byte random hex which is hard to guess, but **the URL is included in scan metadata and logs**, and there's no auth check. Anyone with the URL can fetch any user's receipts.

**Fix:**

- Either store uploads in a private bucket (S3 + signed URLs) and remove static serving entirely;
- Or route `/uploads/:filename` through `authMiddleware` + an ACL check against `scans.original_path`.

---

## 4. High-priority Issues (P1)

### Security & Auth

- **P1-1. Bcrypt cost factor 12 + no rate limit on login per email.** `express-rate-limit` is global by IP. Add per-email throttling (e.g. 5/min) and account-lockout after N failed attempts (or use `express-brute` / a Redis counter).
- **P1-2. No password complexity / breach check.** Minimum is 6 chars. Push to 10–12 with a basic complexity rule, integrate `zxcvbn` for strength feedback, optionally Have-I-Been-Pwned k-anonymity check.
- **P1-3. Token stored in `localStorage`.** Vulnerable to any XSS. Move to `httpOnly` + `Secure` + `SameSite=strict` cookie, with CSRF token on mutating routes. (`frontend/src/api/index.js`, `useAuth.jsx`).
- **P1-4. No refresh tokens / no logout server-side.** Tokens are valid for 7 days with no revocation list. Add short-lived (15 min) access tokens + refresh tokens stored server-side (or use opaque sessions in Postgres/Redis).
- **P1-5. No CSRF protection** for cookie-based auth (becomes relevant once P1-3 lands).
- **P1-6. CORS `credentials: true` + permissive origin.** Once cookies are used, audit `corsOrigin` to a strict allowlist; today it accepts a single env-configured string.
- **P1-7. No magic-byte file validation on upload.** `multer.fileFilter` checks only the client-supplied `mimetype`. A PHP script renamed `.jpg` passes. Use `file-type` to sniff the actual bytes after upload.
- **P1-8. AI scan endpoint has no rate limit beyond the global `apiLimiter`.** Vision calls cost real money; one user can burn the budget by uploading 20 images × N times. Add a stricter limiter (`/api/scans/upload`: 30/hour) and a daily quota per user.

### Correctness

- **P1-9. CSV export in `transactionController` doesn't quote/escape correctly.** It only wraps in quotes if the value contains `,` — but values with `"` or `\n` aren't escaped, and `\r` line endings will break consumers. Use the same `escapeCSV` helper in `exportService.ts` everywhere.
- **P1-10. `mapRowToTransaction` is ambiguous on MM/DD vs DD/MM.** It always assumes MM/DD which silently corrupts European imports. Ask the user to pick a locale in the import preview, or detect by sampling rows.
- **P1-11. `recurringService.detectRecurringPatterns` re-iterates `result.rows` inside its loop to find `lastRow`** (O(n²) on transaction count). Use the cached `group` instead.
- **P1-12. `bulkCreateTransactions` returns only `created`, but the controller exposes a `count` to the user — silent dedup losses go unreported.** The service already collects `skipped` but throws it away.
- **P1-13. `getTrends` returns 12 months hard-coded even though the API accepts a query param** (it does — but a quick read shows `getTrends(userId, 12)` is called with the magic value 12 from the controller). Wire the param through.
- **P1-14. `start.ps1` is actually a bash script.** PowerShell users on Windows will hit syntax errors. Rename to `start.sh` and provide a real `start.ps1`.

---

## 5. Medium-priority Issues (P2)

### Database / Performance

- **P2-1. No composite index on `(user_id, transaction_date DESC)`.** Every list query orders by transaction_date and filters by user_id; today only single-column indexes exist. Add `idx_transactions_user_date(user_id, transaction_date DESC)` and consider a covering index for the common fields.
- **P2-2. No GIN index on `transactions.tags`** despite `tags && $N` queries. Add `CREATE INDEX idx_transactions_tags ON transactions USING GIN (tags)`.
- **P2-3. ILIKE search on description/merchant/notes is unindexed.** For datasets >50k transactions this scans the table. Add `pg_trgm` extension + trigram indexes, or a `tsvector` column with GIN.
- **P2-4. `connectionTimeoutMillis: 5000`, `max: 20`** is fine for one instance but should be configurable via env, with PgBouncer recommended for multi-instance.
- **P2-5. Money stored as `DECIMAL(15,2)`** which is correct, but services do `parseFloat(row.amount)`, losing precision. Use a `bigint` (cents) representation internally or a Decimal lib (`decimal.js`) on the JS side.
- **P2-6. `getRecurring()` SQL groups by `description, merchant_name` only — descriptions that differ in case or whitespace become separate groups** (the in-memory recurringService normalises this).

### Backend Code Quality

- **P2-7. `any` types and `as any` casts everywhere** (controllers cast `req.query.* as string`, services use `any[]` params, scan service treats AI responses as raw `any`). Introduce a typed query-validation layer (Zod / express-validator) and a typed DB row interface.
- **P2-8. No central request validation.** Each controller hand-rolls "if (!email || !password) throw 400". Move to Zod schemas or `express-validator` chains. The dependency `express-validator` is already in `package.json` but unused.
- **P2-9. Errors lose stack context in production.** `errorHandler` swallows 500s as "Internal server error" but doesn't log structured fields (user_id, route, request_id). Add `pino`/`winston` + request-id middleware and ship to a sink (Sentry/Logtail).
- **P2-10. `scanService.confirmDocuments` dynamically `await import('../db')`** — should be a normal top-of-file import; the dynamic form prevents tree-shaking and confuses tooling.
- **P2-11. `processScan` fires-and-forgets via `.catch(console.error)`.** Failed scans are visible only in logs. Wrap in a real job queue (BullMQ + Redis) so retries, backoff, and observability are managed.
- **P2-12. No request-id / correlation-id middleware.** Hard to trace a request across logs.
- **P2-13. Vision provider selection logic is split between `getVisionProvider()` and three callers** — extract to a single typed adapter interface.

### Frontend

- **P2-14. The default vision provider in `config.ts` is `'anthropic'` but the README says `zai`.** Make these consistent.
- **P2-15. Components are huge files** — `Transactions.jsx` is 520 lines, `Settings.jsx` 360 lines, `Scan.jsx` 302 lines. Split into smaller components and extract data-fetching into the existing hook pattern.
- **P2-16. No global state library; each page refetches everything on mount.** A page reload re-issues 10 parallel API calls (`Dashboard.useEffect` lines 33-44). Add React Query / TanStack Query (or SWR) with cache, dedupe, and refetch-on-focus.
- **P2-17. `useAuth` `useEffect` dependency array is empty but reads `token`** — won't re-validate if token changes mid-session. Pass `token` in deps or guard with a ref.
- **P2-18. `api.interceptors.response.use` triggers a hard `window.location.href = '/login'`** on 401, breaking React Router state. Surface the event to `useAuth.logout` instead.
- **P2-19. Hard-coded dark-theme classes** (`bg-navy-800`, `text-gray-400`) appear in many components even though `index.css` defines CSS variables for theme switching. Light theme is therefore broken in practice — components don't pick up the variables.
- **P2-20. No skeleton loaders.** Pages flash `LoadingSpinner` then full content; consider page-level skeletons for perceived performance.
- **P2-21. No accessibility audit.** Missing `aria-label`s on icon-only buttons (Sidebar toggle, mobile-menu button, modal close), no focus management when modals open, color-contrast not verified.

---

## 6. Low-priority / Nice-to-have (P3)

- **P3-1. No PWA manifest / offline mode.** A finance app benefits from working offline for quick transaction entry.
- **P3-2. No mobile app or React Native wrapper.** Out of scope, but the responsive web is the only mobile story today.
- **P3-3. No multi-language i18n.** All strings are hard-coded English.
- **P3-4. No 2FA / TOTP support.**
- **P3-5. No OAuth login** (Google, Apple). Lowers signup friction significantly.
- **P3-6. No Plaid / open-banking integration.** Statement import via CSV is the only ingestion path today. Plaid (US), TrueLayer (EU), Salt Edge (global) would supplant 80% of manual entry.
- **P3-7. No tax-time helpers** (year-end totals by category, Schedule C/itemized-deduction CSV).
- **P3-8. No bill-splitting or shared accounts** between users.
- **P3-9. No investment / portfolio tracking** despite `accounts.type = 'investment'` existing in the schema.
- **P3-10. No ML-driven category suggestions** based on the user's own history (a simple kNN on merchant_name → category would suffice).

---

## 7. Backend Architecture Notes

### Strengths to keep

- Clean controller/service split.
- All inter-service calls go through service exports (no controller→controller).
- Pagination helper centralises `LIMIT/OFFSET` math.

### Weaknesses

- **No DI / no service registry.** Every service `import { query } from '../db'` directly; impossible to swap for tests without `jest.mock` boilerplate. Consider a thin DI seam (factory functions taking `db` as a parameter) — would also remove the need for `__mocks__/db`.
- **`db.query` accepts `any[]` for params**, returning untyped rows. Generate types from Postgres (`pg-typed`, `zapatos`, or `kysely`) or at least define row interfaces per table.
- **No transaction boundary at the request level.** Most services use individual queries; only `bulkCreateTransactions` and `confirmDocuments` open a tx. Reports that span ≥3 reads (e.g. monthly report runs 5 queries, none in a tx) could see partial state across writes.

### Recommended changes

1. Adopt `kysely` (or `prisma`) for typed DB access. Backend test suite already mocks `db` cleanly so the migration cost is contained.
2. Introduce `zod` schemas for all request bodies + responses; share types with the frontend.
3. Introduce `pino` + `pino-http` for structured logs with request-id; ship to Sentry/Logtail in prod.

---

## 8. Frontend Architecture Notes

### Strengths

- Vite build, react-router, react-hot-toast, tailwind — modern, lean stack.
- Domain-aligned page split mirrors backend routes.
- API module exposes per-domain clients (`transactionsApi`, `accountsApi`…) — easy to consume.

### Weaknesses

- **No data-fetching library.** Every page hand-rolls `useState + useEffect + Promise.all`. Refetching, error retry, caching, optimistic updates, mutation invalidation — all absent. **This is the single highest-leverage fix on the frontend.**
- **No form library.** Settings/Transactions/Login each maintain controlled inputs by hand, with `e.target.value` everywhere. Adopt `react-hook-form` + `zod` resolvers; share schemas with backend.
- **No error boundary.** A render error in one chart blanks the whole app.
- **No code splitting beyond Vite's defaults.** All pages load up-front. Use `React.lazy()` per route.
- **`react-icons` is large** (~50KB gzipped imported as a whole). Tree-shake by importing from `react-icons/fa` (already done) but audit duplicate imports across files.
- **No e2e tests** (Cypress / Playwright). Existing `__tests__/pages/*.test.jsx` are component-level vitest tests.

### Recommended changes

1. Drop-in TanStack Query → wraps existing `*Api.list/...` calls; replace all `useEffect` data-fetches.
2. `react-hook-form` + shared zod schemas.
3. Per-route `React.lazy` + `Suspense` boundaries.
4. Add Playwright for 3–5 golden-path e2e tests (signup → add txn → see on dashboard).
5. Fix the theme: every `bg-navy-*` / `text-gray-*` literal should be replaced with a `bg-secondary` / `text-muted` token wired to the CSS variables.

---

## 9. Database & Migrations

### Schema observations

- `users` table is good; **but no `email_verified` flag and no `last_login_at`** (useful for security/UX).
- `transactions.tags` is `TEXT[]` — fine for low cardinality, but if tags become first-class (shared, colored), introduce a join table.
- `transactions.is_recurring` and `recurrence_pattern JSONB` duplicate state with the `recurring_patterns` table. Decide on a single source of truth.
- `categories.parent_id` exists but the seed data is flat and the UI only renders a flattened tree. Either remove or actually build hierarchical UX.
- `accounts.opening_balance` is set at creation and never adjusted — there's no audit trail for balance corrections.
- `scans.original_path` stores a filesystem path; on Render's free tier the disk is ephemeral. Move to object storage.

### Indexes (concrete recommendations)

```sql
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_user_type_date ON transactions(user_id, type, transaction_date DESC);
CREATE INDEX idx_transactions_tags ON transactions USING GIN (tags);
CREATE INDEX idx_transactions_user_merchant ON transactions(user_id, merchant_name) WHERE merchant_name IS NOT NULL;
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_transactions_description_trgm ON transactions USING GIN (description gin_trgm_ops);
```

### Migrations strategy

Move from in-code idempotent DDL to a managed migrator: `node-pg-migrate`, `umzug`, or `kysely-migrator`. Track schema version. Forbid in-place edits to applied migrations.

---

## 10. Deployment & Ops

### Issues

- **`render.yaml` runs migrations on container start** (because they're inlined in `server.ts`). With zero-downtime deploys this risks two instances racing.
- **`fly.toml` has `min_machines_running = 0`** which causes the cron-based scheduler to never run. Set to 1 for any production deploy.
- **Backend Dockerfile installs dev dependencies and never prunes** (`npm ci` without `--omit=dev`). Image size is larger than needed; remove dev deps in a multi-stage build.
- **No healthcheck in `docker-compose.yml`** for backend/frontend.
- **Uploads bind-mounted but ephemeral on Fly/Render free tier** — receipts will vanish on redeploy.
- **No backup story** for Postgres. Render's free DB expires after 90 days.
- **Logs go to stdout only** — no aggregation, no retention, no alerting.

### Recommendations

1. **Object storage for uploads** (S3 / R2 / Render disks). Generate pre-signed URLs for client uploads to keep them off the API server.

2. **Separate migration step** in deploy pipeline (`npm run migrate` before `npm start`).

3. **Multi-stage Dockerfile** for backend:
   
   ```dockerfile
   FROM node:20-alpine AS deps
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   
   FROM node:20-alpine AS build
   WORKDIR /app
   COPY --from=deps /app/node_modules ./node_modules
   COPY . .
   RUN npm run build
   
   FROM node:20-alpine AS runtime
   WORKDIR /app
   ENV NODE_ENV=production
   COPY package*.json ./
   RUN npm ci --omit=dev
   COPY --from=build /app/dist ./dist
   USER node
   EXPOSE 5000
   CMD ["node", "dist/server.js"]
   ```

4. **Healthcheck endpoint** already exists at `/api/health` — wire it into compose and platform configs.

5. **Backups**: `pg_dump` nightly cron → S3, with 30-day retention.

6. **Observability**: Sentry for errors, Logtail/Axiom for structured logs, BetterStack/Healthchecks.io for uptime + cron pings.

7. **Secrets**: ensure every env var with a default secret string fails fast in production (see P0-1).

---

## 11. Testing Gaps

### What exists

- Backend: 14 service tests, 10 controller tests, 1 middleware test (errorHandler), 2 util tests, 1 integration suite, 1 e2e suite. **85%** lines / **75%** branches threshold.
- Frontend: 1 api test, 3 component tests, 3 hook tests, 7 page tests. **70%** lines / **75%** branches / **55%** functions.

### Gaps

- **No `authService.test.ts`, no `authController.test.ts`, no `auth.middleware.test.ts`.** This is the highest-risk area of the codebase and is completely untested.
- **No `recurringService.test.ts`.** Pattern-detection logic with non-trivial math is untested.
- **No `recurringController.test.ts`, no `savingsGoalController.test.ts`, no `budgetController.test.ts`.**
- **Integration & e2e tests mock all services** — they don't actually exercise the DB layer. Add a Postgres-backed integration suite (use `testcontainers` or `pg-mem` for fast tests).
- **No security tests**: no test that asserts a user cannot fetch another user's transactions.
- **No load/perf tests** — `getTrends` and `getCashflow` over years of data are untested at scale.
- **No frontend e2e** (Playwright/Cypress).
- **Frontend coverage explicitly excludes Accounts and SavingsGoals pages** (`vite.config.js:24`) — feature added without tests.

### Recommendations

1. Add the missing auth tests this sprint (P1 priority).
2. Stand up `testcontainers-postgres` and add at least one cross-tenant isolation test per resource.
3. Add Playwright with 5 smoke tests in CI.
4. Lower the frontend functions threshold (55%) is too generous — push to 75% as test debt is repaid.

---

## 12. Phased Roadmap

The work above is sequenced into four phases. Each phase produces a shippable improvement.

### Phase 1 — Security & Correctness (Week 1–2)

**Goal:** make the app safe to expose to the public internet.

- [ ] P0-1: Hard-fail on weak `JWT_SECRET`.
- [ ] P0-3 + P0-4: Tenant isolation in `validate*Exists` and all balance aggregations.
- [ ] P0-6 + P0-7: Parameterise the two SQL interpolation sites in `analyticsService`.
- [ ] P0-8: Authenticate `/uploads/*` (or move to private storage).
- [ ] P1-7: Magic-byte file validation for uploads.
- [ ] P1-1 + P1-8: Per-email login throttling + per-user scan-upload quota.
- [ ] Add auth service/controller/middleware tests.
- [ ] Add a cross-tenant integration test that asserts users cannot read each other's data.

**Exit criteria:** all P0s closed, `JWT_SECRET` failure mode tested, no string-interpolated SQL anywhere (greppable).

### Phase 2 — Schema, Migrations, Money (Week 3–4)

**Goal:** make the data layer trustworthy and operable.

- [ ] P0-2: Proper migrations table + numbered migration files + separate `npm run migrate` step.
- [ ] P0-5: Settle transfer semantics; pick one (two-row vs signed) and refactor.
- [ ] P2-1 / P2-2 / P2-3: Add the recommended indexes (`user_id, transaction_date DESC`, GIN on tags, trigram on description).
- [ ] P2-5: Decide money representation (bigint cents recommended); migrate transactions amount column or wrap with `decimal.js` on read.
- [ ] P2-7 / P2-8: Introduce Zod for request validation; wire one route (`/transactions`) end-to-end as a template.
- [ ] P3-9: First-class investment account support (optional in this phase).

**Exit criteria:** migrations decoupled from boot, no rounding errors in totals, indexes verified with `EXPLAIN`.

### Phase 3 — Frontend Modernisation (Week 5–6)

**Goal:** turn the UI into something resilient, fast, and pleasant.

- [ ] P2-16: Adopt TanStack Query; replace all page-level `useState/useEffect` data-fetching.
- [ ] Frontend code-split per route with `React.lazy`.
- [ ] `react-hook-form` + zod resolvers; share schemas with backend via a `shared/` directory.
- [ ] P2-19: Properly wire CSS variables — light theme actually works.
- [ ] P2-21: Accessibility pass — aria-labels, focus management, keyboard navigation, contrast.
- [ ] Split monster pages (`Transactions.jsx`, `Settings.jsx`) into smaller files.
- [ ] Playwright smoke suite (signup → add txn → dashboard → export CSV).
- [ ] P1-3: Move auth token to `httpOnly` cookie; add CSRF.

**Exit criteria:** Lighthouse a11y ≥ 95, time-to-interactive < 2s on a cold load, e2e tests in CI.

### Phase 4 — Ops, Observability, Polish (Week 7–8)

**Goal:** production-ready.

- [ ] Object storage for uploads (S3 / R2) + signed URLs.
- [ ] Multi-stage Dockerfile + `--omit=dev`.
- [ ] Sentry + structured logs (`pino` + request-id middleware).
- [ ] BullMQ + Redis for scan processing (replace fire-and-forget).
- [ ] Nightly `pg_dump` backups with retention.
- [ ] P3-5: Google OAuth (lowers signup friction).
- [ ] P3-4: TOTP 2FA.
- [ ] P3-6 (optional, big lift): Plaid integration as a v2 feature.
- [ ] User-facing settings: base currency, locale, date format.

**Exit criteria:** Sentry catches a deliberately-thrown error end-to-end, scan retries visible in a queue dashboard, automated backups verified by a test restore.

---

## 13. Recommended Feature Additions (beyond fixes)

Ordered by user value / effort ratio:

1. **Transfer transactions done right** (link two transactions across accounts) — currently the schema hints at it but UX doesn't support it.
2. **Split transactions** (one purchase, multiple categories — e.g. a Target receipt with groceries + electronics). The scan already extracts line items; surface them.
3. **Receipt attachment to manual transactions** (drop a photo onto an existing transaction).
4. **Net-worth chart over time** (currently only a current snapshot exists at `/analytics/net-worth`).
5. **Cash-flow forecast** (use the recurring patterns table + scheduled income to project 30/60/90 days out).
6. **Budget rollover** (carry unused budget to next month, optionally).
7. **Tags as first-class objects** with color + auto-suggest.
8. **Multi-user shared accounts** (couples, families) — opt-in.
9. **Email + push notifications** for budget alerts (today they're DB-only).
10. **Exportable PDF reports** (currently CSV only).
11. **OFX import** alongside CSV/QIF.
12. **Auto-categorisation** via a tiny ML model fit on the user's own history.

---

## 14. Quick-win Fixes (≤ 1 hour each)

For maintainers who want immediate wins:

1. Replace `'dev-secret-change-in-production'` fallback with a startup check.
2. Add the composite `(user_id, transaction_date DESC)` index.
3. Parameterise the two SQL interpolations in `analyticsService.ts`.
4. Add `user_id` to `validateAccountExists` / `validateCategoryExists`.
5. Add `auth.test.ts` for register/login happy + sad paths.
6. Fix `start.ps1` (rename to `.sh`, write a real PowerShell version).
7. Add `image/tiff` to `ALLOWED_MIMES` (common scan format) and remove `image/heif` if not handled by sharp.
8. Use `escapeCSV` from `exportService` in `transactionController.exportTransactions`.
9. Set `min_machines_running = 1` in `fly.toml` so the scheduler actually runs.
10. Add `idx_transactions_tags` GIN index.

---

## 15. Risks & Open Questions

- **Single-user deployment vs multi-user SaaS?** Many P0/P1 items assume multi-tenant. If this is intended as a self-hosted single-user tool, several items relax (but auth correctness still matters).

**User Reply:** Though I intend to use it as a self-hosted single user, I would still like you to proceed with the implementation of Multi-User SaaS, jus in case I would like to monetise / commercialise it in the future. 

- **Hosting target?** Render free tier, Fly free tier, and self-hosted Docker each imply different storage/backup decisions. The current code straddles all three with no clear winner.

**User Reply:** Though I would like to use it on self-hosted Docker, I would also like you to host it with Render free tier and Fly free tier, so that in case I want, I can use them as well. Also, pls see to it that there is detailed step by step instruction manual on how to use each.

- **Vision provider economics?** Z.ai GLM-5V vs Anthropic Claude Sonnet have very different per-call costs. Track usage per user.

**User Reply:** I intend to use Z.ai's GLM-5V for this.

- **Currency conversion source.** `api.exchangerate-api.com` (free tier) without an API key has rate limits and no SLA. For production use, pick a paid provider (Open Exchange Rates, Currencylayer).

**User Reply:** Ok

- **Will hierarchical categories be used?** The schema supports it; the UI doesn't. Decide and either commit or remove.

**User Reply:** If the schema supports it, pls incorporate it in the UI.

---

## 16. Effort Estimate Summary

| Phase                          | Calendar    | FTE-weeks         | Risk                  |
| ------------------------------ | ----------- | ----------------- | --------------------- |
| 1 — Security & Correctness     | 2 weeks     | 1.5               | Medium (touches auth) |
| 2 — Schema, Migrations, Money  | 2 weeks     | 2.0               | High (data migration) |
| 3 — Frontend Modernisation     | 2 weeks     | 1.5               | Low (incremental)     |
| 4 — Ops, Observability, Polish | 2 weeks     | 1.5               | Low                   |
| **Total**                      | **8 weeks** | **6.5 FTE-weeks** |                       |

This is a focused-engineer estimate. Multiply by 1.5–2× for context-switching, code review, and unforeseen rabbit holes.

---

## 17. Appendix — Files Touched per Issue

A condensed map for implementers:

| Issue        | Files                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| P0-1         | `backend/src/config.ts`, `backend/src/server.ts`                                                                     |
| P0-2         | `backend/src/server.ts`, `backend/src/models/migrations.ts` + new `backend/migrations/*.sql`                         |
| P0-3         | `backend/src/utils/validators.ts`, every controller calling validators                                               |
| P0-4         | `backend/src/services/accountService.ts`, `backend/src/services/reportService.ts`                                    |
| P0-5         | `backend/src/models/migrations.ts`, balance queries across services                                                  |
| P0-6, P0-7   | `backend/src/services/analyticsService.ts`                                                                           |
| P0-8         | `backend/src/server.ts`, `backend/src/middleware/auth.ts`, scan upload flow                                          |
| P1-1, P1-2   | `backend/src/middleware/auth.ts`, `backend/src/services/authService.ts`, `backend/src/controllers/authController.ts` |
| P1-3         | `backend/src/services/authService.ts`, `frontend/src/api/index.js`, `frontend/src/hooks/useAuth.jsx`                 |
| P1-7         | `backend/src/middleware/upload.ts`                                                                                   |
| P2-1 to P2-3 | `backend/src/models/migrations.ts` + a new `005_indexes.sql`                                                         |
| P2-16        | `frontend/src/hooks/*`, every page component                                                                         |
| P2-19        | `frontend/src/components/*`, `frontend/src/pages/*`, `frontend/tailwind.config.js`, `frontend/src/index.css`         |

---

*End of plan. Maintain by reviewing each phase exit-criteria before starting the next.*
