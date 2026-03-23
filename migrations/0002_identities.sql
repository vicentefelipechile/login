-- =========================================================================
-- migrations/0002_identities.sql
-- One row per linked OAuth provider account.
-- A single user can have multiple identities (e.g. Google + Discord).
-- =========================================================================

CREATE TABLE user_identities (
    id           TEXT    PRIMARY KEY,             -- nanoid
    user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider     TEXT    NOT NULL,                -- "google" | "discord" | "github" | "steam" | "twitter"
    provider_sub TEXT    NOT NULL,                -- provider's unique user ID (sub / steamid64 / etc.)
    email        TEXT,
    display_name TEXT,
    avatar_url   TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),

    UNIQUE (provider, provider_sub)               -- one identity per provider per user
);

CREATE INDEX idx_identities_user_id ON user_identities (user_id);
CREATE INDEX idx_identities_lookup  ON user_identities (provider, provider_sub);
