# VibeFC — Football Soundtrack Vibe Checker ⚽🎮

VibeFC is an end-to-end web application that evaluates whether a song matches classic football gaming soundtracks using a machine learning model. It replaces heuristic algorithms with a **One-Class Support Vector Machine (OC-SVM)** model with an **RBF Kernel**, trained on 1,400+ authentic FIFA / EA FC tracks.

---

## 🏗️ High-Level System Architecture & Caching Pipeline

The application features an optimized **Fetch, Scrape & Smart-Route** caching pipeline to resolve track data and score them:

1. **Supabase Cloud DB Cache**: Instant point-lookups for previously scouted tracks, checking an in-memory LRU cache first to avoid database network hops. It stores track features, album cover art, and audio previews.
2. **Local SQLite Golden DB**: Fast offline lookup within the 1,400+ authentic FIFA training set tracks (`The Ultimate FUT Playlist.db`).
3. **Upfront Keyless Embed Scrape**: On a cache/SQLite miss, the backend fetches metadata (title, artist, cover art, preview URL, and release date) via an anonymous Spotify Embed scraper.
4. **Smart Date-Based Router**:
   * **Post-July 2025 releases**: The backend bypasses the Hugging Face dataset (since it cuts off at July 2025) and queries **RapidAPI (Spotify Extended Audio Features API)** directly.
   * **Pre-July 2025 releases**: The backend queries the **Hugging Face Sharded Parquet Lake** (using DuckDB to perform remote range queries via HTTPFS on a consolidated single-file-per-partition structure for sub-second point lookups). If it misses, it falls back to **RapidAPI**.
5. **Statistical Fallback**: If all lookup channels fail, the backend generates realistic normal-distributed audio features based on FIFA soundtrack statistics.

---

## 🗓️ Daily Scouter Engine

The Daily Scouter aggregates fresh candidate tracks from the web, filters and scores them against our OC-SVM model, and posts the top 11 daily "elite" tracks to the leaderboard.

*   **Platform Crawlers**:
    *   **Spotify New Music Friday (NMF)**: Crawls the NMF playlist.
    *   **Pitchfork Best New Tracks Feed**: Parses track reviews from the Pitchfork RSS feed.
    *   **SoundCloud Trending Charts**: Calls SoundCloud's public charts API.
*   **Ranking & Batching**: All unique tracks discovered from crawlers are analyzed and scored. The top 11 tracks are stored with a batch timestamp (`scout_batch_id`) and ranked 1 to 11.
*   **Fallback Pool**: If the crawler output falls short of 11 successfully scored tracks, the engine automatically supplements the list with random tracks from the SQLite Golden Database.

---

## 🛠️ How to Run VibeFC

### Prerequisites
* **Python 3.12+**
* **Node.js 18+**
* A [Supabase](https://supabase.com) database (for caching and daily scouter tables)

### 1. Clone & Install
```bash
git clone https://github.com/afnan47/vibe-fc.git
cd vibe-fc

# Install Python backend dependencies
pip install -r backend/requirements.txt

# Install React frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment Configuration
Copy the template and fill in your credentials in `.env` in the project root:
```bash
cp .env.example .env
```
Key configuration fields:
* `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Required for database caching and daily scouter leaderboard.
* `SPOTIFY_CLIENT_ID` & `SPOTIFY_CLIENT_SECRET`: Recommended (Spotify API access; falls back to Embed scrape if omitted).
* `RAPIDAPI_KEY`: Optional (Required for 2025/2026 live track queries).
* `HF_TOKEN` & `HF_REPO_ID`: Optional (Required for DuckDB sharded Parquet queries).

### 3. Database Setup
Copy and execute the DDL script in [`backend/schema.sql`](backend/schema.sql) in your Supabase SQL Editor to create the cache and scouter tables.

### 4. Running the Application Locally
To start both the FastAPI backend and React frontend dev servers concurrently with a single command:
```bash
python dev.py
```
* **FastAPI Backend**: Runs on `http://127.0.0.1:8000`
* **Vite React Frontend**: Runs on `http://localhost:5173`

### 5. Running the Daily Scouter
There are three ways to schedule or run the scouter:
* **GitHub Actions (Recommended)**: Set up the repository secrets in **Settings > Secrets and variables > Actions** on GitHub. The workflow configured under `.github/workflows/daily-scouter.yml` automatically runs every day at midnight UTC.
* **Manual Script Trigger**: Run the crawl manually from your terminal:
  ```bash
  python backend/scripts/run_scout.py
  ```
* **Vercel Cron**: A Vercel Cron calling `/api/scouter/cron` secured with a `CRON_SECRET` header can be used. (Note: May trigger 504 timeouts on Vercel's Hobby plan due to its 10s execution limit).

---

## ⚖️ Trademark Notice & Disclaimer

VibeFC is a fan-made, community-driven project created for entertainment and research purposes. This project is **not** affiliated, associated, authorized, endorsed by, or in any way officially connected with Electronic Arts Inc. (EA), EA Sports, FIFA, or any of their subsidiaries or affiliates. "FIFA", "FUT", "EA FC", and related trademarks are registered trademarks of their respective owners.
