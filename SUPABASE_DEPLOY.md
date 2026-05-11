# ZE Ledger API on Supabase

This project now includes a Supabase-native deployment target in `supabase/`.

## What was added

- `supabase/migrations/`: PostgreSQL schema for ZE Ledger
- `supabase/functions/api/`: one Edge Function that exposes the current REST API
- `supabase/config.toml`: Supabase function configuration

The deployed base URL becomes:

`https://<project-ref>.supabase.co/functions/v1/api`

Examples:

- `GET /health` -> `.../functions/v1/api/health`
- `POST /auth/login` -> `.../functions/v1/api/auth/login`
- `GET /dashboard/summary` -> `.../functions/v1/api/dashboard/summary`

## Required secrets

Set these in Supabase before deployment:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `DB_CONNECTION_LIMIT`

Recommended values:

```bash
API_PREFIX=/api/v1
JWT_EXPIRES_IN=7d
DB_CONNECTION_LIMIT=3
```

`API_PREFIX` is optional. If you set it, the function also accepts legacy paths like `/api/v1/health` after the function base URL, which can make client migration easier.

For `DATABASE_URL`, use the Supabase transaction pooler connection string because Edge Functions are short-lived serverless workloads:

https://supabase.com/docs/reference/postgres/connection-strings

## Deploy steps

1. Install and log in to the Supabase CLI.
2. In `ze_ledger_api`, run `supabase link --project-ref <your-project-ref>`.
3. Push the schema:
   `supabase db push`
4. Set secrets:
   `supabase secrets set DATABASE_URL=... JWT_SECRET=... JWT_EXPIRES_IN=7d API_PREFIX=/api/v1 CORS_ORIGIN=https://your-flutter-web-app.example`
5. Deploy the function:
   `supabase functions deploy api`

Official docs:

- Edge Functions overview: https://supabase.com/docs/guides/functions
- Routing in one function: https://supabase.com/docs/guides/functions/http-methods
- Connect to Postgres from functions: https://supabase.com/docs/guides/functions/connect-to-postgres
- Deploy functions: https://supabase.com/docs/guides/functions/deploy

## Important note about auth

This deployment keeps your existing custom JWT login flow. It does **not** switch the project to Supabase Auth yet.

That is why `supabase/config.toml` sets:

```toml
[functions.api]
verify_jwt = false
```

The function validates your app's `Authorization: Bearer <token>` header with `JWT_SECRET` after the request enters the function.
