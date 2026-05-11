# ZE Ledger API

Node.js and Express backend for the Flutter app in `Ze_ledger`, using PostgreSQL for persistence. The API is organized around the real app domain:

- authentication
- parties
- ledger entries
- dashboard summary

## Architecture

The code follows a modular production-ready layout:

- `src/config`: environment, database, and logger setup
- `src/common`: shared middleware, error handling, and utilities
- `src/modules/auth`: register, login, guest login, and profile
- `src/modules/party`: party creation, listing, details, and ledger operations
- `src/modules/ledger`: ledger entry persistence logic
- `src/modules/dashboard`: dashboard summary aggregation
- `src/scripts`: seed helpers and bootstrap scripts
- `src/routes`: top-level API route registration

## Setup

1. Copy `.env.example` to `.env`
2. Install dependencies with `npm install`
3. Start PostgreSQL locally and create a database named `ze_ledger`
4. Start the API with `npm run dev`

## Scripts

- `npm run dev`: start in development with auto-reload
- `npm start`: start in normal mode
- `npm run seed`: seed demo data
- `npm run check`: run Node syntax check

## Supabase Deployment

Supabase deployment assets live in `supabase/`. See `SUPABASE_DEPLOY.md` for the Edge Function setup, database migration, required secrets, and deploy commands.

## API Endpoints

Base prefix: `/api/v1`

### Health

- `GET /health`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/guest`
- `GET /auth/me`

### Dashboard

- `GET /dashboard/summary`

### Parties

- `GET /parties`
- `POST /parties`
- `GET /parties/:partyId`
- `GET /parties/:partyId/summary`
- `GET /parties/:partyId/ledger-entries`
- `POST /parties/:partyId/ledger-entries`

## PostgreSQL Notes

Configure these values in `.env`:

- `DATABASE_URL`
- `DB_SSL`

The API creates the required tables automatically on startup.
