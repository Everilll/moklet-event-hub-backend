# Moklet Event Hub Backend API

> Core backend API for **Moklet Event Hub**, a school event management platform built for SMK Telkom Malang. Handles dynamic event registrations, team formations with concurrency-safe transactions, role-based access control, and Excel data exports.

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8.0-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

---

## 📋 Table of Contents

- [Moklet Event Hub Backend API](#moklet-event-hub-backend-api)
  - [📋 Table of Contents](#-table-of-contents)
  - [🔍 Overview](#-overview)
    - [Key Features](#key-features)
  - [🛠 Tech Stack](#-tech-stack)
  - [🏗 Architecture](#-architecture)
    - [Role Hierarchy](#role-hierarchy)
  - [🚀 Getting Started](#-getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [🔑 Environment Variables](#-environment-variables)
  - [🗃 Database](#-database)
    - [Migrations](#migrations)
    - [Seeding](#seeding)
    - [Key Models](#key-models)
  - [📖 API Documentation](#-api-documentation)
    - [Interactive Docs (Swagger)](#interactive-docs-swagger)
    - [API Surface Overview](#api-surface-overview)
  - [📁 Project Structure](#-project-structure)
  - [🐳 Deployment](#-deployment)
    - [Docker](#docker)
    - [Railway](#railway)
  - [🤝 Contributing](#-contributing)
    - [Scripts](#scripts)

---

## 🔍 Overview

Moklet Event Hub streamlines the entire lifecycle of school events:

1. **Admin Kesiswaan** manages student master data & class rosters via Excel import/sync.
2. **OSIS/Panitia Inti** creates events, adds competition categories, and recruits event committee members.
3. **Students** browse events, register for individual competitions, or form teams using invite codes.
4. **Committee** manages participants, posts announcements, and exports registration data to Excel.

### Key Features

- 🔐 **Multi-Auth** - Google OAuth 2.0 + Email/Password with OTP verification
- 👥 **Identity Binding** - Links login accounts to verified school student records (1:1)
- 🏆 **Smart Registration** - Individual & team flows with composition rules (Free / Per-Class / Per-Angkatan)
- 🔒 **Concurrency-Safe** - Row-level locking on team join/leave to prevent race conditions
- 📊 **Excel Export** - Single-category or full-event multi-sheet exports with audit logging
- 🛡️ **RBAC** - 3 database roles + dynamic EventCommitteeMember for granular per-event access
- ☁️ **Cloud Storage** - Cloudinary integration for banners, guidebooks, avatars, and dresscode images

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript 5.7 |
| Database | PostgreSQL (Prisma Postgres) |
| ORM | Prisma 7.8 (Driver Adapter: `@prisma/adapter-pg`) |
| Auth | JWT + Passport (Google OAuth 2.0) + OTP |
| File Storage | Cloudinary |
| Excel | ExcelJS |
| Email | Nodemailer (Resend SMTP) |
| Validation | class-validator + Joi (env) |
| Rate Limiting | @nestjs/throttler |
| API Docs | Swagger / OpenAPI |
| Deployment | Docker → Railway |

---

## 🏗 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend   │────▶│  NestJS API  │────▶│ PostgreSQL  │
│  (Mobile/Web)│◀────│  (REST+JWT)  │◀────│  (Prisma)   │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │  Cloudinary  │
                    │  (Files/CDN) │
                    └──────────────┘
```

### Role Hierarchy

```
👑 ADMIN_KESISWAAN  →  Master data, system settings, create PANITIA accounts
    🦅 PANITIA      →  Create events, recruit committee, global announcements
        👷 Committee →  Manage assigned events (SISWA + EventCommitteeMember)
            🎒 SISWA →  Browse, register, form teams
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22
- **PostgreSQL** database (or use [Prisma Postgres](https://www.prisma.io/postgres))
- **Cloudinary** account (for file uploads)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Everilll/moklet-event-hub-backend.git
cd moklet-event-hub-backend

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env
# Then fill in your actual values (see Environment Variables section)

# 4. Generate Prisma Client
npx prisma generate

# 5. Run database migrations
npx prisma migrate deploy

# 6. Seed initial data (Admin account + System Settings)
npx prisma db seed

# 7. Start development server
npm run start:dev
```

The API will be available at `http://localhost:3000` and Swagger docs at `http://localhost:3000/docs`.

---

## 🔑 Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# JWT
JWT_SECRET="your-64-char-hex-secret"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
GOOGLE_ALLOWED_HD="student.smktelkom-mlg.sch.id"

# OTP
OTP_LENGTH=6
OTP_TTL_SECONDS=300
OTP_MAX_REQUESTS_PER_WINDOW=5
OTP_WINDOW_SECONDS=600

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=20

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# SMTP (Email)
SMTP_HOST="smtp.resend.com"
SMTP_PORT=465
SMTP_USER="resend"
SMTP_PASSWORD="re_xxx"
SMTP_FROM="Moklet Event Hub <no-reply@yourdomain.com>"

# Seed Data
SEED_ADMIN_EMAIL="admin@school.sch.id"
SEED_ADMIN_PASSWORD="your-admin-password"

# CORS
FRONTEND_URL="http://localhost:3001"
```

---

## 🗃 Database

### Migrations

```bash
# Create a new migration after schema changes
npx prisma migrate dev --name your_migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database (⚠️ destructive)
npx prisma migrate reset
```

### Seeding

The seed script (`src/auth/seed.prisma.ts`) creates:
- One `ADMIN_KESISWAAN` account (credentials from env vars)
- One `SystemSetting` record (initial academic year & angkatan)

```bash
npx prisma db seed
```

### Key Models

| Model | Purpose |
|---|---|
| `Account` | User login (email, role, JWT) |
| `Student` | School master data (name, class, angkatan) |
| `Class` | Master class list (grade + name) |
| `Event` | School events (Moklet Cup, etc.) |
| `Category` | Competition branches within an event |
| `Team` | Team rooms with invite codes |
| `TeamMember` | Team membership (with leader flag) |
| `Registration` | Anti-duplicate registration (unique: student + category) |
| `EventCommitteeMember` | Per-event committee assignment |
| `EventSchedule` | Daily schedule with dresscode info |
| `Announcement` | Global or event-scoped announcements |
| `ExportLog` | Audit trail for Excel downloads |
| `SystemSetting` | Academic year & angkatan config |

---

## 📖 API Documentation

### Interactive Docs (Swagger)

Start the server and visit: **[http://localhost:3000/docs](http://localhost:3000/docs)**

### API Surface Overview

| Module | Endpoints | Description |
|---|---|---|
| **Auth** | 12 | Google OAuth, Email register/login, OTP, Identity Binding |
| **Students** | 13 | CRUD, Excel import/sync, avatar upload, manual bind |
| **Classes** | 6 | CRUD + Bulk create |
| **System Setting** | 2 | Get/Update academic year config |
| **Events** | 7 | CRUD, status, banner & guidebook upload |
| **Categories** | 4 | CRUD competition branches |
| **Schedules** | 5 | CRUD + dresscode image upload |
| **Committee** | 3 | Add/list/remove event committee members |
| **Announcements** | 5 | CRUD (global & event-scoped) |
| **Teams** | 6 | Create, join, lock, leave, disqualify, detail |
| **Registrations** | 2 | Individual registration + history |
| **Export** | 2 | Excel download (per-category & per-event) |

**Total: 67 endpoints**

---

## 📁 Project Structure

```
src/
├── auth/                    # OAuth, JWT, OTP, Identity Binding
│   ├── strategies/          # jwt.strategy, google.strategy
│   ├── otp/                 # OTP service (rate-limited)
│   ├── guards/              # GoogleAuthGuard
│   └── dto/
├── students/                # Master Data CRUD + Excel import/sync
├── classes/                 # Master Class CRUD + Bulk
├── system-setting/          # Academic year & angkatan management
├── events/                  # Event CRUD + banner/guidebook upload
│   ├── categories/          # Competition branch CRUD
│   ├── schedules/           # Daily schedule + dresscode
│   └── committee/           # Event committee member management
├── announcements/           # Global & event-scoped announcements
├── teams/                   # Team lifecycle (create/join/lock/leave)
├── registrations/           # Individual registration + anti-dupe
├── export/                  # Excel generation + audit log
├── upload/                  # Shared Cloudinary upload service
├── prisma/                  # Global PrismaModule/Service
├── common/
│   ├── guards/              # JwtAuthGuard, RolesGuard
│   ├── decorators/          # @Roles(), @CurrentUser()
│   ├── filters/             # GlobalExceptionFilter, PrismaExceptionFilter
│   ├── interceptors/        # TransformInterceptor, LoggerInterceptor
│   ├── pipes/               # ValidationPipe config
│   ├── hashing/             # HashingService (scrypt)
│   ├── config/              # Joi env validation
│   └── dto/                 # PaginationDto
├── app.module.ts
└── main.ts
```

---

## 🐳 Deployment

### Docker

The project includes an optimized multi-stage `Dockerfile`:

```bash
# Build and run locally with Docker
docker build -t moklet-event-hub .
docker run -p 3000:3000 --env-file .env moklet-event-hub
```

### Railway

The app is deployed on Railway with the following startup sequence:

```
npx prisma migrate deploy → npx prisma db seed → node dist/src/main.js
```

> **Note:** The NestJS server binds to `0.0.0.0` for Docker/Railway compatibility.

---

## 🤝 Contributing

1. Create your feature branch from `main`
2. Each team member works in their own module folder to avoid merge conflicts
3. Run `npm run test` before pushing
4. Create a Pull Request with a descriptive title

### Scripts

```bash
npm run start:dev      # Development (watch mode)
npm run build          # Production build
npm run test           # Run unit tests
npm run lint           # Lint & fix
```
