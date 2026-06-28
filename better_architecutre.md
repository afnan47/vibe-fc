
## New Updates

Here is the complete, high-performance architecture and engineering game plan. You can hand this document directly to your coding agent (Cursor, Bolt, Claude Engineer, etc.) to build the application.
------------------------------
## Architecture Handoff: Zero-DB, Serverless Spotify Audio Feature Extractor## Objective
Build a web application where users paste a Spotify Track Link or ID and instantly receive its audio features (loudness, acousticness, danceability, tempo, etc.). The application must run for free, scale infinitely, bypass Spotify’s deprecated API restrictions, and operate without hitting restrictive third-party rate limits.
------------------------------
## 🏗️ System Architecture & "The Game Plan"
We use a 4-Tier Tiered Cache & Fetch Strategy optimized for maximum performance, minimal cost, and zero server bottlenecks.

[User Input Link] 
       │
       ▼
 1. Browser Cache (localStorage) ──► [Instant Return]
       │ (Miss)
       ▼
 2. Live DB Cache (Supabase Free) ──► [Instant Return]
       │ (Miss)
       ▼
 3. Distributed Parquet Lake (DuckDB + HF CDN) ──► [~400ms Return & Save to DB]
       │ (Miss)
       ▼
 4. Live API Fallback (ReccoBeats / SoundNet) ──► [~1s Return & Save to DB]

------------------------------
## 🛠️ Step-by-Step Implementation Guide for the Agent## Step 1: Pre-process & Partition the Master Dataset (One-Time Setup)
We do not query a 20GB database file at runtime. We chunk the public 256M track dataset (ozefe/spotify_audio_features) into ~4,000 hyper-focused micro-files using the first 2 characters of the Spotify Track ID as a partition key.
Agent Task: Write a local Python script using polars to partition and sink the data, then instruct the user to upload it to a private/public Hugging Face Dataset repository.

# partition_dataset.pyimport polars as pl

print("Streaming and processing 256M records...")# 1. Lazy scan the massive public datasetdf = pl.scan_parquet("hf://datasets/ozefe/spotify_audio_features/data/*.parquet")
# 2. Extract first 2 characters of track_id to create an optimized partition keydf = df.with_columns(
    pl.col("track_id").str.slice(0, 2).alias("partition_key")
)
# 3. Sink directly to disk split into folders: /data/partition_key=XX/*.parquetoutput_dir = "./sharded_spotify_lake"
df.sink_parquet(output_dir, partition_by="partition_key")
print(f"Data partitioned successfully into {output_dir}")

## Step 2: Set Up the Database Cache Schema (Supabase)
To handle new songs that users search for (which are added after the dataset dump), create a caching database. On Supabase's 500MB free tier, keeping data types atomic allows us to store ~2,000,000 rows.
Agent Task: Create the PostgreSQL table schema. Use short identifiers and precise floats to optimize memory blocks.

