<div align="center">
  <img src="https://raw.githubusercontent.com/Ns81000/STORE/main/public/store-icon-transparent.svg" width="88" height="88" alt="STORE Logo" />
  <h1>STORE</h1>
  <p><strong>Personal Link Vault and Command Center</strong></p>
  <p>A minimalist, self-hosted bookmarks workstation with server-side rendering, cryptographic access control, and instant link execution.</p>

  <p>
    <a href="https://github.com/Ns81000/STORE"><img src="https://img.shields.io/badge/repository-Ns81000%2FSTORE-ff6161?style=flat-square&labelColor=07080a" alt="Repository" /></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/react-v19-57c1ff?style=flat-square&labelColor=07080a" alt="React 19" /></a>
    <a href="https://tanstack.com/start"><img src="https://img.shields.io/badge/framework-TanStack_Start-59d499?style=flat-square&labelColor=07080a" alt="TanStack Start" /></a>
    <a href="https://turso.tech"><img src="https://img.shields.io/badge/database-Turso_libSQL-ffc533?style=flat-square&labelColor=07080a" alt="Turso libSQL" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/styling-Tailwind_v4-d78bff?style=flat-square&labelColor=07080a" alt="Tailwind CSS v4" /></a>
    <a href="https://vercel.com"><img src="https://img.shields.io/badge/deployment-Vercel-ffffff?style=flat-square&labelColor=07080a" alt="Vercel" /></a>
  </p>
</div>

---

## Overview

STORE is a single-tenant personal link repository and dashboard. Designed around high-density navigation, keyboard productivity, and refined dark-mode aesthetics, STORE eliminates clutter while offering structured multi-row actions, live metadata preview scraping, drag-and-drop hierarchy management, and an integrated SVG mark library.

---

## Key Features

### Structure and Organization
* **Section Hierarchy:** Segment links into dedicated workspaces with custom slug routing (`/s/:slug`), custom marks, and tone tokens (`ember`, `moss`, `steel`, `sand`, `rose`).
* **Multi-Action Cards:** Each asset card supports a primary trigger (`Open` or `Copy`) plus up to 6 custom sub-action rows for secondary endpoints, APIs, deep links, or terminal commands.
* **Drag-and-Drop Reordering:** Real-time tactile reordering of both sections and cards powered by `@dnd-kit`.
* **Centralized SVG Mark Library:** Manage, preview, search, and assign custom vector icons across sections, cards, and action rows without storage caps.

### Security and Authentication
* **Single-Password Cryptographic Lock:** Password authentication using bcrypt hashing with a cost factor of 12. Plaintext credentials are never saved.
* **Sliding Cryptographic Sessions:** Sealed 90-day sessions with automatic extension on activity and instant lock capability.
* **Brute-Force Rate Limiting:** Automatic IP-hashed attempt tracking with a sliding 15-minute cooldown lockout upon repeated failed attempts.
* **SSRF-Protected Scraper:** Metadata fetcher with private IP/loopback address filtering to safely generate OpenGraph titles, preview imagery, and fallback screenshots.

### User Experience and Performance
* **Zero Layout Shift SSR:** Built on TanStack Start and Vinxi with server-side rendered state hydration.
* **Progressive Web App (PWA):** Service worker caching, offline state banner, and install prompts across mobile and desktop.
* **Dual View Modes:** Seamlessly switch between rich visual preview cards and ultra-compact list rows.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & SSR** | TanStack Start, TanStack Router, TanStack Query, Nitro |
| **UI & Styling** | React 19, Tailwind CSS v4, Lucide Icons, Radix UI Primitives |
| **Database** | Turso (libSQL / SQLite dialect) via `@libsql/client` |
| **Validation & Security** | Zod, bcryptjs, Web Crypto API |
| **Interactions** | `@dnd-kit` (Core, Sortable, Utilities) |
| **Package Manager** | `pnpm` exclusively |

---

## Self-Hosting Guide

This walkthrough covers deploying your own instance of STORE using **Turso** for the database and **Vercel** for hosting.

