// =========================================================================
// src/middleware/session.test.ts
// Unit tests for PKCE helpers and state key utilities.
// These tests run in a pure JS environment — no KV binding required.
// =========================================================================
import { describe, it, expect } from 'vitest'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  sessionCookieName,
} from './session.js'

// =========================================================================
// PKCE helpers
// =========================================================================
describe('generateCodeVerifier', () => {
  it('returns a non-empty string', () => {
    const v = generateCodeVerifier()
    expect(typeof v).toBe('string')
    expect(v.length).toBeGreaterThan(0)
  })

  it('returns a URL-safe base64 string (no +, /, or = characters)', () => {
    const v = generateCodeVerifier()
    expect(v).not.toMatch(/[+/=]/)
  })

  it('returns a different value each call (random)', () => {
    const a = generateCodeVerifier()
    const b = generateCodeVerifier()
    expect(a).not.toBe(b)
  })
})

describe('generateCodeChallenge', () => {
  it('returns a non-empty URL-safe base64 string', async () => {
    const verifier  = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    expect(typeof challenge).toBe('string')
    expect(challenge.length).toBeGreaterThan(0)
    expect(challenge).not.toMatch(/[+/=]/)
  })

  it('produces a deterministic output for the same verifier', async () => {
    const verifier = 'test-verifier-string-fixed'
    const c1 = await generateCodeChallenge(verifier)
    const c2 = await generateCodeChallenge(verifier)
    expect(c1).toBe(c2)
  })

  it('produces different outputs for different verifiers', async () => {
    const c1 = await generateCodeChallenge('verifier-a')
    const c2 = await generateCodeChallenge('verifier-b')
    expect(c1).not.toBe(c2)
  })
})

// =========================================================================
// Cookie name
// =========================================================================
describe('sessionCookieName', () => {
  it('returns a non-empty string', () => {
    expect(typeof sessionCookieName()).toBe('string')
    expect(sessionCookieName().length).toBeGreaterThan(0)
  })

  it('returns the same value each call', () => {
    expect(sessionCookieName()).toBe(sessionCookieName())
  })
})
