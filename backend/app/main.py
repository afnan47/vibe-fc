import os
import re
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .fetcher import extract_track_id, search_local_csv, fetch_from_reccobeats
from .cache import lookup_cache, save_cache, get_supabase_client
from .model import score_track, load_model_assets

app = FastAPI(title="FIFA Vibe Taste Checker API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, lock this down
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory stats cache
_dataset_stats = None

def get_dataset_stats():
    """Computes and caches average features of the actual FIFA playlist."""
    global _dataset_stats
    if _dataset_stats is not None:
        return _dataset_stats
        
    csv_path = "The Ultimate FUT Playlist.csv"
    if not os.path.exists(csv_path):
        # Check parent folder
        csv_path = os.path.join("..", csv_path)
        if not os.path.exists(csv_path):
            return {}
            
    try:
        df = pd.read_csv(csv_path, encoding='latin-1')
        features = ['Dance', 'Energy', 'Valence', 'BPM', 'Acoustic', 'Loud (Db)']
        clean_df = df[features].dropna()
        
        # Calculate averages
        stats = {
            'count': int(len(clean_df)),
            'averages': {
                'danceability': float(clean_df['Dance'].mean()),
                'energy': float(clean_df['Energy'].mean()),
                'valence': float(clean_df['Valence'].mean()),
                'tempo': float(clean_df['BPM'].mean()),
                'acousticness': float(clean_df['Acoustic'].mean()),
                'loudness': float(clean_df['Loud (Db)'].mean())
            },
            'mins': {
                'danceability': float(clean_df['Dance'].min()),
                'energy': float(clean_df['Energy'].min()),
                'valence': float(clean_df['Valence'].min()),
                'tempo': float(clean_df['BPM'].min()),
                'acousticness': float(clean_df['Acoustic'].min()),
                'loudness': float(clean_df['Loud (Db)'].min())
            },
            'maxs': {
                'danceability': float(clean_df['Dance'].max()),
                'energy': float(clean_df['Energy'].max()),
                'valence': float(clean_df['Valence'].max()),
                'tempo': float(clean_df['BPM'].max()),
                'acousticness': float(clean_df['Acoustic'].max()),
                'loudness': float(clean_df['Loud (Db)'].max())
            }
        }
        _dataset_stats = stats
        return stats
    except Exception as e:
        print(f"Error calculating stats: {e}")
        return {}

@app.get("/api/vibe")
async def check_vibe(track_input: str = Query(..., description="Spotify URL, URI, or 22-char Track ID")):
    try:
        track_id = extract_track_id(track_input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # TIER 1: Check Supabase DB Cache
    cached_record = lookup_cache(track_id)
    if cached_record:
        return cached_record
        
    # TIER 2: Check Local CSV
    track_data = search_local_csv(track_id)
    
    # TIER 3: Check ReccoBeats API
    if not track_data:
        track_data = fetch_from_reccobeats(track_id)
        
    if not track_data:
        raise HTTPException(status_code=404, detail="Track features could not be found.")
        
    # Calculate vibe score using our One-Class SVM model
    try:
        vibe_score, decision_dist = score_track(track_data)
    except Exception as e:
        # Fallback in case model isn't trained yet
        print(f"Inference error: {e}")
        vibe_score = 50.0 # Standard fallback
        
    # Save to Supabase Cache
    track_data['vibe_score'] = vibe_score
    save_cache(track_data, vibe_score)
    
    return track_data

@app.get("/api/stats")
async def get_stats():
    stats = get_dataset_stats()
    if not stats:
        raise HTTPException(status_code=500, detail="Stats could not be computed.")
    return stats

@app.get("/api/history")
async def get_history(limit: int = 10):
    """Fetches the most recently checked tracks from the Supabase cache."""
    client = get_supabase_client()
    if not client:
        return []
    try:
        # Fetch the most recent cache entries
        res = client.table("track_cache").select("*").order("created_at", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as e:
        print(f"History fetch error: {e}")
        return []
