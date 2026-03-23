# Login — Project Blueprint

A minimal, educational single-page application demonstrating how OAuth 2.0 / OpenID Connect login flows work across multiple identity providers. The app shows the buttons, explains the flow, and completes a real redirect with persistent user profiles.

---

## 1. Goals

| Goal | Description |
|------|-------------|
| **Educational** | Show developers how each provider's login button initiates an OAuth flow |
| **Visual demo** | A clean UI with branded login buttons (Google, Discord, Steam, GitHub, Twitter/X) |
| **Portable** | Works on any Cloudflare Worker / Node / static host with minimal changes |
| **Extendable** | Easy to plug in a real provider secret and complete the full flow |

---

## 2. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | **Cloudflare Workers** | Matches your existing stack |
| Framework | **Hono** | Lightweight, typed, edge-native |
| Language | **TypeScript** | Type safety for OAuth params and validated schemas |
| Validation | **Zod** (pinned, see §15) | Runtime schema validation for request bodies and provider payloads |
| Frontend | **Vanilla HTML/CSS/JS** (single file) | Zero build step, simple to read |
| Session | **Cloudflare KV** | Store OAuth state/code_verifier between redirect legs |
| Database | **Cloudflare D1** | Persistent user profiles (username, display_name, avatar, identities) |
| Secrets | `wrangler secret` | CLIENT_ID / CLIENT_SECRET per provider |

---

## 3. Supported Providers

| Provider | Protocol | Notes |
|----------|----------|-------|
| Google | OAuth 2.0 + OIDC | Use `openid email profile` scope |
| Discord | OAuth 2.0 | Use `identify email` scope |
| GitHub | OAuth 2.0 | Use `user:email` scope |
| Steam | OpenID 2.0 | No secret needed; uses redirect verification |
| Twitter / X | OAuth 2.0 (PKCE) | Requires Elevated access on developer portal |

---

## 4. Project Structure

Test files live **colocated** next to their source file, identified by the `.test.ts`
suffix. Vitest only picks up files matching `**/*.test.ts` so source and test files
never conflict. Each test file covers only its sibling module — no cross-file tests.

```
login/
├── src/
│   ├── index.ts              # Hono app entry point
│   ├── index.test.ts         # Route integration tests (GET /, /me, /logout)
│   ├── providers/
│   │   ├── google.ts         # Google OAuth helpers
│   │   ├── google.test.ts    # Tests: buildAuthUrl, exchangeCode, profile parsing
│   │   ├── discord.ts        # Discord OAuth helpers
│   │   ├── discord.test.ts   # Tests: buildAuthUrl, avatar URL construction
│   │   ├── github.ts         # GitHub OAuth helpers
│   │   ├── github.test.ts    # Tests: buildAuthUrl, token exchange, email fallback
│   │   ├── steam.ts          # Steam OpenID helpers
│   │   ├── steam.test.ts     # Tests: redirect params, steamid64 extraction
│   │   ├── twitter.ts        # Twitter PKCE helpers
│   │   └── twitter.test.ts   # Tests: PKCE challenge generation, token exchange
│   ├── middleware/
│   │   ├── session.ts        # KV-backed state/session helpers
│   │   └── session.test.ts   # Tests: state generation, expiry, cookie parsing
│   ├── db/
│   │   ├── users.ts          # D1 query helpers (upsert, getBySession, updateProfile)
│   │   └── users.test.ts     # Tests: upsert logic, username conflict, session join
│   ├── schemas/
│   │   ├── index.ts          # All Zod schemas (provider payloads, request bodies)
│   │   └── index.test.ts     # Tests: valid + invalid payloads for every schema
│   └── ui/
│       └── index.html        # Static login page + /me profile card
├── migrations/
│   ├── 0001_users.sql
│   ├── 0002_identities.sql
│   └── 0003_sessions.sql
├── vitest.config.ts
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

---

## 5. Core Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serve the login page |
| `GET` | `/auth/:provider` | Build the authorization URL and redirect to provider |
| `GET` | `/callback/:provider` | Receive the code, exchange for token, upsert user in D1 |
| `GET` | `/me` | Return the current session user as JSON |
| `PATCH` | `/me` | Update `display_name` and/or `username` |
| `GET` | `/logout` | Clear the session cookie and invalidate session in D1 |

### Example flow (Google)

```
User clicks "Sign in with Google"
  → GET /auth/google
      → generate state + code_verifier
      → store in KV (TTL 5 min)
      → 302 → accounts.google.com/o/oauth2/v2/auth?...
  → User approves
  → GET /callback/google?code=xxx&state=yyy
      → verify state from KV
      → POST https://oauth2.googleapis.com/token  (exchange code → access_token + id_token)
      → decode id_token (JWT), extract email / name / picture / sub
      → validate payload with Zod schema
      → upsert into D1: users + user_identities
      → set session cookie (signed, HttpOnly, Secure)
      → 302 → /me
