# Retain

Retain is a personal expense and monthly budget app. The React + TypeScript frontend talks to an Express REST API, and MongoDB stores user accounts, categories, budgets, and expenses.

## Requirements

- Node.js 20 or newer
- npm
- A MongoDB deployment, such as MongoDB Atlas

## Start locally

1. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and a random `JWT_SECRET` of at least 32 characters. The example URI is prefilled with the Atlas cluster, database name `Retain_App`, and `authSource=admin`; replace its username and password placeholders. Set `CORS_ORIGIN` to the frontend origin, or a comma-separated list while developing (for example, `http://localhost:5173,http://localhost:5174`).
2. In Atlas **Database Access**, change the app database user's role from `atlasAdmin` to the built-in `readWrite` role for only the `Retain_App` database. In **Network Access**, add the backend machine's current public IP as a `/32` entry. Atlas shows `105.178.32.61` in the supplied setup screen; confirm it is still your current IP before adding it.
3. Rotate the database user's password because the previous one was exposed. Use the rotated password only in local `backend/.env`, URL-encoding special characters. Do not paste it into chat or commit it.
4. From `backend/`, run `npm install`, then `npm run dev`.
5. Copy `frontend/.env.example` to `frontend/.env`.
6. From `frontend/`, run `npm install`, then `npm run dev`.
7. Open the frontend URL printed by Vite (normally `http://localhost:5173`) and create your account.

The API starts at `http://localhost:4000`. On startup, it creates the MongoDB collections and indexes for users, expenses, budgets, and categories, then inserts the starter expense categories if they are missing. MongoDB creates these collections from the Mongoose schemas; they are the document-database equivalent of application tables. The database name is `Retain_App`. User accounts created through sign-up always have the `user` role.

## Administrator setup

Set a dedicated `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` (at least 14 characters) in `backend/.env`, then run `npm run seed:admin` from `backend/`. This promotes or creates only that configured account. Remove the bootstrap credentials from the environment after setup.

## API

- `POST /api/auth/signup`, `POST /api/auth/signin`, `GET /api/auth/me`
- `GET /api/categories`; category create/update/delete require an administrator
- `GET /api/expenses` supports pagination, title search, category, payment method, date and amount filters, and date/amount sorting. `POST`, `PATCH /:id`, and `DELETE /:id` manage only the signed-in user's records.
- `GET /api/budgets?year=2026`, `PUT /api/budgets`
- `GET /api/dashboard?year=2026&month=10`
- `GET /api/admin/insights` (administrator only)
- `GET /api/health`

Every expense query and mutation is scoped to the signed-in account. Amounts are displayed as Rwandan francs (RWF). Dashboard budget guidance uses “approaching” when 80% or more of a monthly budget has been spent and “over” only when spending exceeds it.

## MongoDB credentials and deployment

Keep `backend/.env` and deployment secrets out of version control. A database password was exposed in project notes and another password was pasted into chat; treat both as compromised and rotate the Atlas database user's password again before continued use. Keep the rotated, URL-encoded value only in the local `backend/.env`; do not paste it into chat or commit it. Use a least-privilege database user instead of Atlas Admin, separate credentials for development and production, an Atlas Network Access entry for the backend's deployment environment, a production-only `JWT_SECRET`, and the exact frontend `CORS_ORIGIN`. Restart the backend after rotating its password so it opens a new authenticated MongoDB connection.

The API creates one Mongoose connection and reuses its driver's connection pool; it does not create a connection per HTTP request. No custom pool sizes or timeouts are set without workload and deployment measurements. Observe Atlas connection counts and application latency as traffic grows before changing driver pool settings.
