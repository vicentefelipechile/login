// =========================================================================
// src/providers/google.test.ts
// Tests for Google OAuth helpers: buildAuthUrl (PKCE params).
// =========================================================================
import { describe, it, expect } from 'vitest'
import { buildAuthUrl } from './google.js'

describe('Google buildAuthUrl', () => {
  it('returns a URL pointing to Google accounts', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/google', 'state_x', 'challenge_y')
    expect(url).toContain('accounts.google.com/o/oauth2/v2/auth')
  })

  it('includes PKCE params (code_challenge, code_challenge_method=S256)', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/google', 'state_x', 'challenge_y')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge_y')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('requests openid email profile scopes', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/google', 'state_x', 'challenge_y')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('scope')).toBe('openid email profile')
  })

  it('includes state', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/google', 'my_state', 'challenge_y')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('state')).toBe('my_state')
  })
})
