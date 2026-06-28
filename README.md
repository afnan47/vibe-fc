# FUT Vibe FC: FIFA Vibe Taste Checker ⚽🎮

FUT Vibe FC is an end-to-end web application that evaluates whether a song matches the "FIFA soundtrack vibe" using machine learning. 

It replaces unreliable heuristic algorithms with a **One-Class Support Vector Machine (OC-SVM)** model with an **RBF Kernel**, trained exclusively on 1,400+ authentic tracks from actual FIFA / EA FC games. The model's decision margin is calibrated using a Sigmoid function to output a continuous vibe similarity score from `0.0%` to `100.0%`.

---

## 🏗️ System Architecture & Caching Pipeline

The application features a high-performance **3-Tier Fetch & Cache** architecture:

1. **Supabase Cloud DB Cache**: Instant point-lookups for previously scouted tracks.
2. **Local Golden Ground Dataset**: Instant fallback searches within the 1,400+ song offline training set (`The Ultimate FUT Playlist.csv`).
3. **Live API Fetcher (ReccoBeats)**: If the song is new, the backend fetches its metadata and audio features directly using the ReccoBeats API (bypassing Spotify premium restrictions) and then saves it to the Supabase cache for subsequent requests.

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
├── The Ultimate FUT Playlist.csv # Golden ground dataset
└── README.md                  # This documentation
```

---

## 🛠️ Getting Started

### 1. Database Setup
1. Log in to your [Supabase Dashboard](https://supabase.com).
2. Open the **SQL Editor** for your project.
3. Copy and execute the SQL script in [backend/schema.sql](file:///C:/Users/Afnan/Downloads/Hobby/vibe-fc/backend/schema.sql). This will create the `track_cache` table.

### 2. Environment Configuration
Ensure your `.env` file at the root contains the correct Supabase credentials:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_role_key
```

### 3. Quick Run (Recommended)
You can start both the FastAPI backend and React frontend dev servers simultaneously using a single command:
```bash
python dev.py
```
*This script will automatically check if the model is trained, build it if necessary, start the backend on `http://127.0.0.1:8000`, and start the frontend dev server on `http://localhost:5173`.*

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
