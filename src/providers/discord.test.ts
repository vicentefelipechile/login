// =========================================================================
// src/providers/discord.test.ts
// Tests for Discord OAuth helpers: buildAuthUrl, buildAvatarUrl.
// =========================================================================
import { describe, it, expect } from 'vitest'
import { buildAuthUrl, buildAvatarUrl } from './discord.js'

describe('Discord buildAuthUrl', () => {
  it('returns a URL pointing to Discord OAuth', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/discord', 'state_abc')
    expect(url).toContain('discord.com/api/oauth2/authorize')
  })

  it('includes identify and email scopes', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/discord', 'state_abc')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('scope')).toBe('identify email')
  })

  it('includes state', () => {
    const url = buildAuthUrl('cid', 'https://worker.dev/callback/discord', 'my_state')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('state')).toBe('my_state')
  })
})

describe('Discord buildAvatarUrl', () => {
  it('builds the correct CDN URL for a valid avatar hash', () => {
    const url = buildAvatarUrl('123456789', 'abc123hash')
    expect(url).toBe('https://cdn.discordapp.com/avatars/123456789/abc123hash.png')
  })

  it('returns null when avatar is null', () => {
    expect(buildAvatarUrl('123456789', null)).toBeNull()
  })
})
