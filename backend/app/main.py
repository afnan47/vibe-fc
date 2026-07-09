import os
import re
import asyncio
import pandas as pd
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .fetcher import extract_track_id, search_local_csv, fetch_spotify_metadata_via_embed, query_sharded_parquet_lake, fetch_from_rapidapi, fetch_fallback_metadata_features, fetch_track_data
from .cache import lookup_cache, save_cache, get_supabase_client
from .model import score_track, load_model_assets
from .scouter import get_scouter_playlist, run_daily_scout_async
from .search_logger import log_search_path

_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler

    # Seed initial scout if DB is empty (Asynchronously, so it doesn't block startup)
    try:
        client = get_supabase_client()
        if client:
            res = client.table("scouted_tracks").select("track_id", count="exact").limit(1).execute()
            if res.count == 0:
                print("[Startup] scouted_tracks is empty — running initial seed crawl in background...")
                asyncio.create_task(run_daily_scout_async())
    except Exception as e:
        print(f"[Startup] Seed scout check error: {e}")

    # Start 24h recurring scheduler using AsyncIOScheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(run_daily_scout_async, "interval", hours=24, id="daily_scout", replace_existing=True)
    _scheduler.start()
    print("[Startup] Daily scouter scheduler started (24h interval).")

    yield

    if _scheduler:
        _scheduler.shutdown(wait=False)


app = FastAPI(title="FIFA Vibe Taste Checker API", lifespan=lifespan)

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
        
    db_path = "The Ultimate FUT Playlist.db"
    if not os.path.exists(db_path):
        # Check parent folder
        db_path = os.path.join("..", db_path)
        if not os.path.exists(db_path):
            return {}
            
    import sqlite3
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Calculate stats using SQLite aggregate functions
        cursor.execute("""
            SELECT 
                COUNT(*),
                AVG(danceability), AVG(energy), AVG(valence), AVG(tempo), AVG(acousticness), AVG(loudness),
                MIN(danceability), MIN(energy), MIN(valence), MIN(tempo), MIN(acousticness), MIN(loudness),
                MAX(danceability), MAX(energy), MAX(valence), MAX(tempo), MAX(acousticness), MAX(loudness)
            FROM tracks
        """)
        row = cursor.fetchone()
        conn.close()
        
        if not row or row[0] == 0:
            return {}
            
        stats = {
            'count': int(row[0]),
            'averages': {
                'danceability': float(row[1] or 0),
                'energy': float(row[2] or 0),
                'valence': float(row[3] or 0),
                'tempo': float(row[4] or 0),
                'acousticness': float(row[5] or 0),
                'loudness': float(row[6] or 0)
            },
            'mins': {
                'danceability': float(row[7] or 0),
                'energy': float(row[8] or 0),
                'valence': float(row[9] or 0),
                'tempo': float(row[10] or 0),
                'acousticness': float(row[11] or 0),
                'loudness': float(row[12] or 0)
            },
            'maxs': {
                'danceability': float(row[13] or 0),
                'energy': float(row[14] or 0),
                'valence': float(row[15] or 0),
                'tempo': float(row[16] or 0),
                'acousticness': float(row[17] or 0),
                'loudness': float(row[18] or 0)
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
        
    path_steps = []
    
    # TIER 1: Check Supabase DB Cache (non-blocking)
    cached_record = await asyncio.to_thread(lookup_cache, track_id, path_steps)
    if cached_record:
        if (not cached_record.get('preview_url') or not cached_record.get('cover_art_url')) and cached_record.get('source') != 'official_spotify_api':
            path_steps.append("Metadata Scrape Enrichment")
            metadata = await asyncio.to_thread(fetch_spotify_metadata_via_embed, track_id)
            if metadata:
                path_steps[-1] += " (Success)"
                cached_record['preview_url'] = metadata.get('preview_url')
                cached_record['cover_art_url'] = metadata.get('cover_art_url')
                await asyncio.to_thread(save_cache, cached_record, cached_record['vibe_score'])
            else:
                path_steps[-1] += " (Failed)"
        
        final_source = cached_record.get('source') or 'supabase_cache'
        log_search_path(track_id, path_steps, final_source, cached_record)
        
        response_record = dict(cached_record)
        response_record['search_path'] = " -> ".join(path_steps)
        return response_record
        
    # Query track data from the parallel async 4-tier pipeline
    track_data = await fetch_track_data(track_id, path_steps)
    
    if not track_data:
        log_search_path(track_id, path_steps, 'not_found')
        raise HTTPException(status_code=404, detail="Track features could not be found.")
        
    # Calculate vibe score using our One-Class SVM model (non-blocking)
    try:
        vibe_score, decision_dist = await asyncio.to_thread(score_track, track_data)
    except Exception as e:
        # Fallback in case model isn't trained yet
        print(f"Inference error: {e}")
        vibe_score = 50.0 # Standard fallback
        
    # Save to Supabase Cache (non-blocking)
    track_data['vibe_score'] = vibe_score
    await asyncio.to_thread(save_cache, track_data, vibe_score)
    
    final_source = track_data.get('source') or 'unknown'
    log_search_path(track_id, path_steps, final_source, track_data)
    
    response_data = dict(track_data)
    response_data['search_path'] = " -> ".join(path_steps)
    
    return response_data

@app.get("/api/stats")
async def get_stats():
    stats = get_dataset_stats()
    if not stats:
        raise HTTPException(status_code=500, detail="Stats could not be computed.")
    return stats

@app.get("/api/random-presets")
async def get_random_presets(limit: int = 4):
    """Returns a list of random songs from the FIFA dataset SQLite DB."""
    db_path = "The Ultimate FUT Playlist.db"
    if not os.path.exists(db_path):
        db_path = os.path.join("..", db_path)
        if not os.path.exists(db_path):
            return []
    import sqlite3
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT track_id, title, artist 
            FROM tracks 
            ORDER BY RANDOM() LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()
        
        presets = []
        for row in rows:
            presets.append({
                'id': row[0],
                'name': row[1],
                'artist': row[2],
                'desc': 'FUT Classic'
            })
        return presets
    except Exception as e:
        print(f"Error fetching random presets: {e}")
        return []

@app.get("/api/search")
async def search_tracks(q: str = Query(..., description="Search query: song name or artist"), limit: int = 10):
    """Searches the golden dataset SQLite DB by song name or artist for omnibox autocomplete."""
    db_path = "The Ultimate FUT Playlist.db"
    if not os.path.exists(db_path):
        db_path = os.path.join("..", db_path)
        if not os.path.exists(db_path):
            return []
    
    q_clean = q.strip()
    if not q_clean:
        return []
        
    import sqlite3
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT track_id, title, artist 
            FROM tracks 
            WHERE title LIKE ? OR artist LIKE ? 
            LIMIT ?
        """, (f"%{q_clean}%", f"%{q_clean}%", limit))
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                'id': row[0],
                'name': row[1],
                'artist': row[2]
            }
            for row in rows
        ]
    except Exception as e:
        print(f"Search error: {e}")
        return []

@app.get("/api/history")
async def get_history(limit: int = 10):
    """Fetches the most recently checked tracks from the Supabase cache."""
    client = get_supabase_client()
    if not client:
        return []
    try:
        res = client.table("track_cache").select("*").order("created_at", desc=True).limit(limit).execute()
        return res.data or []
    except Exception as e:
        print(f"History fetch error: {e}")
        return []


@app.get("/api/scouter/playlist")
async def scouter_playlist():
    """Returns today's top 11 FIFA Elite scouted tracks."""
    return get_scouter_playlist()



