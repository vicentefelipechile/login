// =========================================================================
// src/schemas/index.ts
// All Zod schemas for provider API responses and request bodies.
// Every external data boundary passes through one of these schemas before use.
// =========================================================================

// =========================================================================
// Imports
// =========================================================================
import { z } from 'zod'

// =========================================================================
// Provider payload schemas
// =========================================================================

/**
 * Google id_token payload (after JWT base64-decode of the payload segment).
 * Validated after exchanging the authorization code for tokens.
 */
export const GoogleProfileSchema = z.object({
  sub:     z.string(),
  email:   z.string().email(),
  name:    z.string(),
  picture: z.string().url(),
})

/**
 * Discord /users/@me response.
 * avatar may be null if the user has no custom avatar.
 */
export const DiscordProfileSchema = z.object({
  id:       z.string(),
  username: z.string(),
  email:    z.string().email().optional(),
  avatar:   z.string().nullable(),
})

/**
 * GitHub /user response.
 * name and email may be null if the user has hidden them on GitHub.
 */
export const GitHubProfileSchema = z.object({
  id:         z.number(),
  login:      z.string(),
  name:       z.string().nullable(),
  email:      z.string().email().nullable(),
  avatar_url: z.string().url(),
})

/**
 * Steam GetPlayerSummaries/v2 player object (one entry in response.players[]).
 */
export const SteamPlayerSchema = z.object({
  steamid:     z.string(),
  personaname: z.string(),
  avatarfull:  z.string().url(),
})

/**
 * Twitter /2/users/me response (with user.fields=profile_image_url).
 */
export const TwitterProfileSchema = z.object({
  data: z.object({
    id:                z.string(),
    name:              z.string(),
    username:          z.string(),
    profile_image_url: z.string().url().optional(),
  }),
})

// =========================================================================
// Request body schemas
// =========================================================================

/**
 * PATCH /me request body.
 * At least one of display_name or username must be present.
 */
export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1).max(64).optional(),
  username:     z.string().regex(/^[a-z0-9_]{3,32}$/).optional(),
}).refine(data => data.display_name !== undefined || data.username !== undefined, {
  message: 'At least one field must be provided',
})

// =========================================================================
// Inferred types
// =========================================================================
export type GoogleProfile  = z.infer<typeof GoogleProfileSchema>
export type DiscordProfile = z.infer<typeof DiscordProfileSchema>
export type GitHubProfile  = z.infer<typeof GitHubProfileSchema>
export type SteamPlayer    = z.infer<typeof SteamPlayerSchema>
export type TwitterProfile = z.infer<typeof TwitterProfileSchema>
export type UpdateProfile  = z.infer<typeof UpdateProfileSchema>