```

---

## 6. Provider Configuration Summary

### Google
```
Authorization URL : https://accounts.google.com/o/oauth2/v2/auth
Token URL         : https://oauth2.googleapis.com/token
Scopes            : openid email profile
PKCE              : optional (recommended)
Redirect URI      : https://<your-worker>.workers.dev/callback/google
Avatar field      : picture  (in id_token payload)
```

### Discord
```
Authorization URL : https://discord.com/api/oauth2/authorize
Token URL         : https://discord.com/api/oauth2/token
User API          : https://discord.com/api/users/@me
Scopes            : identify email
PKCE              : not supported
Redirect URI      : https://<your-worker>.workers.dev/callback/discord
Avatar field      : avatar  → https://cdn.discordapp.com/avatars/{id}/{avatar}.png
```

### GitHub
```
Authorization URL : https://github.com/login/oauth/authorize
Token URL         : https://github.com/login/oauth/access_token
User API          : https://api.github.com/user
Scopes            : user:email
PKCE              : not supported
Redirect URI      : https://<your-worker>.workers.dev/callback/github
Avatar field      : avatar_url
```

### Steam
```
Endpoint          : https://steamcommunity.com/openid/login
Protocol          : OpenID 2.0 (no client secret)
Identity claim    : openid.claimed_id  →  steamid64 in URL
Player summary    : https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/
Redirect URI      : https://<your-worker>.workers.dev/callback/steam
Avatar field      : avatarfull  (from GetPlayerSummaries)
```

### Twitter / X
```
Authorization URL : https://twitter.com/i/oauth2/authorize
Token URL         : https://api.twitter.com/2/oauth2/token
User API          : https://api.twitter.com/2/users/me?user.fields=profile_image_url
Scopes            : tweet.read users.read offline.access
PKCE              : required (S256)
Redirect URI      : https://<your-worker>.workers.dev/callback/twitter
Avatar field      : profile_image_url
```

---

## 7. Data Model

### Concept

Each real person is one row in `users`. A person can link multiple OAuth accounts
(e.g. Google + Discord) — these are rows in `user_identities`. Active browser
sessions are rows in `sessions` (instead of KV, for persistence and revocation).
KV is still used only for the short-lived OAuth `state` / `code_verifier` pairs.

```
users  1 ──< user_identities   (one user, many linked providers)
users  1 ──< sessions          (one user, many active sessions)
```

### Username vs Display Name

| Field | Rules | Editable |
|-------|-------|----------|
| `username` | Unique, lowercase, alphanumeric + underscores, 3–32 chars. Used in URLs / mentions. Auto-generated from provider handle on first login. | Yes (user can claim a custom one) |
| `display_name` | Non-unique, any Unicode, 1–64 chars. Shown in the UI as the friendly name. Pre-filled from provider's `name` on first login. | Yes (free edit) |

---

## 8. SQL Schema

### migrations/0001_users.sql

```sql
CREATE TABLE users (
    id           TEXT    PRIMARY KEY,             -- nanoid / uuid
    username     TEXT    NOT NULL UNIQUE,         -- e.g. "vicentefc"  (URL-safe, unique)
    display_name TEXT    NOT NULL,                -- e.g. "Vicente F." (free text, non-unique)
    avatar_url   TEXT,                            -- last seen avatar from provider (or custom)
    email        TEXT,                            -- may be NULL if provider doesn't share it
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email    ON users (email);
```

### migrations/0002_identities.sql

```sql
-- Each row = one linked OAuth provider account
CREATE TABLE user_identities (
    id           TEXT    PRIMARY KEY,             -- nanoid
    user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     TEXT    NOT NULL,                -- "google" | "discord" | "github" | "steam" | "twitter"
    provider_sub TEXT    NOT NULL,                -- provider's unique user ID (sub / steamid64 / etc.)
    email        TEXT,
    display_name TEXT,
    avatar_url   TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),

    UNIQUE (provider, provider_sub)               -- one identity per provider per user
);

