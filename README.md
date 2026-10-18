# Apex ERP — Manufacturing Suite

A full-stack ERP for manufacturing businesses: inventory, sales, purchasing, user administration and an operations dashboard.

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Ant Design 6, TanStack Query, Recharts |
| Backend  | Node.js, Express 5, TypeScript, Zod validation, Pino logging     |
| Database | PostgreSQL 17 (Docker), Drizzle ORM with versioned SQL migrations |
| Security | JWT access tokens + rotating httpOnly refresh cookies, bcrypt, RBAC, Helmet, rate limiting |

## Getting started

Prerequisites: Node.js 22+, Docker.

```bash
npm install                      # installs both workspaces
cp server/.env.example server/.env   # then set JWT_ACCESS_SECRET to a long random value
npm run db:up                    # starts PostgreSQL on localhost:5434
npm run db:migrate               # applies schema migrations
npm run db:seed                  # loads roles, users and demo manufacturing data
npm run dev                      # API on :4100, web app on :5173
```

Open http://localhost:5173.

### Demo accounts

All seeded accounts use the password `Admin@12345` — change them before any real use.

In development the login page shows **one-click demo login** buttons for each role. You can also sign in automatically with a link such as http://localhost:5173/login?demo=admin (keys: `admin`, `manager`, `sales`, `purchase`, `store`). Production builds hide this unless built with `VITE_ENABLE_DEMO_LOGIN=true`; never enable it against real data.

| Email                | Role               | Can do                                              |
| -------------------- | ------------------ | --------------------------------------------------- |
| admin@erp.local      | Administrator      | Everything, including users and roles               |
| manager@erp.local    | Operations Manager | All inventory, sales and purchase operations        |
| sales@erp.local      | Sales Executive    | Customers and draft sales orders                    |
| purchase@erp.local   | Purchase Officer   | Suppliers and draft purchase orders                 |
| store@erp.local      | Store Keeper       | Stock adjustments and transfers; view orders        |

## Modules

**Inventory** — products (raw material, semi-finished, finished good, consumable), categories, warehouses, stock on hand per warehouse, stock adjustments with mandatory reason, inter-warehouse transfers, and a full stock ledger with running balances.

**Sales** — customers with credit limits and payment terms; sales orders flow `draft → confirmed → delivered` (or `cancelled`). Delivery deducts stock atomically and is rejected if any line is short.

**Purchase** — suppliers; purchase orders flow `draft → approved → received` (or `cancelled`). Receipt adds stock and updates product cost using weighted moving average.

**Dashboard** — monthly sales/purchases, inventory valuation, six-month trend, reorder alerts and recent orders.

**Administration** — users and roles with granular permissions; the sidebar, routes and API all enforce them.

## Architecture

```
erp project/
├── docker-compose.yml          PostgreSQL
├── server/
│   ├── drizzle.config.ts
│   └── src/
│       ├── app.ts              Express wiring, security middleware, route mounting
│       ├── index.ts            Bootstrap and graceful shutdown
│       ├── config/env.ts       Validated environment
│       ├── db/
│       │   ├── schema/         Tables, enums, relations
│       │   ├── migrations/     Generated SQL (commit these)
│       │   ├── migrate.ts
│       │   └── seed.ts
│       ├── lib/                Errors, permissions, tokens, money, sequences, HTTP helpers
│       ├── middleware/         Authentication, authorisation, error handling
│       └── modules/            auth, users, inventory, parties, sales, purchase, dashboard
└── client/
    └── src/
        ├── api/                Axios client with silent token refresh, shared types
        ├── auth/               Session context, route guards, permission helpers
        ├── layouts/            Application shell
        ├── components/         Shared UI pieces
        ├── hooks/              Data fetching and table state
        └── pages/              Screens per module
```

### Design decisions

- **Single stock entry point.** Every stock change goes through `applyStockMovement`, which updates the balance with an atomic upsert and writes the ledger row in the caller's transaction. Business documents and stock always commit or roll back together, and stock can never go negative.
- **Row locking on document transitions.** Confirm, deliver, approve, receive and cancel lock the order row (`SELECT … FOR UPDATE`) so concurrent clicks cannot double-post stock.
- **Gap-free document numbers.** `SO-2026-00001`-style numbers come from a per-prefix, per-year counter incremented inside the same transaction.
- **Server-side totals.** Line amounts, tax and totals are always recomputed by the API; the client figures are a preview only.
- **Money as `numeric`.** Amounts are `numeric(14,2)` and quantities `numeric(14,3)` in PostgreSQL, rounded explicitly in application code.
- **Session security.** Short-lived access tokens are held in memory only. Refresh tokens are random, stored hashed, rotated on every use, scoped to `/api/auth` in an httpOnly `SameSite=Strict` cookie, and replaying an old token revokes all of that user's sessions.
- **Consistent API errors.** Every error has the shape `{ error: { code, message, details? } }`; validation failures list each field, and database constraint violations map to `409` with a readable message.

## Scripts

| Command               | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `npm run dev`         | Run API and web app with hot reload         |
| `npm run build`       | Production build of both workspaces         |
| `npm run typecheck`   | Type-check both workspaces                  |
| `npm run db:generate` | Generate a migration after changing schema  |
| `npm run db:migrate`  | Apply pending migrations                    |
| `npm run db:seed`     | Seed demo data (skips if already seeded)    |
| `npm run db:down`     | Stop PostgreSQL (`docker compose down -v` also wipes data) |

## API overview

All endpoints are under `/api` and, except `/api/auth/*` and `/api/health`, require `Authorization: Bearer <token>`.

| Area       | Endpoints |
| ---------- | --------- |
| Auth       | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` |
| Dashboard  | `GET /dashboard/summary` |
| Inventory  | `/inventory/products`, `/inventory/categories`, `/inventory/warehouses`, `GET /inventory/stock/levels`, `GET /inventory/stock/movements`, `POST /inventory/stock/adjustments`, `POST /inventory/stock/transfers` |
| Sales      | `/customers`, `/sales-orders`, `POST /sales-orders/:id/{confirm,deliver,cancel}` |
| Purchase   | `/suppliers`, `/purchase-orders`, `POST /purchase-orders/:id/{approve,receive,cancel}` |
| Admin      | `/admin/users`, `/admin/roles`, `GET /admin/roles/permissions` |

List endpoints accept `page`, `pageSize` and `search`, and return `{ data, meta: { page, pageSize, total } }`.

## Roadmap

- **HR & Payroll** — employees, departments, attendance, leave, salary structures, payslips
- **Accounting** — chart of accounts, journal entries posted automatically from deliveries and receipts, invoices, payments, receivables/payables ageing
- Manufacturing — bills of materials and work orders consuming raw materials into finished goods
- Partial deliveries and receipts, PDF documents, audit log, automated test suite
