# CivicConnect

Real-time civic issue reporting and resolution platform (MERN + Socket.IO). Residents report issues with photos and
GPS/map locations; authorised staff triage, assign and resolve them; everyone sees live status updates.

> CivicConnect is an independent issue-management system. It is **not** integrated with any real municipal authority
> unless you configure and obtain an authorised integration yourself.

## Stack
React + Vite + Tailwind, React Router, Axios, Socket.IO client, React-Leaflet/OpenStreetMap, Recharts, React Hook Form ·
Node/Express, MongoDB/Mongoose, JWT (HttpOnly cookies), bcrypt, Socket.IO, Multer + Cloudinary, express-validator, Helmet, CORS, rate limiting.

## Quick start (local)
Requirements: Node 18.18+ (tested on 22), a MongoDB instance (local or Atlas).

```bash
# 1. API
cd server
cp .env.example .env        # fill MONGODB_URI; set two long random JWT secrets for non-dev use
npm install
npm run seed                # demo organisation, categories, 5 demo users
npm run dev                 # http://localhost:5000

# 2. Web app (new terminal)
cd client
cp .env.example .env        # optional in dev
npm install
npm run dev                 # http://localhost:5173  (proxies /api and /socket.io to :5000)
```

Demo logins (password `Password@123`, **dev only**): `resident@demo.test`, `staff@demo.test` (all wards),
`wardA@demo.test` / `wardB@demo.test` (ward-restricted), `admin@demo.test`.
Without Cloudinary credentials, images are stored in `server/uploads` (development fallback only; production refuses to start without Cloudinary).

Tests: `cd server && npm test` (workflow/permission rules).

## Architecture notes
- **Auth**: 15-minute JWT access token + rotating 7-day refresh token, both in HttpOnly cookies (`Secure`, SameSite configurable).
  CSRF: double-submit token (`X-CSRF-Token`, kept in memory client-side) plus an `Origin` allow-list check. bcrypt cost 12; login/register rate-limited; suspended users are rejected and their sockets dropped.
- **Authorization**: enforced in Express middleware and in a single scoping helper (`services/scope.js`). Residents see only their own complaints;
  staff are limited to their organisation and (optionally) assigned wards; admins to their organisation. Out-of-scope IDs return 404.
- **Workflow** (`services/workflow.js`): `Submitted → Under review → Assigned → In progress → Resolved`, plus `Rejected` (reason required),
  `Reopened` (reason required; resident-only within `REOPEN_WINDOW_DAYS`) and `Closed` (staff only; disable with `REQUIRE_CLOSURE=false`).
  Every transition is recorded with actor, time, previous/new status and note. Residents can never set Resolved/Closed.
- **Real time**: sockets authenticate via the access-token cookie and verify `Origin`. Rooms: `user:{id}`, `org:{id}:all` (admins + org-wide staff),
  `jur:{wardId}` (ward-restricted staff), `complaint:{id}` (joined only after a server-side permission check). Events are emitted only after the DB write
  succeeds and carry minimal data (clients refetch details through the authorised API). Notifications are persisted first; the client re-syncs on every (re)connect.
  Events: `complaint:created|updated|assigned|statusChanged`, `notification:new`, `dashboard:statsUpdated`.
- **Privacy**: the public map returns coordinates rounded to ~100 m and no reporter data, address, description or photos. Internal notes are stored with `visibility: internal` and never returned to residents.
- **Duplicates/spam**: idempotency key per submission (double-click safe), 10 reports/hour/user, 50 m / 14-day same-category duplicate check
  (user can confirm; confirmed ones land in the admin review queue), admin spam/duplicate flagging.
- **Uploads**: JPEG/PNG/WebP only, 5 MB, max 3; file signatures verified server-side; stored on Cloudinary.
- **Maps/geocoding**: tiles come from `VITE_TILE_URL` (default = public OSM tiles, fine for development/light use only — see the
  [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/); use a hosted provider for production). Address lookup goes through a server proxy that
  sets a proper User-Agent, caches, and limits to 1 request/second (Nominatim policy). Set `GEOCODER_USER_AGENT` with your contact details, and never assume unlimited free geocoding.
  Browser location is requested only when the user presses "Use my current location".

## Deployment
1. **MongoDB Atlas**: create a cluster + DB user, allow your host's IPs, copy the connection string to `MONGODB_URI`.
2. **Cloudinary**: create a free account, copy cloud name / API key / secret.
3. **Render (API)**: new Web Service from this repo with root dir `server` (or use `render.yaml`). Set env vars from `server/.env.example`
   (`NODE_ENV=production`, `CLIENT_ORIGIN=https://your-app.vercel.app`, `PUBLIC_URL=https://your-api.onrender.com`, two strong JWT secrets).
   Run `SEED_FORCE=true npm run seed` once from the Render shell (change the demo passwords immediately!) or create your org/admin manually.
4. **Vercel (web)**: import the repo with root dir `client`, framework Vite, env `VITE_API_URL=https://your-api.onrender.com` (+ tile settings). `vercel.json` handles SPA routing.

**Cookies across domains**: with Vercel + Render on different registrable domains the cookies are third-party (`SameSite=None; Secure`, the production default).
Safari and some browsers block these. For reliable sessions put both behind one site, e.g. `app.example.com` + `api.example.com`, and set
`COOKIE_SAMESITE=lax` and `COOKIE_DOMAIN=.example.com`.
Render's free tier sleeps when idle (the first request/socket connect can be slow) — use a paid instance for real use.

## Project layout
```
server/src  config.js app.js server.js seed.js  models/ routes/ middleware/ services/ sockets/ utils/   server/tests
client/src  main.jsx App.jsx  context/ components/ pages/ lib/
```

## Known limitations / next steps
Email/SMS/push notifications, automatic jurisdiction detection from polygon boundaries (wards are currently chosen from a list),
auto-closing resolved complaints after N days, multi-organisation super-admin, i18n, and end-to-end/integration tests against a test database.
Ward renames do not retroactively update `jurisdictionName` stored on existing complaints.
