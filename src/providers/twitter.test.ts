// =========================================================================
// src/providers/twitter.test.ts
// Tests for Twitter PKCE helpers: buildAuthUrl.
// =========================================================================
import { describe, it, expect } from 'vitest'
import { buildAuthUrl } from './twitter.js'

describe('Twitter buildAuthUrl', () => {
  it('returns a URL pointing to Twitter OAuth 2.0 authorize endpoint', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/twitter', 'state_x', 'challenge_y')
    expect(url).toContain('twitter.com/i/oauth2/authorize')
  })

  it('includes PKCE params (code_challenge, code_challenge_method=S256)', () => {
    const url    = buildAuthUrl('cid', 'https://worker.dev/callback/twitter', 'state_x', 'challenge_y')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge_y')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('includes required Twitter scopes', () => {
    const url    = buildAuthUrl('cid', 'https://worker.dev/callback/twitter', 'state_x', 'challenge_y')
    const parsed = new URL(url)
    const scope  = parsed.searchParams.get('scope') ?? ''
    expect(scope).toContain('tweet.read')
    expect(scope).toContain('users.read')
  })

  it('includes state', () => {
    const url    = buildAuthUrl('cid', 'https://worker.dev/callback/twitter', 'my_state', 'challenge')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('state')).toBe('my_state')
  })
})
