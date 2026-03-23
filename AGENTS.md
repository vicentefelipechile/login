# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |
| `npm test` | Run unit tests (vitest vmForks) |
| `npx wrangler d1 migrations apply login --local` | Apply D1 migrations locally |
| `npx wrangler d1 migrations apply login` | Apply D1 migrations to production |

Run `wrangler types` after changing bindings in `wrangler.jsonc`.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

---

# Project: login

OAuth 2.0 / OpenID Connect educational demo. Stack: **Hono + D1 + KV + Zod** on Cloudflare Workers.

## Key Architecture Rules

- **KV (`OAUTH_STATE`)** — used ONLY for short-lived `state:<nonce>` entries (TTL 300 s) during the OAuth redirect leg. Never store session data in KV.
- **D1 (`DB`)** — stores `users`, `user_identities`, and `sessions`. All authenticated sessions live here.
- **No `SELECT *`** anywhere in the codebase. Always name each column explicitly.
- **Zod parse at every trust boundary** — all provider API responses and request bodies must pass through a schema in `src/schemas/index.ts` before use.
- **PKCE** (S256) is required for Google and Twitter. `generateCodeVerifier` / `generateCodeChallenge` live in `src/middleware/session.ts`.
- **Zod is pinned** at `=4.3.6` in `package.json`. Do not upgrade it without a dedicated commit and changelog review.

## Bindings (wrangler.jsonc)

| Binding | Type | Purpose |
|---------|------|---------|
| `OAUTH_STATE` | KV Namespace | OAuth state / code_verifier (TTL 300 s) |
| `DB` | D1 Database | Users, identities, sessions |
| `ASSETS` | Fetcher | Static files from `./public/` |
| `BASE_URL` | Var | Worker origin (e.g. `https://login.*.workers.dev`) |

## Secrets (set via `wrangler secret put`)

`GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET`  
`DISCORD_CLIENT_ID` · `DISCORD_CLIENT_SECRET`  
`GITHUB_CLIENT_ID` · `GITHUB_CLIENT_SECRET`  
`TWITTER_CLIENT_ID` · `TWITTER_CLIENT_SECRET`  
`STEAM_API_KEY`

## Provider Notes

| Provider | PKCE | Token endpoint auth |
|----------|------|---------------------|
| Google | S256 (required) | `application/x-www-form-urlencoded` |
| Discord | Not supported | `application/x-www-form-urlencoded` |
| GitHub | Not supported | `application/x-www-form-urlencoded` + `Accept: application/json` |
| Steam | N/A (OpenID 2.0) | Server-side `check_authentication` POST |
| Twitter | S256 (required) | HTTP Basic Auth (`clientId:clientSecret`) |

## File Conventions

Every `.ts` source file must start with a section header block:

```ts
// =========================================================================
// src/path/to/file.ts
// One-line description.
// =========================================================================
```

Sections must appear in this order: **Imports → Constants → Types → Helpers → Exports**.  
Every exported function must have a JSDoc comment. No magic strings or numbers — extract to the Constants section.

## Testing

Tests are colocated next to their source file (`*.test.ts`). Run with:

```bash
npm test          # watch mode
npm test -- --run # single run (CI)
```

Unit tests use `vitest` with the `vmForks` pool. They cover pure functions only (URL builders, schema parsing, PKCE math, username generation). Integration tests against real D1/KV bindings require `wrangler dev`.
