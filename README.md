# FUT Vibe FC — FIFA Vibe Taste Checker ⚽🎮

![Python](https://img.shields.io/badge/Python-3.12%2B-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18%2B-61DAFB?style=flat-square&logo=react)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

FUT Vibe FC is an end-to-end web application that evaluates whether a song matches the "FIFA soundtrack vibe" using machine learning. 

It replaces unreliable heuristic algorithms with a **One-Class Support Vector Machine (OC-SVM)** model with an **RBF Kernel**, trained exclusively on 1,400+ authentic tracks from actual FIFA / EA FC games. The model's decision margin is calibrated using a Sigmoid function to output a continuous vibe similarity score from `0.0%` to `100.0%`.

---

## 🏗️ System Architecture & Caching Pipeline

The application features a high-performance **4-Tier Fetch & Cache** architecture:

1. **Supabase Cloud DB Cache**: Instant point-lookups for previously scouted tracks. It stores track features, scraped album cover art, and 30-second audio previews. Legacy cached rows are dynamically upgraded and auto-repaired on the fly.
2. **Local Golden Ground Dataset**: Instant fallback searches within the 1,400+ song offline training set (`The Ultimate FUT Playlist.db`).
3. **Hugging Face Sharded Parquet Lake**: If the track is not cached or in the golden dataset, DuckDB performs remote range queries via HTTPFS on a sharded 256-million Spotify track dataset (`ozefe/spotify_audio_features`) hosted on Hugging Face, retrieving features in ~1s.
4. **Live API Fallback (RapidAPI)**: If the song is a new release (2025/2026) and not present in the lake, the backend queries the Spotify Extended Audio Features API on RapidAPI (requires `RAPIDAPI_KEY` in `.env`).

Any newly resolved track is automatically enriched with cover art and 30-second preview URLs using a **keyless Spotify Embed metadata scraper** (which extracts Next.js hydration props completely for free) and cached in Supabase.

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

## 📄 License

This project is licensed under the **MIT License**.
