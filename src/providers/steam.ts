// =========================================================================
// src/providers/steam.ts
// Handles Steam OpenID 2.0 redirect flow.
// Steam uses OpenID 2.0 (not OAuth). There is no client secret — identity is
// verified by checking the claimed_id against Steam's OpenID endpoint.
// Avatar comes from the GetPlayerSummaries API (requires STEAM_API_KEY).
// =========================================================================

// =========================================================================
// Imports
// =========================================================================
import { SteamPlayerSchema, type SteamPlayer } from '../schemas/index.js'

// =========================================================================
// Constants
// =========================================================================
const STEAM_OPENID_URL       = 'https://steamcommunity.com/openid/login'
const STEAM_API_SUMMARIES    = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/'
const STEAM_OPENID_NS        = 'http://specs.openid.net/auth/2.0'
const STEAM_IDENTITY_BASE    = 'https://steamcommunity.com/openid/id/'

// =========================================================================
// Types
// =========================================================================
interface SteamSummariesResponse {
  response: {
    players: unknown[]
  }
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Builds the Steam OpenID 2.0 redirect URL.
 * No client secret is required — Steam verifies the identity on return.
 *
 * @param returnUrl - The full callback URL (e.g. https://worker.dev/callback/steam).
 * @returns The Steam login redirect URL.
 */
export function buildAuthUrl(returnUrl: string): string {
  const params = new URLSearchParams({
    'openid.ns':         STEAM_OPENID_NS,
    'openid.mode':       'checkid_setup',
    'openid.return_to':  returnUrl,
    'openid.realm':      new URL(returnUrl).origin,
    'openid.identity':   'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  })
  return `${STEAM_OPENID_URL}?${params.toString()}`
}

/**
 * Extracts the steamid64 from the `openid.claimed_id` query param returned
 * on the callback. The claimed_id has the form:
 * https://steamcommunity.com/openid/id/<steamid64>
 *
 * @param claimedId - The raw value of the `openid.claimed_id` query param.
 * @returns The steamid64 string, or null if the pattern doesn't match.
 */
export function extractSteamId(claimedId: string): string | null {
  if (!claimedId.startsWith(STEAM_IDENTITY_BASE)) return null
  const steamId = claimedId.slice(STEAM_IDENTITY_BASE.length)
  // Validate: steamid64 is a 17-digit numeric string
  return /^\d{17}$/.test(steamId) ? steamId : null
}

/**
 * Verifies the Steam OpenID callback by re-checking the assertion with Steam.
 * This is required because without verification an attacker could craft a fake
 * claimed_id and claim any Steam account.
 *
 * @param callbackParams - All URLSearchParams from the callback request URL.
 * @returns The verified steamid64, or throws if verification fails.
 */
export async function verifySteamCallback(
  callbackParams: URLSearchParams,
): Promise<string> {
  // Build the verification request — change mode to check_authentication
  const verifyParams = new URLSearchParams(callbackParams)
  verifyParams.set('openid.mode', 'check_authentication')

  const res  = await fetch(STEAM_OPENID_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    verifyParams.toString(),
  })
  const text = await res.text()

  // Steam returns a plain-text response; valid assertion contains "is_valid:true"
  if (!text.includes('is_valid:true')) {
    throw new Error('Steam OpenID verification failed: is_valid was not true')
  }

  const claimedId = callbackParams.get('openid.claimed_id') ?? ''
  const steamId   = extractSteamId(claimedId)
  if (!steamId) throw new Error('Steam OpenID: invalid or missing claimed_id')

  return steamId
}

// =========================================================================
// Exports
// =========================================================================

/**
 * Fetches the player summary from the Steam API for the given steamid64.
 * @param steamId - The verified steamid64.
 * @param apiKey  - The STEAM_API_KEY secret.
 * @returns A Zod-validated `SteamPlayer` object.
 */
export async function fetchPlayerSummary(
  steamId: string,
  apiKey:  string,
): Promise<SteamPlayer> {
  const url = new URL(STEAM_API_SUMMARIES)
  url.searchParams.set('key',      apiKey)
  url.searchParams.set('steamids', steamId)

  const res  = await fetch(url.toString())
  const json = await res.json() as SteamSummariesResponse

  const players = json?.response?.players
  if (!Array.isArray(players) || players.length === 0) {
    throw new Error(`Steam GetPlayerSummaries: no player found for steamid ${steamId}`)
  }

  // Validate the first player entry — throws ZodError on unexpected shape
  return SteamPlayerSchema.parse(players[0])
}
