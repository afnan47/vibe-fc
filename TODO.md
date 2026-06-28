# FUT Vibe FC: Remaining Tasks & Future Enhancements 📋

This document outlines the remaining roadmap and potential features for the **FIFA Vibe Taste Checker** project, categorized by priority and domain.

---

## 🚀 Priority 1: Interactive, Visual & Coverage Enhancements

- [x] **Song Coverage Expansion (Hugging Face Sharded Lake + Live API Fallback)**
  - Shard the massive 256M track `ozefe/spotify_audio_features` dataset into lowercase 2-character partition keys using DuckDB.
  - Query the Hugging Face sharded dataset remotely via HTTP Range Requests using DuckDB `httpfs`.
  - Added a live API fallback (RapidAPI) for newly released songs (2025/2026).
  
- [x] **Interactive Sliders (Sandbox Mode)**
  - Add a "Tuning Sandbox" panel in the UI with 6 sliders matching our core attributes: Danceability, Energy, Valence, BPM, Acousticness, and Loudness.
  - Let users adjust these sliders in real-time and query the model locally to see how the vibe score updates instantly.
  
- [x] **Audio Preview Integration**
  - Extract the `preview_url` and cover art from public Spotify embed player hydration scripts.
  - Embed a circular play/pause overlay audio player on the card and thumbnail images in the scout history list.

---

## 🛠️ Priority 2: Playlist & Caching Features


- [ ] **Global Community Leaderboard**
  - Fetch top-rated scouted songs from the Supabase cache to display a "Community Scout Leaderboard".
  - Show the highest-scoring non-official tracks submitted by users.

---

## 🔒 Priority 3: Technical Polish & Reliability

- [ ] **Custom Soundtrack Playlist Builder**
  - Allow users to "Add to Custom FIFA Soundtrack" when a song scores high (e.g. Starting XI tier).
  - Export this custom playlist as a Spotify Playlist (requires OAuth2 authorization) or download it as a standard CSV format.
- [ ] **Robust Error Decoupling**
  - Improve the frontend error boundary in case the backend server or ReccoBeats API is offline.
  - Implement caching in the browser's `localStorage` (Tier 0 cache) for track features so repeated lookups of the same track ID don't query the backend at all.

- [ ] **Dockerization**
  - Write a `Dockerfile` for the FastAPI backend and React frontend to containerize the app for simple, one-command production deployments.
