# E-moment development plan

> **E-moment** — *Your moments, beautifully framed.*

## 1. Product vision

E-moment is a digital photo-box experience for people who want to capture and keep a moment, alone or together. Its signature use case is helping people in long-distance relationships create a shared photo strip from different places.

The product should feel playful, private, and delightful. It is not simply a photo uploader: the shared timing, themed frames, and final reveal should make the session feel like an occasion.

## 2. MVP goal

Validate this statement:

> Two people in different locations can use E-moment to create a photo strip that feels like they captured the moment together.

The MVP also supports a solo session. We will not build live video calling in the MVP; that is a future feature, not a limitation of the production product.

### MVP user flow

1. A user opens E-moment and starts a photo session.
2. They choose **Solo** or **Together**.
3. For a shared session, they create a private room and send an invite link.
4. Participants enter the room, grant camera permission, and choose a frame.
5. Everyone confirms they are ready.
6. The app runs a synchronized countdown and captures four photos from each participant.
7. Photos are uploaded and combined into a final photo strip.
8. Participants see the reveal screen and can download the strip.
9. Signed-in users can revisit and delete their past sessions.

## 3. MVP scope

### Build

- Responsive web app for current desktop and mobile browsers
- Guest access for joining a shared session
- Optional account creation for saving a gallery
- Private, unguessable room invite links
- Camera preview and local photo capture
- Solo and two-person session modes
- Real-time room presence, readiness, and countdown synchronization
- A small initial collection of photo-strip templates
- Server-side composition of a high-resolution final image
- Downloadable PNG or JPEG output
- Private gallery for signed-in users
- User-controlled photo and session deletion

### Do not build yet

- Live video or audio calls
- Payments, subscriptions, or print fulfillment
- Public galleries and social feed
- More than two participants
- Collaborative sticker editing
- Native mobile apps
- AI image generation or face filters

## 4. Technical architecture

Start as a simple npm-workspace monorepo. Keep the frontend and the initial HTTP API in one Next.js application; split services only when the product needs it.

```text
apps/
  web/                 Next.js app: UI, API routes, authentication
packages/
  ui/                  Shared UI components (added when useful)
  config/              Shared linting and TypeScript configuration
  types/               Shared domain types (added when useful)
docker/
  caddy/               Reverse-proxy configuration for production
.github/workflows/     Continuous integration and deployment workflows
docker-compose.yml     Local development services
```

### Proposed stack

| Concern | Choice | Reason |
| --- | --- | --- |
| Web application | Next.js + TypeScript | Product UI and initial backend in one deployable app |
| Styling | Tailwind CSS | Fast, consistent responsive UI development |
| Database | PostgreSQL | Reliable relational data for users, rooms, and sessions |
| ORM | Prisma or Drizzle | Type-safe queries and managed migrations |
| Real-time events | Socket.IO | Room presence, readiness, and countdown events |
| Image processing | Sharp | Fast server-side photo strip composition |
| Image storage | MinIO locally; S3-compatible storage in production | Keeps large media outside PostgreSQL |
| Authentication | Auth.js | Works well with Next.js and can be self-hosted |
| Local orchestration | Docker Compose | Reproducible local environment and Docker learning |
| Production proxy | Caddy | Automatic HTTPS with straightforward configuration |
| CI/CD | GitHub Actions + Docker image registry | Automated checks and VPS deployments |

### Important design principle

The live camera preview and the final photos are different concerns. Each device captures a high-quality local image and uploads it. Any future video call is only for shared presence; it should not determine the output image quality.

## 5. Data model (first version)

- `User`: authenticated account and profile details
- `Room`: private session room, invite token, status, expiry, host
- `RoomParticipant`: a user or guest participating in a room
- `Session`: selected template, capture state, timestamps, generated result
- `Photo`: original upload metadata and storage key
- `PhotoStrip`: generated output metadata and storage key

All photos and outputs must be private by default. Database records store metadata and storage keys; the image files live in object storage.

## 6. Development milestones

### Milestone 0 — Foundation

**Outcome:** A reproducible development environment and a healthy deployment baseline.

- Initialize npm workspaces and the Next.js application
- Create Next.js application in `apps/web`
- Add TypeScript, linting, formatting, and a basic test setup
- Add Dockerfiles and Docker Compose services for web, PostgreSQL, and MinIO
- Add environment-variable examples and onboarding documentation
- Add a minimal GitHub Actions workflow for linting, type checking, and tests

