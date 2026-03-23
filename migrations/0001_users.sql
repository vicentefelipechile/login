-- =========================================================================
-- migrations/0001_users.sql
-- Core user table. Each real person is exactly one row here.
-- username is URL-safe and unique; display_name is free-form and non-unique.
-- =========================================================================

CREATE TABLE users (
    id           TEXT    PRIMARY KEY,             -- nanoid / uuid
    username     TEXT    NOT NULL UNIQUE,         -- e.g. "vicentefc"  (URL-safe, unique)
    display_name TEXT    NOT NULL,                -- e.g. "Vicente F." (free text, non-unique)
    avatar_url   TEXT,                            -- last seen avatar from provider (or custom)
    email        TEXT,                            -- may be NULL if provider doesn't share it
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email    ON users (email);
