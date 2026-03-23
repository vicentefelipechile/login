// =========================================================================
// src/middleware/session.ts
// KV-backed OAuth state helpers and PKCE utilities.
// KV is used ONLY for the short-lived state/code_verifier pair during the
// OAuth redirect leg. Authenticated sessions live in D1 (see src/db/users.ts).
// =========================================================================

// =========================================================================
// Constants
// =========================================================================
const STATE_TTL_SECONDS   = 300          // 5 minutes — OAuth state validity window
const STATE_KEY_PREFIX     = 'state:'    // KV key pattern: state:<nonce>
const SESSION_COOKIE_NAME  = 'session'   // HttpOnly cookie that holds the D1 session ID
const CODE_VERIFIER_LENGTH = 64          // bytes of entropy for PKCE code_verifier

// =========================================================================
// Types
// =========================================================================
export interface StoredState {
  provider:      string
  code_verifier?: string
  created_at:    number  // unix epoch ms
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Generates a cryptographically random URL-safe base64 string of `byteLen` bytes.
 * Used for both the OAuth state nonce and PKCE code_verifier.
 */
function randomUrlSafe(byteLen: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLen))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// =========================================================================
// PKCE helpers
// =========================================================================

/**
 * Generates a random code_verifier for PKCE (RFC 7636).
 * @returns A URL-safe base64 string of 64 random bytes.
 */
export function generateCodeVerifier(): string {
  return randomUrlSafe(CODE_VERIFIER_LENGTH)
}

/**
 * Derives the code_challenge from a code_verifier using SHA-256 (S256 method).
 * @param verifier - The plain-text code_verifier generated earlier.
 * @returns Base64url-encoded SHA-256 digest of the verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data     = encoder.encode(verifier)
  const digest   = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// =========================================================================
// State management (KV)
// =========================================================================

/**
 * Generates a random state nonce, persists it in KV with a 5-minute TTL,
 * and returns the nonce so it can be appended to the provider redirect URL.
 *
 * @param kv           - The OAUTH_STATE KV namespace binding.
 * @param provider     - The provider name (e.g. "google").
 * @param codeVerifier - Optional PKCE code_verifier to store alongside the state.
 * @returns The opaque state string to include in the authorization URL.
 */
export async function generateState(
  kv:            KVNamespace,
  provider:      string,
  codeVerifier?: string,
): Promise<string> {
  const state = randomUrlSafe(32)
  const value: StoredState = {
    provider,
    code_verifier: codeVerifier,
    created_at:    Date.now(),
  }
  // Store with TTL so abandoned OAuth flows don't accumulate in KV
  await kv.put(`${STATE_KEY_PREFIX}${state}`, JSON.stringify(value), {
    expirationTtl: STATE_TTL_SECONDS,
  })
  return state
}

/**
 * Reads and deletes the KV entry for the given state nonce.
 * Deletion is intentional — state can only be consumed once (replay prevention).
 *
 * @param kv    - The OAUTH_STATE KV namespace binding.
 * @param state - The state nonce received in the OAuth callback query params.
 * @returns The stored `StoredState` object, or `null` if expired / not found.
 */
export async function consumeState(
  kv:    KVNamespace,
  state: string,
): Promise<StoredState | null> {
  const key  = `${STATE_KEY_PREFIX}${state}`
  const raw  = await kv.get(key)
  if (!raw) return null

  // Delete immediately so the same state cannot be replayed
  await kv.delete(key)
  return JSON.parse(raw) as StoredState
}

// =========================================================================
// Cookie helpers
// =========================================================================

/**
 * Returns the name of the session cookie used for authenticated requests.
 * Centralised so all code refers to the same constant.
 */
export function sessionCookieName(): string {
  return SESSION_COOKIE_NAME
}
