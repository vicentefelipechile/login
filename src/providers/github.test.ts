// =========================================================================
// src/providers/github.test.ts
// Tests for GitHub OAuth helpers: buildAuthUrl, exchangeCode, fetchProfile.
// =========================================================================
import { describe, it, expect } from 'vitest'
import { buildAuthUrl } from './github.js'

describe('GitHub buildAuthUrl', () => {
  it('returns a URL pointing to GitHub', () => {
    const url = buildAuthUrl('client123', 'https://worker.dev/callback/github', 'state_abc')
    expect(url).toContain('github.com/login/oauth/authorize')
  })

  it('includes client_id, redirect_uri, scope, and state as query params', () => {
    const url = buildAuthUrl('client123', 'https://worker.dev/callback/github', 'state_abc')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('client_id')).toBe('client123')
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://worker.dev/callback/github')
    expect(parsed.searchParams.get('scope')).toBe('user:email')
    expect(parsed.searchParams.get('state')).toBe('state_abc')
  })
})