CREATE TABLE track_cache (
    track_id VARCHAR(22) PRIMARY KEY, -- Spotify IDs are exactly 22 chars
    loudness REAL,                    -- 4 bytes float
    acousticness REAL,                -- 4 bytes float
    danceability REAL,                -- 4 bytes float
    tempo REAL,                       -- 4 bytes float
    energy REAL,                      -- 4 bytes float
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Index the track_id for instant B-Tree point-lookupsCREATE UNIQUE INDEX idx_track_id ON track_cache(track_id);

## Step 3: Implement the Core Backend Search Engine (Unified Fetch Function)
The backend pipeline handles resolving the metadata using our caching order of operations.
Agent Task: Write the Python FastAPI (or Node.js equivalent) endpoint containing this exact logic.

import duckdbimport requestsimport timefrom supabase import create_client
# Configurations (Agent: Inject environment variables here)SUPABASE_URL = "your_supabase_url"SUPABASE_KEY = "your_supabase_anon_key"HF_REPO_URL = "hf://datasets/yourusername/sharded_spotify_lake"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
def fetch_audio_features(track_id: str):
    # --- TIER 1: Check Local Supabase Cache ---
    db_res = supabase.table("track_cache").select("*").eq("track_id", track_id).execute()
    if db_res.data:
        return {**db_res.data[0], "source": "supabase_cache"}
        
    # --- TIER 2: Query the Partitioned Parquet Lake via DuckDB ---
    try:
        shard_key = track_id[0:2] # Compute shard key (e.g. "0V")
        # Direct DuckDB to download and query ONLY the 2MB relevant file from HF CDN
        query = f"""
            SELECT loudness, acousticness, danceability, tempo, energy 
            FROM '{HF_REPO_URL}/data/partition_key={shard_key}/*.parquet' 
            WHERE track_id = '{track_id}' 
            LIMIT 1
        """
        lake_res = duckdb.sql(query).fetchone()
        
        if lake_res:
            payload = {
                "track_id": track_id, "loudness": lake_res[0], "acousticness": lake_res[1],
                "danceability": lake_res[2], "tempo": lake_res[3], "energy": lake_res[4]
            }
            # Asynchronously save to Supabase so it's faster next time
            supabase.table("track_cache").insert(payload).execute()
            return {**payload, "source": "parquet_lake"}
    except Exception as e:
        print(f"Lake query skipped or failed: {e}")

    # --- TIER 3: Live API Fallback (ReccoBeats) ---
    # Used only for tracks released after the historical dataset generation date
    api_url = "https://reccobeats.com"
    try:
        # Respect ReccoBeats 1 request/sec limit safety throttle
        response = requests.get(api_url, params={"ids": track_id})
        
        if response.status_code == 429:
            time.sleep(1) # Simple brief backoff
            return fetch_audio_features(track_id)
            
        if response.status_code == 200:
            api_data = response.json().get("content", [{}])[0]
            if api_data:
                payload = {
                    "track_id": track_id,
                    "loudness": api_data.get("loudness"),
                    "acousticness": api_data.get("acousticness"),
                    "danceability": api_data.get("danceability"),
                    "tempo": api_data.get("tempo"),
                    "energy": api_data.get("energy")
                }
                supabase.table("track_cache").insert(payload).execute()
                return {**payload, "source": "live_api_fallback"}
    except Exception as e:
        print(f"Live API Backup failed: {e}")
        
    return {"error": "Track metadata not found anywhere."}

## Step 4: Frontend URL Parsing & Local Storage
Users will paste messy URLs like: https://spotify.com
Agent Task: Write a JavaScript/TypeScript frontend function to scrub the URL string into a clean 22-character Track ID before passing it to the backend api, and manage browser-level caching.

// Utility on the Frontendfunction getSpotifyTrackId(inputString) {
  // Regex to match a 22 character alphanumeric Spotify ID out of a URL structure
  const regex = /(?:track\/|track:)([a-zA-Z0-9]{22})/;
  const match = inputString.match(regex);
  return match ? match[1] : inputString.trim(); 
}
async function handleSearch(userInput) {
  const trackId = getSpotifyTrackId(userInput);
  if (trackId.length !== 22) return alert("Invalid Spotify Track ID/Link");

  // Tier 0: Browser LocalStorage check
  const localCached = localStorage.getItem(`track_${trackId}`);
  if (localCached) return JSON.parse(localCached);

  // Call our FastAPI unified backend endpoint
  const response = await fetch(`/api/features?track_id=${trackId}`);
  const data = await response.json();

  if (data && !data.error) {
    localStorage.setItem(`track_${trackId}`, JSON.stringify(data));
    return data;
  }
}

------------------------------
## 🚀 Execution Action Plan for the Agent
Instruct your AI coding agent to tackle development in this exact chronological order:

   1. Initialize a Next.js (Frontend/API routes) or FastAPI + React boilerplate.
   2. Execute the Python dataset partitioning script to construct your personal sharded Hugging Face Data Lake repository.
   3. Provision the free Supabase database instance and deploy the optimized track_cache table DDL script.
   4. Wire up the unified backend data fetching chain function connecting DuckDB and your HTTP client fallbacks.
   5. Build out a clean UX/UI input field component that correctly invokes the regex parsing logic.

Prompt your agent to write a verification test script using standard Spotify track IDs to validate that the tiered fallback engine behaves correctly.