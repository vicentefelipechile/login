// =========================================================================
// src/providers/steam.test.ts
// Tests for Steam OpenID helpers: buildAuthUrl, extractSteamId.
// =========================================================================
import { describe, it, expect } from 'vitest'
import { buildAuthUrl, extractSteamId } from './steam.js'

describe('Steam buildAuthUrl', () => {
  it('returns a URL pointing to the Steam OpenID endpoint', () => {
    const url = buildAuthUrl('https://worker.dev/callback/steam?state=abc')
    expect(url).toContain('steamcommunity.com/openid/login')
  })

  it('includes openid.mode=checkid_setup', () => {
    const url    = buildAuthUrl('https://worker.dev/callback/steam?state=abc')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('openid.mode')).toBe('checkid_setup')
  })

  it('includes openid.return_to with the correct return URL', () => {
    const returnUrl = 'https://worker.dev/callback/steam?state=abc'
    const url       = buildAuthUrl(returnUrl)
    const parsed    = new URL(url)
    expect(parsed.searchParams.get('openid.return_to')).toBe(returnUrl)
  })
})

describe('Steam extractSteamId', () => {
  it('extracts a valid steamid64 from a claimed_id URL', () => {
    const claimedId = 'https://steamcommunity.com/openid/id/76561198000000001'
    expect(extractSteamId(claimedId)).toBe('76561198000000001')
  })

  it('returns null for a claimed_id that does not start with the expected prefix', () => {
    expect(extractSteamId('https://evil.com/openid/id/76561198000000001')).toBeNull()
  })

  it('returns null for a claimed_id with a non-numeric steamid', () => {
    const claimedId = 'https://steamcommunity.com/openid/id/notanumber'
    expect(extractSteamId(claimedId)).toBeNull()
  })

  it('returns null for a steamid that is not 17 digits', () => {
    const claimedId = 'https://steamcommunity.com/openid/id/12345'
    expect(extractSteamId(claimedId)).toBeNull()
  })
})
