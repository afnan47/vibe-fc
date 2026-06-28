-- Supabase Schema for FIFA Vibe Taste Checker Cache Table
-- Copy and paste this into the Supabase SQL Editor and run it.

CREATE TABLE IF NOT EXISTS track_cache (
    track_id VARCHAR(22) PRIMARY KEY, -- Spotify IDs are exactly 22 chars
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    danceability REAL NOT NULL,        -- 0.0 to 100.0 scale (scaled from Spotify's 0-1)
    energy REAL NOT NULL,              -- 0.0 to 100.0 scale
    valence REAL NOT NULL,             -- 0.0 to 100.0 scale
    tempo REAL NOT NULL,               -- BPM
    acousticness REAL NOT NULL,        -- 0.0 to 100.0 scale
    loudness REAL NOT NULL,            -- Decibels (dB)
    vibe_score REAL NOT NULL,          -- Calculated vibe match percentage (0.0% to 100.0%)
    preview_url TEXT,                  -- 30-second MP3 preview URL
    cover_art_url TEXT,                -- Album cover art URL
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index the track_id for instant B-Tree point-lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_track_id ON track_cache(track_id);
