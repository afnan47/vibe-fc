# VibeFC — Football Soundtrack Vibe Checker ⚽🎮

![Python](https://img.shields.io/badge/Python-3.12%2B-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=flat-square&logo=react)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

VibeFC is an end-to-end web application that evaluates whether a song matches classic football gaming soundtracks using machine learning. 

It replaces unreliable heuristic algorithms with a **One-Class Support Vector Machine (OC-SVM)** model with an **RBF Kernel**, trained exclusively on 1,400+ authentic tracks from actual FIFA / EA FC games. The model's decision margin is calibrated using a Sigmoid function to output a continuous vibe similarity score from `0.0%` to `100.0%`.

### 📱 Responsive & Height-Adaptive Layout
The application features a fully responsive UI design adapting to both width and height constraints:
* **Height-Adaptive Scaling**: Automatically scales the central FUT card, card art, stats text, and player control dock using CSS container logic (via `@media (max-height: 740px)`) to fit smaller laptop screens.
* **Flex Centering Protection**: Employs `flex-shrink: 0` constraints to prevent vertical overlap between the card and the player panel, and handles overflow via safe scrolling in the showcase column.
* **Mobile Layout**: Seamlessly collapses into a clean bottom-nav tab bar structure for mobile, providing persistent playing controls via a persistent `MiniPlayer` component.
* **FUT Card UI Sizing & Alignment**: Prevents rating number clipping inside the sloped top-left corner of the card by shifting the rating badge slightly right and dynamically scaling the rating font size for 3-digit scores (down to `3.0rem` / `2.3rem`).
* **Normalized Audio Feature Display**: Scales and maps raw Spotify stats like Tempo (BPM) and Loudness (dB) to an authentic FIFA-style `45-99` rating scale on the card layout, matching standard gaming soundtrack UI.

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

---

## 📂 Project Structure

```
vibe-fc/
├── backend/
│   ├── app/
│   │   ├── cache.py           # Supabase DB cache controller
│   │   ├── fetcher.py         # Spotify URL parsing + CSV & ReccoBeats fetcher
│   │   ├── model.py           # Preprocessing & OC-SVM model inference
│   │   └── main.py            # FastAPI endpoints (/api/vibe, /api/stats, /api/history)
│   ├── scripts/
│   │   └── train_vibe_model.py # ML training and Sigmoid calibration script
│   ├── models/                # Saved model weights & calibration parameters
│   ├── requirements.txt       # Python backend dependencies
│   └── schema.sql             # SQL DDL script for Supabase DB setup
├── frontend/                  # React + Vite application
│   ├── src/
│   │   ├── components/
│   │   │   ├── SearchBar.jsx    # Input bar with Spotify URL validation & animations
│   │   │   ├── VibeGauge.jsx    # Circular progress score gauge (styled per FC tier)
│   │   │   ├── FeatureChart.jsx # Custom SVG radar chart comparing values to average FUT song
│   │   │   └── HistoryList.jsx  # Recently scouted songs with color-coded badges
│   │   ├── App.jsx            # Main dashboard container
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
git clone https://github.com/your-username/vibe-fc.git
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
*   **Render (Render.com)**: Easiest dockerized deployment. Set the service source type to **Docker**, bind the port to `$PORT`, and add your environment variables in the dashboard settings. *(Note: Render's Free tier container sleeps after 15 mins of inactivity)*.
*   **Railway (Railway.app)**: Best for cheap, always-on deployments. Railway automatically builds from the root `Dockerfile` and deploys it.
*   **Virtual Private Server (VPS)**: Standard docker-compose or container run setup with a reverse proxy (Nginx/Caddy) to manage SSL.

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

