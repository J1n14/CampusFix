# CampusFix

CampusFix is a campus facilities portal for reporting maintenance issues and tracking reports from submission through resolution. It is a Node.js and Express web app backed by Supabase Postgres and is ready to deploy as a Render Web Service.

## What it does

- Dashboard with request totals, status counts, recent activity, and a recent request list.
- Search and filter requests by text, status, category, and priority.
- Report form with validation, a confirmation, and a generated request detail view.
- Request detail page with location, category, priority, date, request number, and status progress.
- Student sign-up/sign-in through Supabase Auth.
- “My reports” remembers request IDs per signed-in account in the current browser.
- Allowlisted facilities admins can review reports and update their status from a protected admin page.
- REST API: request, summary, health, authentication, and protected admin routes.

## Run locally

1. Install Node.js 18 or newer.
2. Install packages with `npm install`.
3. Create a Supabase project and run [`data/schema.sql`](data/schema.sql) in its SQL Editor.
4. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Supabase project settings.
5. To enable admin tools, set `SUPABASE_SERVICE_ROLE_KEY` to the private server key and `ADMIN_EMAILS` to a comma-separated list of facilities admin emails. Never add the service-role key to frontend code or Git.
6. Start the app with `npm start` and open `http://localhost:8080`.

The `.env` file is ignored by Git. Never commit Supabase credentials.

## API

### `GET /api/requests`

Returns requests as JSON with HTTP `200`. Supports optional `status`, `category`, `priority`, `sort=newest|priority`, and `limit` query parameters.

### `POST /api/requests`

Example JSON body:

```json
{
  "title": "Leaking faucet",
  "location": "Science Hall, Room 202",
  "issue_type": "plumbing",
  "description": "The sink faucet keeps dripping.",
  "priority": "medium"
}
```

Returns the inserted record with HTTP `201`; invalid required fields return `400`.

## Deploy to Render

Push this repository to GitHub, then create a Render Web Service from the repository. Render reads the included `render.yaml`; set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the service environment. The health check is `/api/health`.

## Authentication and database access

The web interface requires a Supabase Auth account to enter the student portal. Admin API routes verify the user session and require the email to appear in `ADMIN_EMAILS`; status updates use the service-role key on the server only. The existing database grants also allow the public anon role to read request fields and insert reports for the public demo, while row-level security prevents anon updates and deletes. Do not collect sensitive personal information in reports.

For the deployed Render service, configure `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Add `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_EMAILS` in Render’s private environment settings to turn on admin status changes. Admin tools stay unavailable until both are configured.
