# VibeFC — Football Soundtrack Vibe Checker ⚽🎮

![Python](https://img.shields.io/badge/Python-3.12%2B-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=flat-square&logo=react)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deploy-black?style=flat-square&logo=vercel)](https://vibe-fc-11.vercel.app)

VibeFC is an end-to-end web application that evaluates whether a song matches classic football gaming soundtracks using machine learning. 

It replaces unreliable heuristic algorithms with a **One-Class Support Vector Machine (OC-SVM)** model with an **RBF Kernel**, trained exclusively on 1,400+ authentic tracks from actual FIFA / EA FC games. The model's decision margin is calibrated using a Sigmoid function to output a continuous vibe similarity score from `0.0%` to `100.0%`.

### 📱 Responsive & Height-Adaptive Layout
The application features a fully responsive UI design adapting to both width and height constraints:
* **Height-Adaptive Scaling**: Automatically scales the central FUT card, card art, stats text, and player control dock using CSS container logic (via `@media (max-height: 740px)`) to fit smaller laptop screens.
* **Flex Centering Protection**: Employs `flex-shrink: 0` constraints to prevent vertical overlap between the card and the player panel, and handles overflow via safe scrolling in the showcase column.
* **Mobile Layout**: Seamlessly collapses into a clean bottom-nav tab bar structure for mobile, providing persistent playing controls via a persistent `MiniPlayer` component.
* **Interactive Info/Disclaimer Modal**: Replaces the desktop-only footer on mobile viewports with a styled header info button (`ⓘ`) that triggers an overlay containing the about page, non-affiliation disclaimer, and legal links, ensuring full compliance on compact displays.
* **FUT Card UI Sizing & Alignment**: Prevents rating number clipping inside the sloped top-left corner of the card by shifting the rating badge slightly right and dynamically scaling the rating font size for 3-digit scores (down to `3.0rem` / `2.3rem`).
* **Normalized Audio Feature Display**: Scales and maps raw Spotify stats like Tempo (BPM) and Loudness (dB) to an authentic FIFA-style `45-99` rating scale on the card layout, matching standard gaming soundtrack UI.
* **GitHub Integration**: Includes a sleek GitHub repository link and icon in the app header designed to match the application's dark mode visual aesthetic.

---

## 🏗️ System Architecture & Caching Pipeline

The application features an optimized **Fetch, Scrape & Smart-Route** caching pipeline:

1. **Supabase Cloud DB Cache**: Instant point-lookups for previously scouted tracks, checking an in-memory LRU cache first to avoid database network hops. It stores track features, album cover art, and 30-second audio previews.
2. **Local SQLite Golden DB**: Fast offline lookup within the 1,400+ authentic FIFA training set tracks (`The Ultimate FUT Playlist.db`).
3. **Upfront Keyless Embed Scrape**: On a cache/SQLite miss, the backend fetches metadata (title, artist, cover art, preview URL) and the **release date** via a keyless Spotify Embed scraper.
4. **Smart Date-Based Router**:
   * **Post-July 2025 releases**: The backend bypasses the Hugging Face dataset entirely (since it cuts off at July 2025) and queries **RapidAPI (Spotify Extended Audio Features API)** directly, saving DuckDB latency.
   * **Pre-July 2025 releases**: The backend queries the **Hugging Face Sharded Parquet Lake** (using DuckDB to perform remote range queries via HTTPFS on a consolidated single-file-per-partition structure, which bypasses Hugging Face globbing limits and ensures sub-second point lookups). If it misses, it falls back to **RapidAPI**.
5. **Statistical Fallback**: If all lookup channels fail, the backend generates realistic normal-distributed audio features merged with the scraped metadata.
6. **Vibe Scouter Fallback**: The Daily Scouter endpoint returns today's top 11 ranked tracks. If the crawling scheduler has not run for the current date, the endpoint automatically retrieves the most recent successfully completed daily batch.

Any resolved track is automatically cached in Supabase for subsequent queries.

### 🗓️ Daily Scouter & Music Discovery Engine

The application aggregates fresh candidate tracks from the web, filters and scores them against our OC-SVM model, and posts the top 11 daily "elite" tracks to the leaderboard.

*   **Platform Crawlers**:
    *   **Spotify New Music Friday (NMF)**: Crawls the official NMF playlist using Spotipy (or an anonymous web-embed fallback scraper if no credentials exist).
    *   **Pitchfork Best New Tracks Feed**: Parses track reviews from the Pitchfork RSS feed and resolves Spotify track IDs via search.
    *   **SoundCloud Trending Charts**: Calls SoundCloud's public charts API (when `SOUNDCLOUD_CLIENT_ID` is set) and searches Spotify for matching IDs.
*   **Ranking & Batching**: All unique tracks discovered from crawlers are analyzed and scored. The top 11 tracks are stored with a batch timestamp `scout_batch_id` and ranked 1 to 11.
*   **Fallback Pool**: If the crawler output falls short of 11 successfully scored tracks, the engine automatically supplements the list with random tracks from the SQLite Golden Database.
*   **Automation & Daily Schedulers**:
    *   **GitHub Actions (Recommended)**: Runs the crawler daily at midnight UTC via the `.github/workflows/daily-scouter.yml` workflow. This is the recommended approach for production because it avoids Vercel's strict serverless function timeout limits (10s on Hobby tier) and provides persistent execution logs.
    *   **Vercel Cron**: A Vercel Cron job configured at `/api/scouter/cron` can call the endpoint secured with a `CRON_SECRET` header. Note: This can trigger 504 timeouts on Vercel's Hobby tier if execution exceeds 10s.
    *   **Localhost Scheduler**: When running locally, the server initializes an `APScheduler` interval (every 24 hours) to run the crawler in a background thread.


---

## 📂 Project Structure

```
vibe-fc/
├── backend/
│   ├── app/
│   │   ├── cache.py           # Supabase DB cache controller & Memory LRU Cache
│   │   ├── fetcher.py         # Spotify URL parsing + CSV, sharded parquet, & RapidAPI fetcher
│   │   ├── model.py           # Preprocessing & OC-SVM model inference with Sigmoid calibration
│   │   ├── main.py            # FastAPI endpoints (vibe checker, presets, autocomplete, history, cron)
│   │   ├── scouter.py         # Daily music crawler & scouter discovery pipeline
│   │   └── search_logger.py   # Logs the steps taken to evaluate queries
│   ├── scripts/
│   │   ├── convert_csv_to_sqlite.py # Populates the SQLite DB from CSV data
│   │   ├── partition_dataset.py     # Date-based partitioning optimizer for sharded parquet lake
│   │   ├── seed_supabase.py         # DB seeding script
│   │   └── train_vibe_model.py      # ML training and Sigmoid calibration script
│   ├── models/                # Saved model weights & calibration parameters
│   ├── requirements.txt       # Python backend dependencies
│   └── schema.sql             # SQL DDL script for Supabase DB setup
├── frontend/                  # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx    # Input bar with Spotify search autocomplete & animations
│   │   │   ├── VibeGauge.jsx    # Circular progress score gauge (styled per FC tier)
│   │   │   ├── HistoryList.jsx  # Recently scouted songs list
│   │   │   ├── MiniPlayer.jsx   # Collapsible bottom navigation playback control dock
│   │   │   ├── PlayerPanel.jsx  # Card preview audio player interface
│   │   │   ├── ScoutColumn.jsx  # Search & History column layout
│   │   │   ├── ScouterPlaylist.jsx # Leaderboard table for the daily top 11
│   │   │   └── ShowcaseColumn.jsx  # Interactive 3D FUT card displaying normalized stats
│   │   ├── lib/
│   │   │   ├── audioPlayer.js   # HTML5 audio player manager instance
│   │   │   └── useAudioPlayer.js # React player subscriber hook
│   │   ├── App.jsx            # Main dashboard container with modal legal views
│   │   └── index.css          # FUT/EA FC dark-mode CSS design system
│   └── package.json
├── dev.py                     # Single-command concurrent developer runner
├── The Ultimate FUT Playlist.db # Golden ground dataset SQLite DB (1,400+ tracks)
├── .env.example               # Environment variable template
├── LICENSE
└── README.md                  # This documentation
```

---

## 🛠️ Getting Started

### Prerequisites
- **Python 3.12+** with `pip`
- **Node.js 18+** with `npm`
- A free [Supabase](https://supabase.com) project
- A free [Hugging Face](https://huggingface.co) account (for the sharded parquet lake)
- *(Optional)* A [RapidAPI](https://rapidapi.com) key for live 2025/2026 track lookups

### 1. Clone & Install
```bash
git clone https://github.com/afnan47/vibe-fc.git
cd vibe-fc

# Install Python backend dependencies
pip install -r backend/requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Environment Configuration
Copy the template and fill in your credentials:
```bash
cp .env.example .env
```
Then edit `.env` with your keys. See `.env.example` for a description of each variable.

### 3. Database Setup
1. Log in to your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** for your project.
3. Copy and run the DDL script in [`backend/schema.sql`](backend/schema.sql) to create the `track_cache` table.

### 4. Quick Run (Recommended)
Start both the FastAPI backend and React frontend dev servers with a single command:
```bash
python dev.py
```
*This script automatically trains the model if needed, starts the backend on `http://127.0.0.1:8000`, and starts the frontend on `http://localhost:5173`.*

### 5. Train the Model Manually (Optional)
If you want to retrain the OC-SVM from scratch:
```bash
python backend/scripts/train_vibe_model.py
```
The fitted model, scaler, and calibration parameters will be saved to `backend/models/`.

---

## 🧪 Machine Learning Details

### Feature Selection & Preprocessing
The model evaluates songs based on **6 core audio features**:
*   `Dance` (Danceability)
*   `Energy`
*   `Valence` (Musical positivity/happy vibe)
*   `BPM` (Tempo)
*   `Acoustic` (Log-transformed to handle right-skewness)
*   `Loud (Db)` (Loudness)

### Score Calibration (The Sigmoid Mapping)
One-Class SVM output represents a raw signed distance $d$ to the decision boundary. We map these distances to a percentage score $P(d)$ using a calibrated Sigmoid function:
$$P(d) = \frac{100}{1 + e^{-k(d - x_0)}}$$

The parameters $k$ and $x_0$ are dynamically calibrated on the training distribution:
*   The **5th percentile** of the training set is mapped to exactly **50.0%** ($x_0$).
*   The **median** (50th percentile) is mapped to **95.0%** ($k$).
*   This ensures inliers sitting inside the dense core score near **95%-100%**, while extreme outliers decay gracefully to **0%**.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## 🚀 Deployment

The project can be deployed easily as a unified Docker container where FastAPI builds and serves the React static frontend. 

### 1. Build & Run Locally with Docker

To test the production container configuration locally:

```bash
# Build the Docker image
docker build -t vibe-fc .

# Run the container
docker run -p 8000:8000 --env-file .env vibe-fc
```

### 2. Supported Deployment Platforms

For hobby and production hosting, the following options are recommended:

*   **Hugging Face Spaces (Docker SDK) — *Highly Recommended***: Completely free hosting with 16GB RAM, 2 vCPUs, and **no automatic cold-start sleep/suspension** for active spaces. To deploy, create a new Space, select **Docker** as the SDK, select the **Blank** template, and add your environment variables under Space Settings -> Variables and secrets.
*   **Vercel — *Fastest Serverless Deployment***: Deploy the repository as a unified project using Vercel's native integration. It automatically builds the Vite frontend and deploys the FastAPI backend as Serverless Functions using the configuration in `vercel.json`. Configure the following environment variables in the Vercel Dashboard:
    *   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (for caching)
    *   `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (if running in production mode)
    *   `RAPIDAPI_KEY` (optional, for live queries)
    *   `CRON_SECRET` (recommended, to secure the automated daily scouter cron job configured at `/api/scouter/cron`)
*   **Render (Render.com)**: Easiest dockerized deployment. Set the service source type to **Docker**, bind the port to `$PORT`, and add your environment variables in the dashboard settings. *(Note: Render's Free tier container sleeps after 15 mins of inactivity)*.
*   **Railway (Railway.app)**: Best for cheap, always-on deployments. Railway automatically builds from the root `Dockerfile` and deploys it.
*   **Virtual Private Server (VPS)**: Standard docker-compose or container run setup with a reverse proxy (Nginx/Caddy) to manage SSL.
*   **GitHub Actions (Scouter Crawler Job)**: Running the daily crawler via GitHub Actions is recommended. To set this up:
    1. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
    2. Add the following **Repository Secrets**:
       * `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Required for database caching)
       * `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (Optional; falls back to Embed scrape if omitted)
       * `RAPIDAPI_KEY` (Optional; required for 2025/2026 live track queries)
       * `SOUNDCLOUD_CLIENT_ID` (Optional; required for SoundCloud charts crawler)
       * `HF_TOKEN` and `HF_REPO_ID` (Optional; required for remote sharded Parquet queries)

### 3. Storage Architecture Note (SQLite & Supabase)
The golden reference dataset SQLite database (`The Ultimate FUT Playlist.db`) is read-only and is packaged directly into the container. Newly scouted/analyzed tracks and session histories are stored in **Supabase Cloud DB**, so container recycling does not affect cached results or user history.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## ⚖️ Trademark Notice & Disclaimer

VibeFC is a fan-made, community-driven project created for entertainment and research purposes. 

This project is **not** affiliated, associated, authorized, endorsed by, or in any way officially connected with Electronic Arts Inc. (EA), EA Sports, FIFA, or any of their subsidiaries or affiliates. The names "FIFA", "FUT", "EA FC", and related trademarks, logos, and designs are registered trademarks of their respective owners. 

All music metadata, album covers, and audio previews are properties of their respective copyright owners and are accessed via third-party publicly accessible CDNs.

