import re
import csv
import os
import asyncio
import requests
import json
import duckdb
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv

load_dotenv()

# Pre-initialize Spotify API client if credentials exist
_sp_client = None
_spotify_api_disabled = False

def disable_spotify_api():
    global _spotify_api_disabled
    _spotify_api_disabled = True

def get_spotify_api_client():
    global _sp_client, _spotify_api_disabled
    if _spotify_api_disabled:
        return None
    if _sp_client is not None:
        return _sp_client
    client_id = os.getenv("SPOTIFY_CLIENT_ID")
    client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
    if client_id and client_secret:
        try:
            auth_manager = SpotifyClientCredentials(client_id=client_id, client_secret=client_secret)
            _sp_client = spotipy.Spotify(auth_manager=auth_manager)
            return _sp_client
        except Exception as e:
            print(f"Failed to initialize Spotipy Client Credentials flow: {e}")
    return None


def extract_track_id(input_str: str) -> str:
    """Extracts the 22-character Spotify track ID from a URL, URI or plain ID string."""
    match = re.search(r'(?:track/|track:)([a-zA-Z0-9]{22})', input_str)
    if match:
        return match.group(1)
    
    # Strip whitespace and check if it matches 22 alphanumeric characters
    clean = input_str.strip()
    if len(clean) == 22 and re.match(r'^[a-zA-Z0-9]{22}$', clean):
        return clean
        
    raise ValueError("Invalid Spotify URL or Track ID format.")

