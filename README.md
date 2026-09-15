# E-moment

> **Your moments, beautifully framed.**

E-moment is a digital photo-box experience for moments made alone or together. Its first shared experience will help people in different places create one photo strip at the same time.

## Repository layout

```text
apps/web/              Next.js web application
docker-compose.yml     Local PostgreSQL and MinIO services
.github/workflows/     Continuous integration
plan.md                Product and engineering roadmap
```

## Prerequisites

- Node.js 24 or newer
- npm 11 or newer
- Docker Desktop (for the database and local object storage)

## Local development

1. Copy the local environment example:

   ```sh
   cp .env.example apps/web/.env.local
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Start PostgreSQL and MinIO:

   ```sh
   docker compose up -d
   ```

4. Start the web app:

   ```sh
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). MinIO's local console is available at [http://localhost:9001](http://localhost:9001).

## Quality checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

With the web app and MinIO running, the Milestone 3 shared-session smoke test
can be run locally:

```sh
node scripts/test-shared-session.mjs
```

## Shared sessions (Milestone 3)

Choose **Together** from the session setup to create a private room, then send
the invite link to your partner. Both participants enable their cameras and
confirm readiness. The host chooses the frame and starts the sequence. Keep
both pages visible through all four poses; each device captures its own images
at the server's scheduled times. The finished strip pairs both participants
side by side in each row.

Camera access requires HTTPS outside localhost. For a remote-device test, serve
the app over HTTPS and set `S3_PUBLIC_ENDPOINT` to an HTTPS storage endpoint
that both devices can reach. A localhost MinIO download URL only works on the
machine running MinIO.

Room state is temporary, held in one Node.js process, and is lost on restart.
Run this milestone with a single long-lived web process. Serverless deployment,
multiple replicas, and rolling restart continuity require a shared room store
and event transport before deployment. PostgreSQL is available locally but is
not yet used for room persistence. Live updates use authenticated streaming
HTTP (server-sent events); a production proxy must allow long-lived responses
and disable buffering for the events endpoint. Rooms have a two-hour hard
expiry, lobby rooms expire after 30 minutes without activity, and an unfinished
capture fails after the final slot plus a 90-second upload grace window.

Invite links grant access to an available partner seat. Participant credentials
are separate from invite links, and image downloads require a participant
credential before the server issues a temporary signed URL. Treat both invite
links and signed downloads as private. Room expiry invalidates room access;
it does not delete stored image objects or revoke already issued signed URLs.
Guest media retention and permanent deletion remain Milestone 4 work.

### Two-device acceptance check

1. Start MinIO and the web app; create a Together room on the first device.
2. Open the invite on another device or a separate browser tab and join.
3. Confirm that each participant sees the other arrive and become ready.
4. Start as host; check that both devices show the same four pose countdowns.
5. Wait for both uploads, then download and inspect the shared strip on each
   device. Each row should contain the host on the left and partner on the right.
6. Retry an interrupted upload without retaking. Check that a third participant
   cannot join, and that an old invite cannot start a new session after capture.
7. Disconnect a participant in the lobby and verify that starting is blocked
   until both participants reconnect and confirm readiness again.

## Docker

Build the production web image from the repository root:

```sh
docker build -f apps/web/Dockerfile -t e-moment-web:local .
```

## Roadmap

The full MVP scope, architecture, CI/CD path, and production plan are in [plan.md](plan.md).
