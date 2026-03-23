// =========================================================================
// src/schemas/index.test.ts
// Tests for all Zod schemas — each schema is tested with a valid payload
// and at least one invalid payload to confirm rejection.
// =========================================================================
import { describe, it, expect } from 'vitest'
import {
  GoogleProfileSchema,
  DiscordProfileSchema,
  GitHubProfileSchema,
  SteamPlayerSchema,
  TwitterProfileSchema,
  UpdateProfileSchema,
} from './index.js'

// =========================================================================
// GoogleProfileSchema
// =========================================================================
describe('GoogleProfileSchema', () => {
  const valid = {
    sub:     '1234567890',
    email:   'user@example.com',
    name:    'Test User',
    picture: 'https://example.com/photo.jpg',
  }

  it('parses a valid Google id_token payload', () => {
    expect(() => GoogleProfileSchema.parse(valid)).not.toThrow()
  })

  it('rejects a payload missing sub', () => {
    const { sub: _sub, ...rest } = valid
    expect(() => GoogleProfileSchema.parse(rest)).toThrow()
  })

  it('rejects an invalid email', () => {
    expect(() => GoogleProfileSchema.parse({ ...valid, email: 'not-an-email' })).toThrow()
  })

  it('rejects an invalid picture URL', () => {
    expect(() => GoogleProfileSchema.parse({ ...valid, picture: 'not-a-url' })).toThrow()
  })
})

// =========================================================================
// DiscordProfileSchema
// =========================================================================
describe('DiscordProfileSchema', () => {
  const valid = {
    id:       '123456789012345678',
    username: 'TestUser',
    email:    'user@example.com',
    avatar:   'abc123hash',
  }

  it('parses a valid Discord profile', () => {
    expect(() => DiscordProfileSchema.parse(valid)).not.toThrow()
  })

  it('allows avatar to be null', () => {
    expect(() => DiscordProfileSchema.parse({ ...valid, avatar: null })).not.toThrow()
  })

  it('allows email to be missing (optional)', () => {
    const { email: _email, ...rest } = valid
    expect(() => DiscordProfileSchema.parse(rest)).not.toThrow()
  })

  it('rejects a payload missing id', () => {
    const { id: _id, ...rest } = valid
    expect(() => DiscordProfileSchema.parse(rest)).toThrow()
  })
})

// =========================================================================
// GitHubProfileSchema
// =========================================================================
describe('GitHubProfileSchema', () => {
  const valid = {
    id:         12345,
    login:      'testuser',
    name:       'Test User',
    email:      'user@example.com',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345',
  }

  it('parses a valid GitHub profile', () => {
    expect(() => GitHubProfileSchema.parse(valid)).not.toThrow()
  })

  it('allows name and email to be null', () => {
    expect(() => GitHubProfileSchema.parse({ ...valid, name: null, email: null })).not.toThrow()
  })

  it('rejects a string id (should be number)', () => {
    expect(() => GitHubProfileSchema.parse({ ...valid, id: '12345' })).toThrow()
  })

  it('rejects an invalid avatar_url', () => {
    expect(() => GitHubProfileSchema.parse({ ...valid, avatar_url: 'not-a-url' })).toThrow()
  })
})

// =========================================================================
// SteamPlayerSchema
// =========================================================================
describe('SteamPlayerSchema', () => {
  const valid = {
    steamid:     '76561198000000001',
    personaname: 'SteamUser',
    avatarfull:  'https://avatars.steam.example.com/full.jpg',
  }

  it('parses a valid Steam player object', () => {
    expect(() => SteamPlayerSchema.parse(valid)).not.toThrow()
  })

  it('rejects a payload missing personaname', () => {
    const { personaname: _p, ...rest } = valid
    expect(() => SteamPlayerSchema.parse(rest)).toThrow()
  })

  it('rejects an invalid avatarfull URL', () => {
    expect(() => SteamPlayerSchema.parse({ ...valid, avatarfull: 'not-a-url' })).toThrow()
  })
})

// =========================================================================
// TwitterProfileSchema
// =========================================================================
describe('TwitterProfileSchema', () => {
  const valid = {
    data: {
      id:                '987654321',
      name:              'Twitter User',
      username:          'twitteruser',
      profile_image_url: 'https://pbs.twimg.com/profile_images/photo.jpg',
    },
  }

  it('parses a valid Twitter profile', () => {
    expect(() => TwitterProfileSchema.parse(valid)).not.toThrow()
  })

  it('allows profile_image_url to be absent', () => {
    const { data: { profile_image_url: _img, ...dataRest } } = valid
    expect(() => TwitterProfileSchema.parse({ data: dataRest })).not.toThrow()
  })

  it('rejects a payload missing data.id', () => {
    const { data: { id: _id, ...dataRest } } = valid
    expect(() => TwitterProfileSchema.parse({ data: dataRest })).toThrow()
  })
})

// =========================================================================
// UpdateProfileSchema
// =========================================================================
describe('UpdateProfileSchema', () => {
  it('accepts only display_name', () => {
    expect(() => UpdateProfileSchema.parse({ display_name: 'New Name' })).not.toThrow()
  })

  it('accepts only username', () => {
    expect(() => UpdateProfileSchema.parse({ username: 'valid_user123' })).not.toThrow()
  })

  it('accepts both fields', () => {
    expect(() => UpdateProfileSchema.parse({ display_name: 'Name', username: 'valid_u' })).not.toThrow()
  })

  it('rejects empty object (at least one field required)', () => {
    expect(() => UpdateProfileSchema.parse({})).toThrow()
  })

  it('rejects username with invalid chars (uppercase)', () => {
    expect(() => UpdateProfileSchema.parse({ username: 'BadUser' })).toThrow()
  })

  it('rejects username that is too short (< 3 chars)', () => {
    expect(() => UpdateProfileSchema.parse({ username: 'ab' })).toThrow()
  })

  it('rejects username that is too long (> 32 chars)', () => {
    expect(() => UpdateProfileSchema.parse({ username: 'a'.repeat(33) })).toThrow()
  })

  it('rejects display_name that is empty string', () => {
    expect(() => UpdateProfileSchema.parse({ display_name: '' })).toThrow()
  })
})
