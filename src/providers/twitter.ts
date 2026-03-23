// =========================================================================
// src/providers/twitter.ts
// Handles Twitter / X OAuth 2.0 PKCE authorization and token exchange.
// Twitter requires PKCE (S256) and Elevated access on the developer portal.
// =========================================================================

// =========================================================================
// Imports
// =========================================================================
import { TwitterProfileSchema, type TwitterProfile } from '../schemas/index.js'

// =========================================================================
// Constants
// =========================================================================
const TWITTER_AUTH_URL  = 'https://twitter.com/i/oauth2/authorize'
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const TWITTER_USER_URL  = 'https://api.twitter.com/2/users/me?user.fields=profile_image_url'
const TWITTER_SCOPES    = 'tweet.read users.read offline.access'

// =========================================================================
// Types
// =========================================================================
interface TwitterTokenResponse {
  access_token:  string
  token_type:    string
  expires_in?:   number
  refresh_token?: string
  scope:         string
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Builds the Twitter OAuth 2.0 authorization URL with PKCE challenge.
 * @param clientId      - Twitter OAuth 2.0 client ID from env.
 * @param redirectUri   - Registered callback URL.
 * @param state         - CSRF nonce stored in KV before redirect.
 * @param codeChallenge - PKCE S256 challenge derived from code_verifier.
 * @returns The full Twitter authorization URL.
 */
export function buildAuthUrl(
  clientId:      string,
  redirectUri:   string,
  state:         string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             clientId,
    redirect_uri:          redirectUri,
    scope:                 TWITTER_SCOPES,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${TWITTER_AUTH_URL}?${params.toString()}`
}

// =========================================================================
// Exports
// =========================================================================

/**
 * Exchanges the authorization code for an access token using PKCE.
 * Twitter requires Basic Auth using clientId:clientSecret for this request.
 *
 * @param clientId     - Twitter OAuth 2.0 client ID.
 * @param clientSecret - Twitter OAuth 2.0 client secret.
 * @param code         - Authorization code from callback query params.
 * @param redirectUri  - Must match the one used in buildAuthUrl.
 * @param codeVerifier - PKCE verifier stored in KV alongside the state.
 * @returns The access token string.
 */
export async function exchangeCode(
  clientId:     string,
  clientSecret: string,
  code:         string,
  redirectUri:  string,
  codeVerifier: string,
): Promise<string> {
  // Twitter requires HTTP Basic Auth for the token endpoint
  const credentials = btoa(`${clientId}:${clientSecret}`)

  const res = await fetch(TWITTER_TOKEN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  const data = await res.json() as TwitterTokenResponse
  if (!data.access_token) {
    throw new Error('Twitter token exchange failed: no access_token in response')
  }
  return data.access_token
}

/**
 * Fetches the authenticated user's profile from the Twitter v2 API.
 * @param accessToken - A valid Twitter user access token.
 * @returns A Zod-validated `TwitterProfile` object.
 */
export async function fetchProfile(accessToken: string): Promise<TwitterProfile> {
  const res  = await fetch(TWITTER_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json = await res.json()
  // Validate at the trust boundary — throws ZodError on unexpected shape
  return TwitterProfileSchema.parse(json)
}
