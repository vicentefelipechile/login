// =========================================================================
// src/db/users.ts
// D1 query helpers for users, identities, and sessions.
// Rule: never use SELECT * — always name only the columns actually needed.
// =========================================================================

// =========================================================================
// Imports
// =========================================================================
import { nanoid } from 'nanoid'

// =========================================================================
// Constants
// =========================================================================
const SESSION_TTL_SECONDS = 2_592_000   // 30 days (60 * 60 * 24 * 30)

// =========================================================================
// Types
// =========================================================================

/** Normalized profile data extracted from any provider's response. */
export interface ProviderProfile {
  providerSub:         string
  providerDisplayName: string
  avatarUrl:           string | null
  email:               string | null
}

/** The user row joined with session metadata returned by GET /me. */
export interface SessionUser {
  id:           string
  username:     string
  display_name: string
  avatar_url:   string | null
  email:        string | null
  provider:     string
  expires_at:   number
}

// =========================================================================
// Username generation
// =========================================================================

/**
 * Derives a URL-safe username candidate from a provider handle string.
 * Lowercases, replaces non-alphanumeric characters with underscores,
 * collapses consecutive underscores, and trims leading/trailing underscores.
 * Truncates to 28 chars and appends a short random suffix to avoid collisions.
 *
 * @param handle - Raw display name or login from the provider.
 * @returns A valid `/^[a-z0-9_]{3,32}$/` username candidate.
 */
export function generateUsername(handle: string): string {
  const base = handle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20) || 'user'

  // Append 4 random alphanumeric chars to avoid collisions on first signup
  const suffix = nanoid(4).toLowerCase().replace(/[^a-z0-9]/g, 'x')
  return `${base}_${suffix}`
}

// =========================================================================
// Core DB helpers
// =========================================================================

/**
 * Upserts a user and their provider identity row.
 * If the identity already exists, refreshes the avatar_url and display_name.
 * If this is a new identity, creates both a user row and an identity row.
 *
 * @param db       - Bound D1 database instance.
 * @param provider - OAuth provider name ("google" | "discord" | etc.).
 * @param profile  - Normalized profile extracted from the provider response.
 * @returns The internal user ID (stable across sessions).
 */
export async function upsertUser(
  db:       D1Database,
  provider: string,
  profile:  ProviderProfile,
): Promise<string> {
  // 1. Check if this provider identity already exists
  const identity = await db
    .prepare(`
      SELECT id, user_id
      FROM user_identities
      WHERE provider = ? AND provider_sub = ?
    `)
    .bind(provider, profile.providerSub)
    .first<{ id: string; user_id: string }>()

  if (identity) {
    // 2a. Returning user — refresh provider metadata in case avatar/name changed
    await db
      .prepare(`
        UPDATE user_identities
        SET avatar_url = ?, display_name = ?, updated_at = unixepoch()
        WHERE id = ?
      `)
      .bind(profile.avatarUrl, profile.providerDisplayName, identity.id)
      .run()

    return identity.user_id
  }

  // 2b. New user — create user row + identity row in a logical unit
  const userId = nanoid()

  await db
    .prepare(`
      INSERT INTO users (id, username, display_name, avatar_url, email)
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      userId,
      generateUsername(profile.providerDisplayName || profile.providerSub),
      profile.providerDisplayName,
      profile.avatarUrl,
      profile.email,
    )
    .run()

  await db
    .prepare(`
      INSERT INTO user_identities (id, user_id, provider, provider_sub, email, display_name, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      nanoid(),
      userId,
      provider,
      profile.providerSub,
      profile.email,
      profile.providerDisplayName,
      profile.avatarUrl,
    )
    .run()

  return userId
}

/**
 * Creates a new session row in D1 and returns the session ID.
 * The session ID itself is used as the cookie value (cryptographically random).
 *
 * @param db        - Bound D1 database.
 * @param userId    - The internal user ID returned by `upsertUser`.
 * @param provider  - The provider used for this session's login.
 * @param userAgent - Value of the User-Agent request header (may be null).
 * @param ip        - The client IP address (may be null).
 * @returns The session ID to set in the cookie.
 */
export async function createSession(
  db:        D1Database,
  userId:    string,
  provider:  string,
  userAgent: string | null,
  ip:        string | null,
): Promise<string> {
  const sessionId = nanoid(32)
  await db
    .prepare(`
      INSERT INTO sessions (id, user_id, provider, user_agent, ip, expires_at)
      VALUES (?, ?, ?, ?, ?, unixepoch() + ?)
    `)
    .bind(sessionId, userId, provider, userAgent, ip, SESSION_TTL_SECONDS)
    .run()
  return sessionId
}

/**
 * Resolves a session cookie value to the associated user profile.
 * Returns null if the session does not exist or has expired.
 *
 * @param db        - Bound D1 database.
 * @param sessionId - The raw value from the session cookie.
 * @returns A `SessionUser` object or null.
 */
export async function getSessionUser(
  db:        D1Database,
  sessionId: string,
): Promise<SessionUser | null> {
  // Join sessions + users — only select columns the /me response exposes
  return db
    .prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.email,
             s.provider, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > unixepoch()
    `)
    .bind(sessionId)
    .first<SessionUser>()
}

/**
 * Updates the user's display_name and/or username.
 * Checks for username uniqueness before writing.
 *
 * @param db          - Bound D1 database.
 * @param userId      - The authenticated user's internal ID.
 * @param displayName - New display name (optional).
 * @param username    - New username (optional, must be globally unique).
 * @returns `"ok"` on success, `"username_taken"` if the username is already in use.
 */
export async function updateProfile(
  db:          D1Database,
  userId:      string,
  displayName: string | undefined,
  username:    string | undefined,
): Promise<'ok' | 'username_taken'> {
  if (username !== undefined) {
    // Check uniqueness — only need id to confirm collision
    const conflict = await db
      .prepare(`
        SELECT id
        FROM users
        WHERE username = ? AND id != ?
      `)
      .bind(username, userId)
      .first<{ id: string }>()

    if (conflict) return 'username_taken'
  }

  // Build the UPDATE — at least one field is guaranteed by Zod's refine
  const newUsername    = username    ?? null
  const newDisplayName = displayName ?? null

  if (newUsername !== null && newDisplayName !== null) {
    await db
      .prepare(`
        UPDATE users
        SET username = ?, display_name = ?, updated_at = unixepoch()
        WHERE id = ?
      `)
      .bind(newUsername, newDisplayName, userId)
      .run()
  } else if (newUsername !== null) {
    await db
      .prepare(`
        UPDATE users
        SET username = ?, updated_at = unixepoch()
        WHERE id = ?
      `)
      .bind(newUsername, userId)
      .run()
  } else {
    await db
      .prepare(`
        UPDATE users
        SET display_name = ?, updated_at = unixepoch()
        WHERE id = ?
      `)
      .bind(newDisplayName, userId)
      .run()
  }

  return 'ok'
}

/**
 * Deletes the session row from D1, effectively logging out the user.
 * The cookie must also be cleared on the HTTP response by the caller.
 *
 * @param db        - Bound D1 database.
 * @param sessionId - The session ID from the cookie.
 */
export async function deleteSession(
  db:        D1Database,
  sessionId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM sessions WHERE id = ?`)
    .bind(sessionId)
    .run()
}
