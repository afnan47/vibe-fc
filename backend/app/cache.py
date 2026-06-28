import os
from collections import OrderedDict
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

_client = None

# In-memory LRU cache for hot track lookups
_memory_cache = OrderedDict()
MEMORY_CACHE_MAX = 200

def lookup_memory_cache(track_id: str) -> dict | None:
    """Fast in-memory LRU lookup — avoids a Supabase network hop for hot tracks."""
    global _memory_cache
    if track_id in _memory_cache:
        _memory_cache.move_to_end(track_id)
        return _memory_cache[track_id]
    return None

def save_memory_cache(record: dict) -> None:
    """Stores a record in the in-memory LRU cache."""
    global _memory_cache
    _memory_cache[record['track_id']] = record
    if len(_memory_cache) > MEMORY_CACHE_MAX:
        _memory_cache.popitem(last=False)

def get_supabase_client() -> Client:
    """Returns the cached Supabase client or initializes it if config is present."""
    global _client
    if _client is not None:
        return _client
        
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Warning: Supabase credentials not found in environment. Caching is disabled.")
        return None
        
    try:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _client
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")
        return None

def lookup_cache(track_id: str) -> dict:
    """Looks up track features and vibe score, checking in-memory cache first."""
    cached = lookup_memory_cache(track_id)
    if cached:
        return cached

    client = get_supabase_client()
    if not client:
        return None
        
    try:
        res = client.table("track_cache").select("*").eq("track_id", track_id).execute()
        if res.data:
            data = res.data[0]
            record = {
                'track_id': data.get('track_id'),
                'title': data.get('title'),
                'artist': data.get('artist'),
                'danceability': float(data.get('danceability', 0)),
                'energy': float(data.get('energy', 0)),
                'valence': float(data.get('valence', 0)),
                'tempo': float(data.get('tempo', 0)),
                'acousticness': float(data.get('acousticness', 0)),
                'loudness': float(data.get('loudness', 0)),
                'vibe_score': float(data.get('vibe_score', 0)),
                'preview_url': data.get('preview_url'),
                'cover_art_url': data.get('cover_art_url'),
                'source': 'supabase_cache'
            }
            save_memory_cache(record)
            return record
    except Exception as e:
        print(f"Supabase cache lookup error: {e}")
    return None

def save_cache(features: dict, vibe_score: float) -> bool:
    """Saves track features and calculated vibe score to both memory and Supabase cache."""
    record = {
        'track_id': features['track_id'],
        'title': features['title'],
        'artist': features['artist'],
        'danceability': float(features['danceability']),
        'energy': float(features['energy']),
        'valence': float(features['valence']),
        'tempo': float(features['tempo']),
        'acousticness': float(features['acousticness']),
        'loudness': float(features['loudness']),
        'vibe_score': float(vibe_score),
        'preview_url': features.get('preview_url'),
        'cover_art_url': features.get('cover_art_url'),
        'source': 'supabase_cache'
    }
    save_memory_cache(record)
    
    client = get_supabase_client()
    if not client:
        return False

    payload = {k: v for k, v in record.items() if k != 'source'}
    
    try:
        # Upsert: insert or update if track_id exists
        client.table("track_cache").upsert(payload).execute()
        return True
    except Exception as e:
        print(f"Supabase cache save error with full payload: {e}")
        print("Retrying save without preview_url and cover_art_url (migration might not be applied yet)...")
        # Fallback to schema without the new columns
        fallback_payload = {k: v for k, v in payload.items() if k not in ['preview_url', 'cover_art_url']}
        try:
            client.table("track_cache").upsert(fallback_payload).execute()
            print("Successfully cached fallback payload.")
            return True
        except Exception as e_fallback:
            print(f"Supabase cache save fallback error: {e_fallback}")
    return False
