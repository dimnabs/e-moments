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
npm run build
```

## Docker

Build the production web image from the repository root:

```sh
docker build -f apps/web/Dockerfile -t e-moment-web:local .
```

## Roadmap

The full MVP scope, architecture, CI/CD path, and production plan are in [plan.md](plan.md).
