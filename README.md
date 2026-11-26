# CampusFix

CampusFix is a campus facilities portal for reporting maintenance issues and tracking reports from submission through resolution. It is a Node.js and Express web app backed by Supabase Postgres and is ready to deploy as a Render Web Service.

## What it does

- Dashboard with request totals, status counts, recent activity, and a recent request list.
- Search and filter requests by text, status, category, and priority.
- Report form with validation, a confirmation, and a generated request detail view.
- Request detail page with location, category, priority, date, request number, and status progress.
- “My reports” remembers request IDs in the current browser using local storage.
- REST API: `GET /api/requests`, `GET /api/summary`, `GET /api/requests/:id`, and `POST /api/requests`.

## Run locally

1. Install Node.js 18 or newer.
2. Install packages with `npm install`.
3. Create a Supabase project and run [`data/schema.sql`](data/schema.sql) in its SQL Editor.
4. Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Supabase project settings.
5. Start the app with `npm start` and open `http://localhost:8080`.

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

## Database access

The included schema allows anonymous visitors to read campus requests and submit reports, as required by this public demo. Do not collect sensitive personal information in reports. Staff-only status updates and authentication are intentionally not exposed by this student-facing build.
