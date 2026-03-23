// =========================================================================
// src/providers/discord.ts
// Handles Discord OAuth 2.0 authorization and token exchange.
// Discord does not support PKCE. Avatar URL is constructed from CDN pattern.
// =========================================================================

// =========================================================================
// Imports
// =========================================================================
import { DiscordProfileSchema, type DiscordProfile } from '../schemas/index.js'

// =========================================================================
// Constants
// =========================================================================
const DISCORD_AUTH_URL  = 'https://discord.com/api/oauth2/authorize'
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token'
const DISCORD_USER_URL  = 'https://discord.com/api/users/@me'
const DISCORD_CDN_BASE  = 'https://cdn.discordapp.com/avatars'
const DISCORD_SCOPES    = 'identify email'

// =========================================================================
// Types
// =========================================================================
interface DiscordTokenResponse {
  access_token:  string
  token_type:    string
  expires_in:    number
  refresh_token: string
  scope:         string
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Builds the Discord OAuth authorization redirect URL.
 * @param clientId    - Discord application client ID from env.
 * @param redirectUri - Registered callback URL.
 * @param state       - CSRF nonce stored in KV before redirect.
 * @returns The full Discord authorization URL.
 */
export function buildAuthUrl(
  clientId:    string,
  redirectUri: string,
  state:       string,
): string {
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         DISCORD_SCOPES,
    state,
  })
  return `${DISCORD_AUTH_URL}?${params.toString()}`
}

/**
 * Constructs the CDN URL for a Discord user's avatar.
 * Returns null if the user has no custom avatar (uses default Discord avatar instead).
 *
 * @param userId - Discord user ID (snowflake).
 * @param avatar - The avatar hash returned by the API, or null.
 * @returns Full avatar URL or null.
 */
export function buildAvatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null
  return `${DISCORD_CDN_BASE}/${userId}/${avatar}.png`
}

// =========================================================================
// Exports
// =========================================================================

/**
 * Exchanges the authorization code for an access token.
 * @param clientId     - Discord application client ID.
 * @param clientSecret - Discord application client secret.
 * @param code         - Authorization code from callback query params.
 * @param redirectUri  - Must match the one used in buildAuthUrl.
 * @returns The access token string.
 */
export async function exchangeCode(
  clientId:     string,
  clientSecret: string,
  code:         string,
  redirectUri:  string,
): Promise<string> {
  const res = await fetch(DISCORD_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
    }),
  })

  const data = await res.json() as DiscordTokenResponse
  if (!data.access_token) {
    throw new Error('Discord token exchange failed: no access_token in response')
  }
  return data.access_token
}

/**
 * Fetches the authenticated user's profile from the Discord API.
 * @param accessToken - A valid Discord access token.
 * @returns A Zod-validated `DiscordProfile` object.
 */
export async function fetchProfile(accessToken: string): Promise<DiscordProfile> {
  const res  = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json()
  // Validate at the trust boundary — throws ZodError on unexpected shape
  return DiscordProfileSchema.parse(json)
}
