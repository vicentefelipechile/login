-- =========================================================================
-- migrations/0003_sessions.sql
-- Browser sessions stored in D1 for persistence and server-side revocation.
-- KV is only used for short-lived OAuth state/code_verifier pairs.
-- =========================================================================

CREATE TABLE sessions (
    id         TEXT    PRIMARY KEY,               -- cryptographically random token → goes in cookie
    user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider   TEXT    NOT NULL,                  -- which provider was used to log in this session
    user_agent TEXT,
    ip         TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL                   -- unixepoch() + 86400 * 30  (30-day sessions)
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