### 1. Prerequisites
Ensure you have the following installed on your local machine:
* **Node.js:** `v22.0.0` or higher
* **pnpm:** `v10.0.0` or higher (`corepack enable pnpm`)
* **Turso CLI:** Installed via `curl -sSfL https://get.tur.so/install.sh | bash` (or use the [Turso Web Console](https://turso.tech/))
* **Git**

---

### 2. Clone the Repository

```bash
git clone https://github.com/Ns81000/STORE.git
cd STORE
pnpm install
```

---

### 3. Set Up the Turso Database

1. **Log in to Turso:**
   ```bash
   turso auth login
   ```

2. **Create a new database:**
   ```bash
   turso db create store-vault
   ```

3. **Get the Database URL:**
   ```bash
   turso db show store-vault --url
   ```
   *Example output:* `libsql://store-vault-yourusername.turso.io`

4. **Create an Authentication Token:**
   ```bash
   turso db tokens create store-vault
   ```
   *Copy the generated token string.*

---

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Populate the `.env` file with your credentials:

```env
# Turso Connection
TURSO_DATABASE_URL="libsql://store-vault-yourusername.turso.io"
TURSO_AUTH_TOKEN="your_turso_auth_token_here"

# Security & Sessions
AUTH_PASSWORD_HASH=""
SESSION_SECRET=""
```

#### Generate `AUTH_PASSWORD_HASH`:
Run the interactive hash utility:
```bash
pnpm hash-password
```
Enter your desired password. The script will generate a bcrypt hash with cost factor 12. Copy the output into `AUTH_PASSWORD_HASH` in your `.env`.

#### Generate `SESSION_SECRET`:
Generate a 32-byte cryptographic random hex string:
```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```
Paste the generated string into `SESSION_SECRET`.

---

### 5. Initialize Database Schema

Run the database migration script to construct the tables and indices:

```bash
pnpm db:init
```

*Expected output:*
```text
Tables: asset_rows, assets, login_attempts, preview_cache, sections, svg_library
Indices: asset_rows_asset_id_idx, assets_section_sort_idx, login_attempts_ip_time_idx, sections_sort_idx, svg_library_sort_idx
Schema initialized.
```

---

### 6. Local Development

Start the local development server:

```bash
pnpm dev
```

Open `http://localhost:3000` in your browser. Enter your configured password to unlock the store.

---

### 7. Deploying to Vercel

#### Method A: Deploy via Vercel CLI

1. Install and log in to Vercel CLI:
   ```bash
   pnpm dlx vercel login
   ```

2. Link project and deploy:
   ```bash
   pnpm dlx vercel
   ```

3. Add environment variables to Vercel:
   ```bash
   pnpm dlx vercel env add TURSO_DATABASE_URL production
   pnpm dlx vercel env add TURSO_AUTH_TOKEN production
   pnpm dlx vercel env add AUTH_PASSWORD_HASH production
   pnpm dlx vercel env add SESSION_SECRET production
   ```

4. Deploy to Production:
   ```bash
   pnpm dlx vercel --prod
   ```

#### Method B: Deploy via Vercel Dashboard

1. Push your repository to GitHub.
2. Navigate to [Vercel Dashboard](https://vercel.com/new) and click **Import Project**.
3. Under **Environment Variables**, add the four required keys:
   * `TURSO_DATABASE_URL`
   * `TURSO_AUTH_TOKEN`
   * `AUTH_PASSWORD_HASH`
   * `SESSION_SECRET`
4. Click **Deploy**.

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|---|---|---|---|
| `TURSO_DATABASE_URL` | Yes | libSQL connection URL from Turso | `libsql://store-db-user.turso.io` |
| `TURSO_AUTH_TOKEN` | Yes | Authentication bearer token for Turso | `eyJhbGciOi...` |
| `AUTH_PASSWORD_HASH` | Yes | Bcrypt hash (cost 12) of master password | `$2a$12$...` |
| `SESSION_SECRET` | Yes | Secret key for session cookie encryption | `64-character hex string` |
| `NODE_ENV` | No | Runtime environment (`development` / `production`) | `production` |

---

## Database Architecture

STORE uses a normalized libSQL schema optimized for single-trip batching:

```
+------------------+       +-------------------+       +--------------------+
|     SECTIONS     | 1   * |      ASSETS       | 1   * |     ASSET_ROWS     |
+------------------+<----->+-------------------+<----->+--------------------+
| id (PK)          |       | id (PK)           |       | id (PK)            |
| name             |       | section_id (FK)   |       | asset_id (FK)      |
| slug (UNIQUE)    |       | url               |       | label              |
| color_token      |       | title             |       | url                |
| svg_url          |       | icon_svg_url      |       | mode (open/copy)   |
| sort_order       |       | preview_enabled   |       | svg_url            |
+------------------+       | action_mode       |       | sort_order         |
                           | sort_order        |       +--------------------+
                           +-------------------+
                                     | 1
                                     | 1
                           +-------------------+
                           |   PREVIEW_CACHE   |
                           +-------------------+
                           | asset_id (PK, FK) |
                           | og_title          |
                           | og_image_url      |
                           | og_site_name      |
                           | status            |
                           | fetched_at        |
                           | error_message     |
                           +-------------------+

+------------------+       +-------------------+
|   SVG_LIBRARY    |       |  LOGIN_ATTEMPTS   |
+------------------+       +-------------------+
| id (PK)          |       | id (PK, AUTO)     |
| name             |       | ip_hash           |
| url              |       | attempted_at      |
| sort_order       |       +-------------------+
+------------------+
```

---

## Useful Scripts

```bash
# Start local development server
pnpm dev

# Build for production
pnpm build

# Run type check
pnpm typecheck

# Run linter
pnpm lint

# Initialize or update database schema
pnpm db:init

# Generate password hash
pnpm hash-password
```

---

## License

MIT License. Designed and maintained by [Ns81000](https://github.com/Ns81000).
