import re
import csv
import os
import requests
import json
import duckdb
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv

load_dotenv()

# Pre-initialize Spotify API client if credentials exist
_sp_client = None
def get_spotify_api_client():
    global _sp_client
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

def search_local_csv(track_id: str, csv_path: str = "The Ultimate FUT Playlist.csv") -> dict:
    """Searches the local CSV for the track. Returns formatted features if found, otherwise None."""
    if not os.path.exists(csv_path):
        # Check one level up in case we are running from backend/app directory
        parent_path = os.path.join("..", csv_path)
        if os.path.exists(parent_path):
            csv_path = parent_path
        else:
            return None

    try:
        with open(csv_path, mode='r', encoding='latin-1') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('Spotify Track Id') == track_id:
                    # Found! Map the features exactly to what the model expects
                    return {
                        'track_id': track_id,
                        'title': row.get('Song', 'Unknown Song'),
                        'artist': row.get('Artist', 'Unknown Artist'),
                        'danceability': float(row.get('Dance', 0)),
                        'energy': float(row.get('Energy', 0)),
                        'valence': float(row.get('Valence', 0)),
                        'tempo': float(row.get('BPM', 0)),
                        'acousticness': float(row.get('Acoustic', 0)),
                        'loudness': float(row.get('Loud (Db)', 0)),
                        'source': 'local_csv'
                    }
    except Exception as e:
        print(f"Error reading CSV: {e}")
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

def fetch_from_spotify_api(track_id: str) -> dict:
    """Fetches track audio features and metadata directly from the official Spotify API (using Spotipy)."""
    sp = get_spotify_api_client()
    if not sp:
        print("Spotify API client not configured or initialized.")
        return None
    try:
        # Get audio features
        features_list = sp.audio_features([track_id])
        if not features_list or features_list[0] is None:
            print(f"No audio features found from Spotify API for {track_id}")
            return None
        
        feat = features_list[0]
        
        # Get track metadata as well to make it comprehensive
        meta = sp.track(track_id)
        
        return {
            'track_id': track_id,
            'title': meta.get('name', 'Unknown Song'),
            'artist': ", ".join([a.get('name', '') for a in meta.get('artists', [])]) if meta.get('artists') else 'Unknown Artist',
            'danceability': float(feat.get('danceability', 0.0)) * 100.0,
            'energy': float(feat.get('energy', 0.0)) * 100.0,
            'valence': float(feat.get('valence', 0.0)) * 100.0,
            'tempo': float(feat.get('tempo', 120.0)),
            'acousticness': float(feat.get('acousticness', 0.0)) * 100.0,
            'loudness': float(feat.get('loudness', -6.0)),
            'preview_url': meta.get('preview_url'),
            'cover_art_url': meta.get('album', {}).get('images', [{}])[0].get('url') if meta.get('album', {}).get('images') else None,
            'source': 'official_spotify_api'
        }
    except Exception as e:
        print(f"Official Spotify API fallback error for {track_id}: {e}")
    return None

