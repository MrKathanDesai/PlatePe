# PlatePe POS — Codebase Summary

## Architecture Overview

This is a monorepo containing two production applications:

| Path | Purpose |
| --- | --- |
| `app/` | Vite + React frontend (role-based POS UI) |
| `backend/` | NestJS + TypeORM + Postgres API |

## Local Runtime

1. `docker-compose up -d` — starts Postgres and Redis
2. `cd backend && npm run start:dev` — NestJS on port `4000`, prefix `/api`
3. `cd app && npm run dev` — Vite on port `3000`, proxies `/api` and `/socket.io` to backend

## Frontend (`app/`)

Entry: `app/src/store/AppContext.tsx` owns all global state — user, session, active order, active table, screen, and toasts.

### Role → Home Screen

| Role | Home Screen |
| --- | --- |
| Admin | Dashboard |
| Server | FloorPlan |
| Cashier | CashierQueue |
| CoffeeBar | CoffeeBar |
| Kitchen | KDS |

### Screens

| Screen | Responsibility |
| --- | --- |
| `LoginScreen` | Auth + session bootstrap |
| `DashboardScreen` | Session open/close, stats, low-stock notice, recent orders |
| `FloorPlanScreen` | Table filtering and order open/resume |
| `OrderScreen` | Catalog, cart, discounts, send-to-kitchen, payment handoff |
| `PaymentScreen` | Tip, payment method, settlement |
| `CashierQueueScreen` | Orders awaiting payment |
| `KDSScreen` | Kitchen kanban (TO_COOK → PREPARING → DONE) |
| `CoffeeBarScreen` | Beverage-specific KDS variant |
| `ReportingScreen` | Daily, product, and audit reports |
| `screens/settings/*` | Products, categories, tables, staff, discounts, inventory |

### API Layer

`app/src/api/*.ts` — thin Axios wrappers per domain.
`app/src/api/client.ts` — shared Axios instance (`/api` base, JWT interceptor, 401 auto-logout).
`app/src/api/kds.ts` — Socket.IO for real-time KDS.

### Design System

- CSS custom properties: surfaces, text, borders, semantic colors, shadows, role accents.
- Fonts: `Fraunces` (display) + `Plus Jakarta Sans` (UI).
- Shared classes: `.btn`, `.card`, `.badge`, `.input`, `.data-table`, `.toast`, `.modal-overlay`.

## Backend (`backend/`)

Entry: `backend/src/main.ts` — `ValidationPipe`, CORS for port 3000, global prefix `/api`.

### Domain Modules

| Module | Responsibility |
| --- | --- |
| `auth` | Register, login, JWT, user management |
| `sessions` | Terminal locking, session open/close/active |
| `products` | Categories, modifiers, products, 86 toggling |
| `tables` | Table CRUD, occupancy, order transfer |
| `orders` | Order lifecycle, line items, totals, fire to kitchen, voids, discounts, tips |
| `payments` | Payment creation, confirmation, refunds, split-bill, UPI webhook |
| `kds` | KDS ticket listing, stage advancement, Socket.IO gateway |
| `inventory` | Stock lookup and adjustments |
| `discounts` | Discount CRUD |
| `reporting` | Daily summary, product performance, audit trail, hourly heatmap, table turnover |
| `audit` | Audit log persistence |

### Key Business Rules

- First registered user becomes `Admin`.
- Opening a session locks a terminal to a user.
- Firing an order converts `Pending` items → `Sent`, decrements stock, creates a `KDSTicket`.
- Confirming sufficient payments marks the order `Paid` and releases the table.
- Voids, stock adjustments, discounts, and refunds all produce audit log rows.

## Best Entry Points

- `app/src/store/AppContext.tsx` — state and role model
- `app/src/App.tsx` — screen switching
- `app/src/screens/OrderScreen.tsx` — core POS flow
- `backend/src/app.module.ts` — module wiring
- `backend/src/orders/orders.service.ts` — order domain logic
- `backend/src/payments/payments.service.ts` — payment logic
- `backend/src/reporting/reporting.service.ts` — analytics queries
