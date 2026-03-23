// =========================================================================
// src/db/users.test.ts
// Unit tests for the generateUsername helper.
// The full upsertUser / createSession / getSessionUser functions require
// a real D1 binding and are covered by integration tests against wrangler dev.
// =========================================================================
import { describe, it, expect } from 'vitest'
import { generateUsername } from './users.js'

describe('generateUsername', () => {
  it('lowercases the input', () => {
    const result = generateUsername('TestUser')
    expect(result).toMatch(/^[a-z0-9_]+$/)
  })

  it('replaces spaces and special chars with underscores', () => {
    const result = generateUsername('Hello World!')
    expect(result).not.toMatch(/[ !]/)
  })

  it('matches the username regex /^[a-z0-9_]{3,32}$/', () => {
    const result = generateUsername('ValidHandle')
    expect(result).toMatch(/^[a-z0-9_]{3,32}$/)
  })

  it('handles very long display names (truncates)', () => {
    const result = generateUsername('a'.repeat(100))
    expect(result.length).toBeLessThanOrEqual(32)
  })

  it('handles a display name that is all special characters', () => {
    const result = generateUsername('!!!###')
    expect(result).toMatch(/^[a-z0-9_]{3,32}$/)
  })

  it('returns unique values for the same input (suffix is random)', () => {
    const a = generateUsername('TestUser')
    const b = generateUsername('TestUser')
    expect(a).not.toBe(b)
  })
})
