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
- Neon Database (PostgreSQL)

## Environment Variables

Create or update `.env.local` or `.env` in the project root.

| Variable | Required | Description |
| --- | --- | --- |
| NEON_DATABASE_URL | Yes | PostgreSQL connection string for the database (Neon). |
| NEON_DIRECT_URL | Yes | Direct PostgreSQL connection string for database schema migrations. |
| JWT_SECRET | Yes | Secret used to sign and verify JWT authentication tokens. |
| JWT_EXPIRES_IN | No | JWT token expiration window (e.g. `7d`). |
| RESEND_API_KEY | Yes | Resend API key used to send emails. |
| RESEND_FROM_EMAIL | Yes | The sender email address registered with Resend. |
| NEXTAUTH_URL | Yes | NextAuth client application base URL. |
| NEXTAUTH_SECRET | Yes | Cryptographic secret for signing NextAuth session hashes. |
| GOOGLE_CLIENT_ID | Yes | Client ID for Google OAuth provider. |
| GOOGLE_CLIENT_SECRET| Yes | Client Secret for Google OAuth provider. |
| APP_URL | Yes | Base URL of the application. |
| NEXT_PUBLIC_APP_URL | Yes | Public-facing client-accessible application base URL. |
| TELEGRAM_BOT_TOKEN | Yes | API token for your Telegram Bot integration. |
| TELEGRAM_CHAT_ID | Yes | Target Telegram Chat ID(s) (comma-separated for multiples). |
| NEXT_PUBLIC_FILE_URL | Yes | Custom Hostinger CDN / storage CDN base URL for file uploads. |
| HOSTINGER_UPLOAD_TOKEN| Yes | Secure upload token for Hostinger file storage updates. |

Example:

```env
# Neon Database
NEON_DATABASE_URL="postgresql://user:pass@host.neon.tech/neondb?sslmode=require"
NEON_DIRECT_URL="postgresql://user:pass@host.neon.tech/neondb?sslmode=require"

# Authentication
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Resend Email API
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="Creative by Dr. Shakil <no-reply@creativebydrshakil.com>"

# NextAuth / Google OAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_nextauth_secret"
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# App
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Telegram Integration
TELEGRAM_BOT_TOKEN="your_bot_token_here"
TELEGRAM_CHAT_ID="your_chat_id_here"

# Hostinger Storage Upload Variables
NEXT_PUBLIC_FILE_URL="https://your-public-cdn-or-domain.com"
HOSTINGER_UPLOAD_TOKEN="your_upload_token"
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
