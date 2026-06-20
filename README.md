# Creative By Dr. Shakil [creativebydrshakil.com]

Creative By Dr. Shakil is a Next.js learning platform with role-based dashboards for students, teachers, and admins. It includes authentication, profile management, teacher management, and a responsive dashboard shell designed for both desktop and mobile.

## Highlights

- Built with Next.js App Router, React, and TypeScript.
- PostgreSQL + Prisma for persistent user and role data.
- JWT-based authentication with secure cookie session support.
- Role-aware app shell for student, teacher, and admin dashboards.
- Admin teacher management APIs and modal-driven invite flow.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Prisma ORM

- bcryptjs + jsonwebtoken
- Lucide icons + Framer Motion

## Project Structure

```text
src/
	app/
		api/
			auth/
			admin/
			user/
		dashboard/            # Student dashboard
		teacher/dashboard/    # Teacher dashboard
		admin/dashboard/      # Admin dashboard
	components/
		DashboardShell/       # Shared responsive dashboard shell
		Admin/
		Teacher/
	context/
		AuthContext.tsx
	lib/
		auth-server.ts
		prisma.ts
prisma/
	schema.prisma
scripts/
	seed-teachers.mjs
```

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase PostgreSQL / Neon Database

## Environment Variables

Create or update `.env.local` in the project root.

| Variable | Required | Description |
| --- | --- | --- |
| DATABASE_URL | Yes | Prisma database connection URL for app/runtime queries. |
| DIRECT_URL | Yes | Direct database URL used by Prisma for schema operations. |
| JWT_SECRET | Yes | Secret used to sign and verify auth tokens. |
| JWT_EXPIRES_IN | No | JWT expiration window (default: `7d`). |
| NODE_ENV | No | Runtime mode (`development`/`production`). |

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"
JWT_SECRET="replace-with-a-strong-secret"
JWT_EXPIRES_IN="7d"
```

## Installation

```bash
npm install
```

## Database Setup

Generate Prisma client:

```bash
npx prisma generate
```

Apply schema to your database:

```bash
npx prisma db push
```

Seed teacher accounts:

```bash
npm run seed:teachers
```

The seed script upserts demo teacher users with password `Teacher@12345`.

## Run the App

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Lint:

```bash
npm run lint
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts Next.js development server. |
| `npm run build` | Builds optimized production bundle. |
| `npm start` | Starts production server after build. |
| `npm run lint` | Runs Next.js/ESLint checks. |
| `npm run seed:teachers` | Seeds/upserts teacher accounts. |

## Core Routes

### App Pages

- `/` Home
- `/courses` Courses listing
- `/courses/[slug]` Course details
- `/study` Study/MCQ area
- `/dashboard` Student dashboard
- `/teacher/dashboard` Teacher dashboard
- `/admin/dashboard` Admin dashboard

### API Endpoints

- `POST /api/auth/register` Register student and create session token.
- `POST /api/auth/login` Login with email or phone + password.
- `POST /api/auth/logout` Clear auth cookie.
- `GET /api/auth/session` Resolve current session from bearer/cookie token.
- `POST /api/user/update-profile` Update current user profile.
- `GET /api/admin/teachers` Admin-only teacher list.
- `POST /api/admin/invite-teacher` Admin-only teacher creation with temporary password.

## Authentication Notes

- Access token is returned in responses and also set as an HTTP-only cookie (`session_token`).
- Role checks are enforced in API routes and dashboard access flows.
- For admin access, ensure a user exists with `role = admin` in the database.

## Deployment Notes

- Set all required environment variables in your hosting platform.
- Ensure database connectivity from the deployed environment.
- Run `npx prisma generate` during build and apply schema changes before first run.

## Repository

- GitHub: https://github.com/ihkokil/CreativeByDrShakil
