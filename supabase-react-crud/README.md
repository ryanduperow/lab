# supabase-react-crud

## What it proves

That you can build a React + Vite app backed by Supabase using a fully **code-first** workflow — database schema, Row-Level Security policies, and auth config all defined as SQL migrations and committed to the repo. No dashboard clicking required.

## Concepts involved

- Supabase local development stack (Docker-based)
- SQL migrations as infrastructure-as-code
- Supabase Auth (email/password sign-up and sign-in)
- Row-Level Security (RLS) — database-level access control tied to the authenticated user's JWT
- `@supabase/supabase-js` client in a React + Vite app
- `auth.uid()` as a Postgres default — the client never sends a user ID

## Mental model

Supabase wraps a Postgres database with a REST API and an auth layer. When a user authenticates, their JWT is sent with every request. Postgres RLS policies use `auth.uid()` (extracted from that JWT) to filter rows — so the database itself enforces who can see what, not the client code.

The local dev stack runs the entire Supabase platform in Docker containers. Migrations are plain SQL files that define the schema. `supabase start` boots the stack, `supabase db reset` applies migrations. The React app talks to the local REST API at `http://127.0.0.1:54321`.

## How to run

### Prerequisites

- **Docker Desktop** — installed and running
- **Node.js / npm** — on PATH

### Steps

```bash
# Navigate to experiment
cd supabase-react-crud

# Install npm dependencies
npm install

# Start local Supabase stack (first run pulls ~10 Docker images — slow)
npx supabase start

# Apply migrations (creates the notes table + RLS policies)
npx supabase db reset

# Create .env.local from the template
cp .env.local.example .env.local
# Edit .env.local — paste the anon key from the `supabase start` output
# (The URL is already set to http://127.0.0.1:54321)

# Start the Vite dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

### To verify RLS

1. Sign up as `user-a@test.com` (any password 6+ chars) — create a few notes
2. Sign out
3. Sign up as `user-b@test.com` — user A's notes are invisible
4. Open Supabase Studio at `http://127.0.0.1:54323` — both users' notes are in the table, but the API only returns the authenticated user's rows

### To stop

```bash
npx supabase stop
```
