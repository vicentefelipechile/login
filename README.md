# Login — OAuth 2.0 Demo

An educational single-page application demonstrating how OAuth 2.0 / OpenID Connect login flows work across multiple identity providers, built on Cloudflare Workers.

![Stack](https://img.shields.io/badge/runtime-Cloudflare_Workers-orange?style=flat-square)
![Framework](https://img.shields.io/badge/framework-Hono-blueviolet?style=flat-square)
![Language](https://img.shields.io/badge/language-TypeScript-blue?style=flat-square)
[![CI](https://github.com/vicentefelipechile/login/actions/workflows/main.yml/badge.svg)](https://github.com/vicentefelipechile/login/actions/workflows/main.yml)

---

## What it does

- Shows a dark-theme login page with **5 branded provider buttons**
- Initiates **real OAuth redirects** to each provider
- Exchanges the authorization code, validates the profile with **Zod**, upserts the user to **Cloudflare D1**, and sets a session cookie
- After login, renders a **profile card** (avatar, display name, username, provider badge) with an inline edit form
- Supports **EN / ES** language switching

---

## Supported Providers

| Provider | Protocol | Notes |
|----------|----------|-------|
| Google | OAuth 2.0 + OIDC | PKCE (S256) · `openid email profile` |
| Discord | OAuth 2.0 | `identify email` |
| GitHub | OAuth 2.0 | `user:email` · private email fallback |
| Steam | OpenID 2.0 | No client secret · server-side assertion verification |
| Twitter / X | OAuth 2.0 | PKCE required · Elevated access needed |

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Language | TypeScript |
| Validation | Zod (pinned `=4.3.6`) |
| Frontend | Vanilla HTML / CSS / JS |
| Session state (OAuth) | Cloudflare KV (TTL 5 min) |
| Database | Cloudflare D1 (users, identities, sessions) |
| Tests | Vitest (vmForks pool) |

---

## Project Structure

```
login/
├── src/
│   ├── index.ts                  # Hono app — all routes
│   ├── providers/
│   │   ├── google.ts / .test.ts
│   │   ├── discord.ts / .test.ts
│   │   ├── github.ts / .test.ts
│   │   ├── steam.ts / .test.ts
│   │   └── twitter.ts / .test.ts
│   ├── middleware/
│   │   └── session.ts / .test.ts # KV state helpers + PKCE
│   ├── db/
│   │   └── users.ts / .test.ts   # D1 query helpers
│   └── schemas/
│       └── index.ts / .test.ts   # Zod schemas
├── migrations/
│   ├── 0001_users.sql
│   ├── 0002_identities.sql
│   └── 0003_sessions.sql
├── public/
│   ├── index.html                # Login page + profile card
│   ├── style.css
│   ├── script.js                 # Session fetch + i18n
│   └── orbs.js                   # Animated background
├── wrangler.jsonc
└── vitest.config.mts
```

---

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Login page (or profile card if session active) |
| `GET` | `/auth/:provider` | Build authorization URL → redirect to provider |
| `GET` | `/callback/:provider` | Exchange code → upsert user → set cookie → `/` |
| `GET` | `/me` | Return session user as JSON |
| `PATCH` | `/me` | Update `display_name` / `username` |
| `GET` | `/logout` | Invalidate session → clear cookie → `/` |

---

## Data Model

```
users  1 ──< user_identities   (one user, many linked providers)
users  1 ──< sessions          (one user, many active sessions)
```

- **KV** — short-lived `state:<nonce>` entries (TTL 300 s) during the OAuth redirect leg only
- **D1** — persistent users, identities, and 30-day browser sessions

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create Cloudflare resources

```bash
npx wrangler kv namespace create OAUTH_STATE
npx wrangler d1 create login
```

Paste the resulting IDs into `wrangler.jsonc`.

### 3. Apply migrations

```bash
# Local dev
npx wrangler d1 migrations apply login --local

# Production
npx wrangler d1 migrations apply login
```

### 4. Set secrets

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put TWITTER_CLIENT_ID
npx wrangler secret put TWITTER_CLIENT_SECRET
npx wrangler secret put STEAM_API_KEY
```

### 5. Run locally

```bash
npm run dev   # → http://localhost:8787
```

### 6. Deploy

```bash
npm run deploy
```

---

## Tests

```bash
npm test              # run all unit tests
npm test -- --run     # single run (CI)
```

**62 tests** across 8 files covering: Zod schemas, PKCE helpers, username generation, OAuth URL builders, and provider-specific parameters.

---

## Security

- **CSRF** — `state` nonce validated on every callback before code exchange
- **PKCE** — S256 code challenge for Google and Twitter
- **Secrets** — `CLIENT_SECRET` never reaches the frontend
- **Cookies** — `HttpOnly; Secure; SameSite=Lax`
- **State TTL** — OAuth state entries expire after 5 minutes
- **Session expiry** — `expires_at > unixepoch()` checked on every authenticated request
- **No `SELECT *`** — every SQL query names its columns explicitly

---

## License

[MIT](LICENSE)
