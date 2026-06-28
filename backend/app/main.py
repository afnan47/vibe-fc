import os
import re
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .fetcher import extract_track_id, search_local_csv, fetch_spotify_metadata_via_embed, query_sharded_parquet_lake, fetch_from_rapidapi, fetch_from_spotify_api
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
        # If cache hit but missing preview or cover art (e.g. legacy cache entries)
        if not cached_record.get('preview_url') or not cached_record.get('cover_art_url'):
            metadata = fetch_spotify_metadata_via_embed(track_id)
            if metadata:
                cached_record['preview_url'] = metadata.get('preview_url')
                cached_record['cover_art_url'] = metadata.get('cover_art_url')
                # Attempt to update cache with new fields
                save_cache(cached_record, cached_record['vibe_score'])
        return cached_record
        
    # TIER 2: Check Local CSV
    track_data = search_local_csv(track_id)
    
    # TIER 3: Check Sharded Parquet Lake via DuckDB
    if not track_data:
        track_data = query_sharded_parquet_lake(track_id)
        
    # TIER 3.5: Check Live API Fallback (RapidAPI)
    if not track_data:
        track_data = fetch_from_rapidapi(track_id)
        
    # TIER 3.6: Check Official Spotify Web API Fallback (using SPOTIFY_CLIENT_ID / SECRET credentials)
    if not track_data:
        track_data = fetch_from_spotify_api(track_id)
        
    if not track_data:
        raise HTTPException(status_code=404, detail="Track features could not be found.")
        
    # TIER 4: Fetch metadata & preview URL using Spotify Embed Scraper (unless already populated by official api)
    if not track_data.get('preview_url') or not track_data.get('cover_art_url') or track_data.get('title') == 'Unknown Song':
        metadata = fetch_spotify_metadata_via_embed(track_id)
        if metadata:
            track_data['title'] = metadata.get('title') or track_data.get('title') or 'Unknown Song'
            track_data['artist'] = metadata.get('artist') or track_data.get('artist') or 'Unknown Artist'
            track_data['preview_url'] = metadata.get('preview_url') or track_data.get('preview_url')
            track_data['cover_art_url'] = metadata.get('cover_art_url') or track_data.get('cover_art_url')
        else:
            track_data.setdefault('title', 'Unknown Song')
            track_data.setdefault('artist', 'Unknown Artist')
            track_data.setdefault('preview_url', None)
            track_data.setdefault('cover_art_url', None)
    else:
        track_data.setdefault('title', 'Unknown Song')
        track_data.setdefault('artist', 'Unknown Artist')
        track_data.setdefault('preview_url', None)
        track_data.setdefault('cover_art_url', None)
        
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

@app.get("/api/random-presets")
async def get_random_presets(limit: int = 4):
    """Returns a list of random songs from the FIFA dataset CSV."""
    csv_path = "The Ultimate FUT Playlist.csv"
    if not os.path.exists(csv_path):
        csv_path = os.path.join("..", csv_path)
        if not os.path.exists(csv_path):
            return []
    try:
        df = pd.read_csv(csv_path, encoding='latin-1')
        # Filter tracks that have valid IDs, songs, artists, and features
        valid_df = df.dropna(subset=['Spotify Track Id', 'Song', 'Artist'])
        # Pick random samples
        samples = valid_df.sample(n=min(limit, len(valid_df)))
        presets = []
        for _, row in samples.iterrows():
            presets.append({
                'id': str(row['Spotify Track Id']),
                'name': str(row['Song']),
                'artist': str(row['Artist']),
                'desc': 'FUT Classic'
            })
        return presets
    except Exception as e:
        print(f"Error fetching random presets: {e}")
        return []

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