CREATE INDEX idx_identities_user_id ON user_identities (user_id);
CREATE INDEX idx_identities_lookup  ON user_identities (provider, provider_sub);
```

### migrations/0003_sessions.sql

```sql
-- Browser sessions (replaces KV for the authenticated session cookie)
CREATE TABLE sessions (
    id         TEXT    PRIMARY KEY,               -- cryptographically random token → goes in cookie
    user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider   TEXT    NOT NULL,                  -- which provider was used to log in this session
    user_agent TEXT,
    ip         TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL                   -- unixepoch() + 86400 * 30  (30-day sessions)
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
```

> **KV** still holds `state:<nonce>` entries (TTL 300 s) during the OAuth redirect
> leg only. Once the callback resolves the user, the session lives in D1.

---

## 9. Key D1 Operations (pseudo-code)

> **Rule: never use `SELECT *`** — always list only the columns the caller actually needs.
> This limits data exposure and makes query intent explicit.

### Login / upsert on callback

```ts
// Look up existing identity — only the fields needed to proceed
const identity = await db
  .prepare(`
    SELECT id, user_id
    FROM user_identities
    WHERE provider = ? AND provider_sub = ?
  `)
  .bind(provider, providerSub)
  .first<{ id: string; user_id: string }>()

if (identity) {
  // Refresh avatar / display_name from provider in case they changed
  await db.prepare(`
    UPDATE user_identities
    SET avatar_url = ?, display_name = ?, updated_at = unixepoch()
    WHERE id = ?
  `).bind(avatarUrl, providerDisplayName, identity.id).run()

  userId = identity.user_id
} else {
  // First time — create user row + identity row
  userId = nanoid()

  await db.prepare(`
    INSERT INTO users (id, username, display_name, avatar_url, email)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, generateUsername(providerHandle), providerDisplayName, avatarUrl, email).run()

  await db.prepare(`
    INSERT INTO user_identities (id, user_id, provider, provider_sub, email, display_name, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(nanoid(), userId, provider, providerSub, email, providerDisplayName, avatarUrl).run()
}

// Create session row
const sessionId = nanoid(32)
await db.prepare(`
  INSERT INTO sessions (id, user_id, provider, user_agent, ip, expires_at)
  VALUES (?, ?, ?, ?, ?, unixepoch() + 2592000)
`).bind(sessionId, userId, provider, userAgent, ip).run()

setCookie(ctx, 'session', sessionId, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 2592000 })
```

### PATCH /me — update username or display_name

```ts
// Check uniqueness before writing — only need id to confirm collision
const conflict = await db
  .prepare(`
    SELECT id
    FROM users
    WHERE username = ? AND id != ?
  `)
  .bind(newUsername, userId)
  .first<{ id: string }>()

if (conflict) return ctx.json({ error: 'username_taken' }, 409)

await db.prepare(`
  UPDATE users
  SET username = ?, display_name = ?, updated_at = unixepoch()
  WHERE id = ?
`).bind(newUsername, newDisplayName, userId).run()
```

### GET /me — resolve session → user

```ts
const sessionId = getCookie(ctx, 'session')

// Only select columns the /me response actually exposes
const row = await db.prepare(`
  SELECT u.id, u.username, u.display_name, u.avatar_url, u.email,
         s.provider, s.expires_at
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.id = ? AND s.expires_at > unixepoch()
`).bind(sessionId).first<SessionUser>()

if (!row) return ctx.json({ error: 'unauthorized' }, 401)
```

---

## 10. Zod Schemas (`src/schemas/index.ts`)

Zod is used to validate all external data: provider API responses, request bodies,
and environment bindings. This ensures runtime safety at every trust boundary.

```ts
import { z } from 'zod'

// Google id_token payload (after JWT decode)
export const GoogleProfileSchema = z.object({
  sub:     z.string(),
  email:   z.string().email(),
  name:    z.string(),
  picture: z.string().url(),
})

// Discord /users/@me response
export const DiscordProfileSchema = z.object({
  id:       z.string(),
  username: z.string(),
  email:    z.string().email().optional(),
  avatar:   z.string().nullable(),
})

// GitHub /user response
export const GitHubProfileSchema = z.object({
  id:         z.number(),
  login:      z.string(),
  name:       z.string().nullable(),
  email:      z.string().email().nullable(),
  avatar_url: z.string().url(),
})

// Steam GetPlayerSummaries player object
export const SteamPlayerSchema = z.object({
  steamid:    z.string(),
  personaname: z.string(),
  avatarfull: z.string().url(),
})

// Twitter /2/users/me response
export const TwitterProfileSchema = z.object({
  data: z.object({
    id:                z.string(),
    name:              z.string(),
    username:          z.string(),
    profile_image_url: z.string().url().optional(),
  }),
})

// PATCH /me request body
export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(64).optional(),
  username:     z.string().regex(/^[a-z0-9_]{3,32}$/).optional(),
}).refine(data => data.display_name !== undefined || data.username !== undefined, {
  message: 'At least one field must be provided',
})