### Milestone 1 — Product shell and visual direction

**Outcome:** A polished clickable product shell.

- Establish colors, type, spacing, and responsive layout
- Create landing page, session setup, room lobby, camera, reveal, and gallery screens
- Create initial photo-strip templates and a template picker
- Ensure the core screens work well on phone-sized displays

### Milestone 2 — Solo photo box

**Outcome:** A solo user can create and download a photo strip.

- Request camera access and display local preview
- Implement timed multi-shot capture
- Upload captured images safely
- Compose the selected template on the server
- Show and download the final strip
- Handle permission denial, upload failure, and retake flows clearly

### Milestone 3 — Shared sessions

**Outcome:** Two remote participants make one strip together.

- Create private rooms and invite links
- Show participant join and ready status in real time
- Start a shared, server-authoritative countdown
- Coordinate capture slots and upload tracking
- Compose one output from both participants' photos
- Expire inactive rooms and invalidate old invite links

### Milestone 4 — Accounts, gallery, and privacy

**Outcome:** Users can safely retain control of their memories.

- Add sign-up and sign-in
- Save completed sessions in a private gallery
- Allow download and permanent deletion of sessions and photos
- Define photo-retention rules for guest sessions
- Add a privacy policy, terms, and in-product consent copy

### Milestone 5 — Production readiness

**Outcome:** E-moment runs reliably on the VPS.

- Create production Docker Compose configuration
- Configure Caddy, domain routing, and HTTPS
- Use managed S3-compatible storage or secure MinIO production storage
- Run database migrations safely during deployments
- Add application health checks and structured logs
- Automate PostgreSQL and media-storage backups
- Add uptime/error monitoring
- Perform a security and privacy review before inviting external testers

### Milestone 6 — Private beta and iteration

**Outcome:** Real users validate the experience.

- Invite a small group of solo users, friends, and LDR couples
- Observe completion rate, image quality, and drop-off points
- Ask whether the session felt shared and memorable
- Fix the highest-impact reliability and usability issues
- Decide which post-MVP feature to build from user evidence

## 7. CI/CD learning path

### Continuous integration

Every pull request should automatically:

1. Install dependencies using a locked pnpm version.
2. Run formatting/lint checks.
3. Run TypeScript type checking.
4. Run unit tests.
5. Build the web application.

### Continuous deployment

On a merge to `main`:

1. Build a versioned Docker image.
2. Push it to GitHub Container Registry.
3. Connect to the VPS using a restricted deployment SSH key.
4. Pull the tagged image and run database migrations.
5. Restart services with Docker Compose.
6. Check the application health endpoint.
7. Retain the previous image tag for rollback.

We will begin with a manual VPS deployment once, so each component is understood, then automate that exact workflow in GitHub Actions.

## 8. Security and privacy requirements

- Serve the entire app only over HTTPS in production.
- Use short-lived, cryptographically random room tokens.
- Never make original photos publicly addressable by default.
- Use short-lived signed upload/download URLs when using object storage.
- Validate file type, dimensions, and upload size server-side.
- Rate-limit room creation and upload endpoints.
- Let users permanently delete photos and generated outputs.
- Store only the minimum personal data necessary.
- Back up data securely and periodically test restoration.
- Do not log private invite tokens, image URLs, or user photos.

## 9. Post-MVP candidates

Choose based on beta feedback, not assumptions:

- Small live video window during shared captures (WebRTC, likely via LiveKit)
- Shared stickers, notes, and decoration mode
- Themed date-night packs and prompts
- Scheduled photo sessions and reminders
- Audio notes attached to a memory
- Additional layouts for friends and groups
- Print ordering or a shareable digital postcard

## 10. Definition of success for the first beta

- A new user can complete a solo strip without help.
- Two users in different locations can complete a shared strip reliably.
- The final strip looks good on both mobile and desktop.
- Photos remain private and can be deleted by the people who created them.
- Deploying a tested `main` branch revision to the VPS is repeatable.
- At least several beta users say the shared session felt more meaningful than trading ordinary selfies.

## 11. Immediate next step

Complete Milestone 0: scaffold the monorepo, create the initial Next.js app, and add a local Docker Compose environment. After that, we will build the product shell before implementing camera and real-time functionality.
