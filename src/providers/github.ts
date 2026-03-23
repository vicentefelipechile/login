// =========================================================================
// src/providers/github.ts
// Handles GitHub OAuth 2.0 authorization and token exchange.
// GitHub does not support PKCE. Uses application/x-www-form-urlencoded for token exchange.
// =========================================================================

// =========================================================================
// Imports
// =========================================================================
import { GitHubProfileSchema, type GitHubProfile } from '../schemas/index.js'

// =========================================================================
// Constants
// =========================================================================
const GITHUB_AUTH_URL   = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL  = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL   = 'https://api.github.com/user'
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'
const GITHUB_SCOPES     = 'user:email'

// =========================================================================
// Types
// =========================================================================
interface GitHubTokenResponse {
  access_token: string
  token_type:   string
  scope:        string
}

interface GitHubEmailEntry {
  email:    string
  primary:  boolean
  verified: boolean
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Builds the GitHub OAuth authorization redirect URL.
 * @param clientId    - GitHub OAuth App client ID from env.
 * @param redirectUri - Registered callback URL.
 * @param state       - CSRF nonce stored in KV before redirect.
 * @returns The full GitHub authorization URL.
 */
export function buildAuthUrl(
  clientId:    string,
  redirectUri: string,
  state:       string,
): string {
  const params = new URLSearchParams({
    client_id:    clientId,
    redirect_uri: redirectUri,
    scope:        GITHUB_SCOPES,
    state,
  })
  return `${GITHUB_AUTH_URL}?${params.toString()}`
}

/**
 * Exchanges the authorization code for an access token.
 * @param clientId     - GitHub OAuth App client ID.
 * @param clientSecret - GitHub OAuth App client secret.
 * @param code         - The code received in the callback query params.
 * @param redirectUri  - Must match the one used in buildAuthUrl.
 * @returns The access token string.
 */
export async function exchangeCode(
  clientId:     string,
  clientSecret: string,
  code:         string,
  redirectUri:  string,
): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // GitHub requires Accept: application/json to get JSON instead of form-encoded response
      'Accept':       'application/json',
    },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      redirect_uri:  redirectUri,
    }),
  })

  const data = await res.json() as GitHubTokenResponse
  if (!data.access_token) {
    throw new Error('GitHub token exchange failed: no access_token in response')
  }
  return data.access_token
}

/**
 * Fetches the authenticated user's profile from the GitHub API.
 * If the user's email is null (set to private), falls back to fetching
 * the primary verified email from /user/emails.
 *
 * @param accessToken - A valid GitHub access token.
 * @returns A Zod-validated `GitHubProfile` object.
 */
export async function fetchProfile(accessToken: string): Promise<GitHubProfile> {
  const res  = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // GitHub API requires a User-Agent header
      'User-Agent':  'login-worker/1.0',
    },
  })
  const json = await res.json()

  // Parse with Zod — throws ZodError if the shape is unexpected
  const profile = GitHubProfileSchema.parse(json)

  // Fallback: if name or email is null, try fetching from the emails endpoint
  if (!profile.email) {
    try {
      const emailRes  = await fetch(GITHUB_EMAILS_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent':  'login-worker/1.0',
        },
      })
      const emails = await emailRes.json() as GitHubEmailEntry[]
      const primary = emails.find(e => e.primary && e.verified)
      if (primary) {
        // Return a patched copy rather than mutating the parsed object
        return { ...profile, email: primary.email }
      }
    } catch {
      // Non-fatal — proceed without email
    }
  }

  return profile
}