export type GoogleProfile  = z.infer<typeof GoogleProfileSchema>
export type DiscordProfile = z.infer<typeof DiscordProfileSchema>
export type GitHubProfile  = z.infer<typeof GitHubProfileSchema>
export type SteamPlayer    = z.infer<typeof SteamPlayerSchema>
export type TwitterProfile = z.infer<typeof TwitterProfileSchema>
export type UpdateProfile  = z.infer<typeof UpdateProfileSchema>
```

---

## 11. Code Style & Documentation Standards

All source files in the project must follow these conventions consistently.

### File header template

Every `.ts` file must begin with a section header block that identifies the file's
role, followed by clearly separated sections for imports, constants, types, and logic:

```ts
// =========================================================================
// src/providers/google.ts
// Handles Google OAuth 2.0 + OIDC authorization and token exchange.
// =========================================================================

// =========================================================================
// Imports
// =========================================================================
import { z } from 'zod'
import { GoogleProfileSchema } from '../schemas/index.js'

// =========================================================================
// Constants
// =========================================================================
const GOOGLE_AUTH_URL  = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_SCOPES    = 'openid email profile'

// =========================================================================
// Types
// =========================================================================
interface GoogleTokenResponse {
  access_token: string
  id_token:     string
  token_type:   string
  expires_in:   number
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Builds the Google authorization redirect URL.
 * @param clientId   - Google OAuth client ID from env
 * @param redirectUri - Registered callback URL
 * @param state       - CSRF nonce stored in KV
 * @param codeChallenge - PKCE S256 challenge derived from code_verifier
 */
export function buildAuthUrl(
  clientId:      string,
  redirectUri:   string,
  state:         string,
  codeChallenge: string,
): string {
  // ...
}

// =========================================================================
// Exports
// =========================================================================
export async function exchangeCode(/* ... */): Promise<GoogleProfile> {
  // ...
}
```

### Rules

- **Every exported function** must have a JSDoc comment (`/** ... */`) explaining
  its purpose, parameters, and return value.
- **Every non-trivial block** inside a function must have an inline comment
  explaining *why*, not just *what*.
- **No magic numbers or strings** — extract them to the `Constants` section with
  a descriptive name (e.g. `SESSION_TTL_SECONDS` instead of `2592000`).
- **No `SELECT *`** anywhere in the codebase. Always name each column. This rule
  applies to every raw SQL string, including one-off debug queries.
- **Zod parse at every trust boundary** — any data coming from a provider API,
  a request body, or env must pass through a schema before being used.
- **Consistent section separators** — use the `// === ... ===` style shown above
  for every file, in this order: Imports → Constants → Types → Helpers → Exports.

---

## 12. KV Schema (OAuth handshake only)

| Key pattern | Value | TTL |
|-------------|-------|-----|
| `state:<state>` | `{ provider, code_verifier?, created_at }` (JSON) | 300 s |

---

## 13. Security Checklist

- [ ] CSRF: validate `state` on every callback before exchanging the code
- [ ] PKCE: use `code_challenge` / `code_verifier` for providers that support it (Google, Twitter)
- [ ] Secrets: never expose `CLIENT_SECRET` in frontend code
- [ ] Cookie: `HttpOnly; Secure; SameSite=Lax`
- [ ] State TTL: expire state entries after 5 minutes
- [ ] Token storage: store only normalized user profile, not raw access tokens
- [ ] Username validation: enforce `/^[a-z0-9_]{3,32}$/` server-side via Zod, not just client-side
- [ ] Session expiry: check `expires_at > unixepoch()` on every authenticated request
- [ ] Expired session cleanup: `DELETE FROM sessions WHERE expires_at < unixepoch()` via Cron Trigger
- [ ] No `SELECT *`: every query names its columns explicitly

---

## 14. UI Spec

### Login page (`/`)
- Dark background, each button styled with the provider's official brand color
- Buttons include provider SVG logo + label: **"Continue with Google"**, etc.
- Short note per button: *"OAuth 2.0 + OIDC"*, *"OAuth 2.0"*, *"OpenID 2.0"*

### Profile card (`/me`)
- Avatar (circular, from `avatar_url`; fallback to initials if null)
- `display_name` — large, prominent, editable inline
- `@username` — smaller, editable inline with uniqueness check on blur
- Provider badge (which service was used to log in this session)
- "Edit" button → inline form → `PATCH /me`
- "Logout" button → `GET /logout`

---


## 15. Vitest Configuration (`vitest.config.ts`)

```ts
// =========================================================================
// vitest.config.ts
// Test runner configuration. Uses vmForks pool for unit tests so that
// globals like Request, Response, and crypto are available natively.
// For tests that need a real D1 binding, swap pool to
// @cloudflare/vitest-pool-workers and point it at wrangler.jsonc.
// =========================================================================
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run each test file in its own isolated worker fork
    pool: 'vmForks',

    // Only pick up colocated test files — never ui/ or migrations/
    include: ['src/**/*.test.ts'],
    exclude: ['src/ui/**'],

    // Show each test name in the output, not just pass/fail counts
    reporter: 'verbose',

    // Coverage report (run with: vitest --coverage)
    coverage: {
      provider: 'v8',
      include:  ['src/**/*.ts'],
      exclude:  ['src/**/*.test.ts', 'src/ui/**'],
    },
  },
})
```

> For tests that need a real D1 instance, use `@cloudflare/vitest-pool-workers`
> with a local D1 binding via `wrangler.jsonc`. For pure unit tests (schemas,
> URL builders, string helpers), the default `vmForks` pool is sufficient and faster.

---

## 16. wrangler.jsonc Skeleton

```jsonc
{
  "name": "login",
  "main": "src/index.ts",
"compatibility_date": "2026-03-10",

  "kv_namespaces": [
    {
      "binding": "OAUTH_STATE",
      "id": "<your-kv-namespace-id>"
    }
  ],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "login",
      "database_id": "<your-d1-database-id>"
    }
  ],

  "vars": {
    "BASE_URL": "https://login.<your-subdomain>.workers.dev"
  }

  // Secrets — set with: wrangler secret put <NAME>
  // GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  // DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET
  // GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
  // TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET
  // STEAM_API_KEY
  // COOKIE_SECRET  (used to sign session cookie value)
}
```

---

## 17. Key Dependencies

Zod is **pinned to an exact version** using the `=` prefix. This prevents npm from
upgrading it automatically — even with `npm update` or Renovate/Dependabot — because
Zod has a history of introducing breaking API changes between minor versions.
Any upgrade must be deliberate and reviewed manually.

```json
{
  "dependencies": {
    "hono":   "^4.12.9",
    "nanoid": "^5.1.7",
    "zod":    "=4.3.6"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "wrangler":   "^4.76.0",
    "vitest":     "^4.1.1",
    "@vitest/coverage-v8": "^4.1.1"
  }
}
```

> To upgrade Zod in the future: change the pinned version explicitly in `package.json`,
> review the changelog for breaking changes, update schemas accordingly, then commit
> the version bump as its own isolated commit.

---

## 18. Development Phases

| Phase | Scope |
|-------|-------|
| **1 — Scaffold** | Hono app, `/` route, static HTML login page with all buttons (links are `#`) |
| **2 — D1 migrations** | Run the 3 migration files, verify schema with `wrangler d1 execute` |
| **3 — Zod schemas** | Write and export all provider + request body schemas in `src/schemas/index.ts` |
| **4 — GitHub flow** | Full GitHub OAuth → Zod-validated response → upsert user → session cookie → `/me` card |
| **5 — Google + Discord** | Add OIDC/PKCE for Google, standard OAuth for Discord |
| **6 — Steam** | OpenID 2.0 redirect + GetPlayerSummaries for avatar |
| **7 — Twitter** | PKCE flow |
| **8 — Profile editing** | `PATCH /me` (Zod-validated body) for `display_name` + `username`, inline edit UI |
| **9 — Tests** | Write `.test.ts` for schemas, providers, db helpers, and session middleware |
| **10 — Polish** | Logout, session expiry cron, error pages, avatar fallback (initials) |

---

*Generated for: login · Stack: Cloudflare Workers + Hono + D1 + KV + Zod · Author: Vicente*