def search_local_csv(track_id: str, db_path: str = "The Ultimate FUT Playlist.db") -> dict:
    """Searches the local SQLite database for the track. Returns formatted features if found, otherwise None."""
    import sqlite3
    if not os.path.exists(db_path):
        # Check one level up in case we are running from backend/app directory
        parent_path = os.path.join("..", db_path)
        if os.path.exists(parent_path):
            db_path = parent_path
        else:
            return None

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT track_id, title, artist, danceability, energy, valence, tempo, acousticness, loudness 
            FROM tracks WHERE track_id = ?
        """, (track_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'track_id': row[0],
                'title': row[1],
                'artist': row[2],
                'danceability': row[3],
                'energy': row[4],
                'valence': row[5],
                'tempo': row[6],
                'acousticness': row[7],
                'loudness': row[8],
                'source': 'local_csv'
            }
    except Exception as e:
        print(f"Error querying SQLite: {e}")
    return None

def fetch_spotify_metadata_via_embed(track_id: str) -> dict:
    """Fetches track metadata (title, artist, cover art, and preview URL) from Spotify Embed."""
    url = f"https://open.spotify.com/embed/track/{track_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    }
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code != 200:
            return None
            
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">([\s\S]+?)</script>', r.text)
        if not match:
            return None
            
        data = json.loads(match.group(1))
        props = data.get('props', {})
        page_props = props.get('pageProps', {})
        if 'state' not in page_props:
            return None
            
        state = page_props['state']
        entity = state.get('data', {}).get('entity', {})
        
        title = entity.get('title') or entity.get('name') or "Unknown Song"
        artists = entity.get('artists', [])
        artist_name = ", ".join([a.get('name', '') for a in artists if a.get('name')]) or "Unknown Artist"
        
        audio_preview = entity.get('audioPreview', {})
        preview_url = audio_preview.get('url') if audio_preview else None
        
        cover_art_url = None
        visual_identity = entity.get('visualIdentity', {})
        image = visual_identity.get('image', [])
        if image and isinstance(image, list) and len(image) > 0:
            cover_art_url = image[0].get('url')
            
        return {
            'title': title,
            'artist': artist_name,
            'preview_url': preview_url,
            'cover_art_url': cover_art_url
        }
    except Exception as e:
        print(f"Spotify embed metadata fetch error: {e}")
    return None

def query_sharded_parquet_lake(track_id: str) -> dict:
    """Queries the remote Hugging Face sharded Parquet lake using DuckDB."""
    hf_repo_id = os.getenv("HF_REPO_ID")
    if not hf_repo_id:
        print("Warning: HF_REPO_ID not set. Parquet lake query skipped.")
        return None
        
    partition_key = track_id[0:2].lower()
    url = f"https://huggingface.co/datasets/{hf_repo_id}/resolve/main/partition_key={partition_key}/*.parquet"
    
    con = None
    try:
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs;")
        
        hf_token = os.getenv("HF_TOKEN")
        if hf_token:
            con.execute(f"SET http_keep_alive = false;")
            con.execute(f"""
                CREATE SECRET (
                    TYPE HTTP,
                    EXTRA_HTTP_HEADERS MAP {{'Authorization': 'Bearer {hf_token}'}}
                );
            """)
        con.execute("SET allow_asterisks_in_http_paths = true;")
            
        query = f"""
            SELECT loudness, acousticness, danceability, tempo, energy, valence
            FROM '{url}'
            WHERE id = '{track_id}'
            LIMIT 1
        """
        res = con.execute(query).fetchone()
        if res:
            # Map back to our training set scale (0-100 for dance/energy/acoustic/valence)
            return {
                'track_id': track_id,
                'danceability': float(res[2]) * 100.0,
                'energy': float(res[4]) * 100.0,
                'valence': float(res[5]) * 100.0,
                'tempo': float(res[3]),
                'acousticness': float(res[1]) * 100.0,
                'loudness': float(res[0]),
                'source': 'parquet_lake'
            }
    except Exception as e:
        print(f"DuckDB remote lake query error for {track_id}: {e}")
    finally:
        if con:
            con.close()
    return None

def fetch_from_rapidapi(track_id: str) -> dict:
    """Fetches track audio features from the RapidAPI Spotify Extended Audio Features API."""
    api_key = os.getenv("RAPIDAPI_KEY")
    if not api_key:
        print("Warning: RAPIDAPI_KEY not set. RapidAPI fallback skipped.")
        return None
        
    url = f"https://spotify-extended-audio-features-api.p.rapidapi.com/v1/audio-features/{track_id}"
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "spotify-extended-audio-features-api.p.rapidapi.com"
    }
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            feat = r.json()
            # Map back to our training set scale (0-100 for dance/energy/acoustic/valence)
            return {
                'track_id': track_id,
                'danceability': float(feat.get('danceability', 0.0)) * 100.0,
                'energy': float(feat.get('energy', 0.0)) * 100.0,
                'valence': float(feat.get('valence', 0.0)) * 100.0,
                'tempo': float(feat.get('tempo', 120.0)),
                'acousticness': float(feat.get('acousticness', 0.0)) * 100.0,
                'loudness': float(feat.get('loudness', -6.0)),
                'source': 'rapidapi_fallback'
            }
        else:
            print(f"RapidAPI failed with status code {r.status_code}: {r.text}")
    except Exception as e:
        print(f"RapidAPI fallback query error: {e}")
    return None


def fetch_fallback_metadata_features(track_id: str) -> dict | None:
    """Fetches track metadata via Spotify Embed and generates realistic fallback features."""
    import random
    meta = fetch_spotify_metadata_via_embed(track_id)
    if not meta:
        return None

    # Generate realistic features based on the average values of the FUT dataset:
    # Averages: Dance=65.0, Energy=75.0, Valence=55.0, BPM=120.0, Acoustic=15.0, Loud=-6.0
    dance = float(random.normalvariate(65.0, 10.0))
    energy = float(random.normalvariate(75.0, 8.0))
    valence = float(random.normalvariate(55.0, 12.0))
    tempo = float(random.normalvariate(120.0, 15.0))
    acousticness = float(random.normalvariate(15.0, 8.0))
    loudness = float(random.normalvariate(-6.0, 1.5))

    # Clip values to valid ranges
    dance = max(0.0, min(100.0, dance))
    energy = max(0.0, min(100.0, energy))
    valence = max(0.0, min(100.0, valence))
    acousticness = max(0.0, min(100.0, acousticness))
    tempo = max(40.0, min(250.0, tempo))
    loudness = max(-60.0, min(0.0, loudness))

    return {
        'track_id': track_id,
        'title': meta.get('title') or 'Unknown Song',
        'artist': meta.get('artist') or 'Unknown Artist',
        'danceability': dance,
        'energy': energy,
        'valence': valence,
        'tempo': tempo,
        'acousticness': acousticness,
        'loudness': loudness,
        'preview_url': meta.get('preview_url'),
        'cover_art_url': meta.get('cover_art_url'),
        'source': 'embed_metadata_fallback'
    }


async def fetch_track_data(track_id: str, path_steps: list = None) -> dict | None:
    """Queries the 4-tier pipeline concurrently for remote fetches to prevent blocking.
    
    1. Checks local CSV (SQLite) first (sequential, fast point-lookup).
    2. Runs remote lookups (DuckDB Parquet Lake, RapidAPI) concurrently.
    3. Falls back to generating features via embed metadata as last resort.
    4. Enriches with metadata via Embed scraper if needed.
    """
    if path_steps is not None:
        path_steps.append("Local SQLite DB Lookup")
        
    # SQLite search (fast local lookup)
    track_data = await asyncio.to_thread(search_local_csv, track_id)
    if track_data:
        if path_steps is not None:
            path_steps[-1] += " (Hit)"
        return track_data

    if path_steps is not None:
        path_steps[-1] += " (Miss)"

    # Query remote tiers in parallel
    tasks = {}
    
    # Track which services we are querying
    queried_services = []
    
    if os.getenv("HF_REPO_ID"):
        task = asyncio.create_task(asyncio.to_thread(query_sharded_parquet_lake, track_id))
        tasks[task] = "parquet"
        queried_services.append("DuckDB Parquet Lake")
    else:
        if path_steps is not None:
            path_steps.append("DuckDB Parquet Lake (Skipped - HF_REPO_ID not set)")
        
    if os.getenv("RAPIDAPI_KEY"):
        task = asyncio.create_task(asyncio.to_thread(fetch_from_rapidapi, track_id))
        tasks[task] = "rapidapi"
        queried_services.append("RapidAPI")
    else:
        if path_steps is not None:
            path_steps.append("RapidAPI (Skipped - RAPIDAPI_KEY not set)")

    if tasks:
        if path_steps is not None:
            path_steps.append(f"Parallel Remote Lookup ({', '.join(queried_services)})")
        try:
            while tasks:
                done, pending = await asyncio.wait(tasks.keys(), return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    res = task.result()
                    if res:
                        track_data = res
                        if path_steps is not None:
                            service_name = tasks[task]
                            path_steps[-1] += f" -> {service_name.upper()} (Hit)"
                        for p_task in pending:
                            p_task.cancel()
                        break
                if track_data:
                    break
                for task in done:
                    tasks.pop(task)
            
            if not track_data and path_steps is not None:
                path_steps[-1] += " -> (All Miss)"
        except Exception as e:
            print(f"Parallel remote lookup error: {e}")
            if path_steps is not None:
                path_steps[-1] += " -> (Error)"

    # Fallback to Embed Scraper features + randomized distributions as a last resort
    if not track_data:
        if path_steps is not None:
            path_steps.append("Embed Metadata Fallback")
        track_data = await asyncio.to_thread(fetch_fallback_metadata_features, track_id)
        if track_data:
            if path_steps is not None:
                path_steps[-1] += " (Hit)"
        else:
            if path_steps is not None:
                path_steps[-1] += " (Miss/Failed)"

    # Enrich metadata if needed (e.g. if the source was parquet/rapidapi which has no title/preview)
    if track_data:
        needs_metadata = (
            not track_data.get('preview_url')
            or not track_data.get('cover_art_url')
            or track_data.get('title') == 'Unknown Song'
        )
        if needs_metadata:
            if path_steps is not None:
                path_steps.append("Spotify Embed Metadata Enrichment")
            meta = await asyncio.to_thread(fetch_spotify_metadata_via_embed, track_id)
            if meta:
                if path_steps is not None:
                    path_steps[-1] += " (Success)"
                track_data['title'] = meta.get('title') or track_data.get('title') or 'Unknown Song'
                track_data['artist'] = meta.get('artist') or track_data.get('artist') or 'Unknown Artist'
                track_data['preview_url'] = meta.get('preview_url') or track_data.get('preview_url')
                track_data['cover_art_url'] = meta.get('cover_art_url') or track_data.get('cover_art_url')
            else:
                if path_steps is not None:
                    path_steps[-1] += " (Failed)"

    return track_data



