# Creative By Dr. Shakil [creativebydrshakil.com]

**Creative By Dr. Shakil** is a full-featured medical education and online learning platform built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Supabase (PostgreSQL)**. It features role-based app dashboards for **Students**, **Teachers**, and **Admins**, custom enterprise-grade JWT authentication, active session management, video streaming, quiz/MCQ study suites, and Cloudflare Edge worker deployment support.

---

## 🌟 Key Features

### 🎓 Student Experience
- **Course Catalog & Enrollment**: Browse medical courses, view detailed curriculum breakdowns, and enroll with manual or bKash payment options.
- **Interactive Video Player**: Built with Vidstack React featuring dynamic watermark protection, playback speeds, resolution toggling, and progress tracking.
- **Study & MCQ Engine**: Practice mode and timed exam mode for medical MCQs with real-time feedback, subject categorization, and performance history.
- **Session & Device Security**: Single or limited active device session control with automatic hijack prevention and device fingerprinting.

### 👨‍🏫 Teacher Portal
- **Course Builder**: Drag-and-drop course module scheduling and video lecture management.
- **Video Library**: Centralized video node organization and Hostinger CDN file uploads.
- **Quiz & Question Bank**: Rich text (TinyMCE) quiz creator with medical image support, question categorization, and explanatory answers.
- **Student Analytics**: Track student enrollment, course progress, and quiz submission statistics.

### 🛡️ Admin Suite
- **Platform Analytics**: Dashboard metrics for total revenue, active students, course sales, and active user sessions.
- **Teacher & Student Management**: Role management, modal-driven teacher invitation, password resets, and student course access grants.
- **Payment & Order Approvals**: Verify manual transactions, bKash automated payment configuration, and order log processing.
- **Security & Device Control**: View active user sessions, terminate unauthorized logins, manage banned user lists, and receive security alerts via Telegram.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL over HTTPS API via `@supabase/supabase-js`)
- **Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/) via `@opennextjs/cloudflare` & [Wrangler](https://developers.cloudflare.com/workers/wrangler/)
- **Authentication**: Enterprise JWT Auth using `jose`, HTTP-only secure cookies, and Client Device Fingerprinting
- **UI & Styling**: CSS Modules, Vanilla CSS Design System with Light/Dark Theme Support, [Framer Motion](https://www.framer.com/motion/), [Lucide Icons](https://lucide.dev/)
- **Media & Content**: [Vidstack React](https://vidstack.io/), TinyMCE Editor, Hostinger Storage CDN, `jspdf` & `html2canvas` for certificates
- **Integrations**: [Resend API](https://resend.com/) (Transactional Emails), Telegram Bot API (Security Alerts & Logs)

---

## 📁 Project Structure

```text
src/
├── app/
│   ├── (auth)/             # Login, Register, Forgot Password
│   ├── admin/              # Admin Dashboard pages
│   ├── api/                # Protected & Public REST API routes
│   ├── courses/            # Public Course Listing & Details
│   ├── dashboard/          # Student Dashboard & Course Player
│   ├── study/              # MCQ Practice & Exam Area
│   └── teacher/            # Teacher Dashboard & Course Builder
├── components/
│   ├── Admin/              # Admin Management UI components
│   ├── Auth/               # Auth Modals & Form components
│   ├── ContentProtection/  # Video Watermarking & Anti-Piracy layers
│   ├── DashboardShell/     # Responsive Multi-Role Sidebar & Shell
│   ├── Student/            # Student Dashboard UI & Progress widgets
│   ├── Study/              # MCQ Engine & Quiz components
│   ├── Teacher/            # Course Builder & Video Node tools
│   └── UI/                 # Reusable UI Library (Buttons, Modals, Inputs)
├── context/
│   └── AuthContext.tsx     # Global Auth State & User Session context
├── lib/
│   ├── admin-auth.ts       # Admin privilege enforcement
│   ├── auth-server.ts     # JWT payload signing & verification
│   ├── db.ts               # Supabase database client instantiation
│   ├── session-manager.ts  # Device fingerprinting & session tracking
│   └── telegram.ts         # Telegram alert dispatching
└── types/
    └── supabase.ts         # Supabase TypeScript schema definitions
```

---

## ⚙️ Environment Variables

Create `.env.local` or set configuration environment variables in your deployment environment:

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Base HTTPS URL of your Supabase instance. |
| `SUPABASE_ANON_KEY` | Public anonymous API key for public content queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin and write operations. |
| `JWT_SECRET` | Cryptographic secret key used to sign session JWTs. |
| `JWT_EXPIRES_IN` | Token expiration duration (e.g., `7d`). |
| `RESEND_API_KEY` | Resend API key for transactional emails. |
| `RESEND_FROM_EMAIL` | Verified sender email address. |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the web application. |
| `TELEGRAM_BOT_TOKEN` | Bot API token for security notifications. |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID for administrative log alerts. |
| `NEXT_PUBLIC_FILE_URL` | CDN / Hostinger base URL for media file storage. |
| `HOSTINGER_UPLOAD_TOKEN` | Authorization token for Hostinger file upload endpoints. |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+
- **npm**: v10+
- **Supabase Project**: A valid Supabase database instance

### 2. Installation
```bash
npm install
```

### 3. Database Schema Setup
Generate database types or run schema updates on Supabase:
```bash
# Generate TypeScript definitions for Supabase schema
npm run db:types
```

### 4. Running Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## ☁️ Deployment

### Edge Deployment (Cloudflare Workers)
This project is optimized for Cloudflare Workers using OpenNext:

```bash
# Build Cloudflare worker bundle
npm run build:worker

# Preview worker locally
npm run preview

# Deploy to Cloudflare Workers via Wrangler
npm run deploy
```

### Node.js Production Build
```bash
npm run build
npm start
```

---

## 🔒 Security & Protection

- **JWT Session Binding**: Session tokens are cryptographically bound to client device hashes to prevent token hijacking.
- **Dynamic Video Watermarking**: Displays student email/ID overlays dynamically across streaming videos to prevent screen recording piracy.
- **Banned User Enforcement**: Edge-level request rejection for banned accounts.

---

## 📝 License & Repository

- **Repository**: [https://github.com/ihkokil/CreativeByDrShakil](https://github.com/ihkokil/CreativeByDrShakil)
- **Website**: [https://creativebydrshakil.com](https://creativebydrshakil.com)
