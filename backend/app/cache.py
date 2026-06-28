import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

_client = None

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
    """Looks up track features and vibe score in the Supabase cache."""
    client = get_supabase_client()
    if not client:
        return None
        
    try:
        res = client.table("track_cache").select("*").eq("track_id", track_id).execute()
        if res.data:
            data = res.data[0]
            # Convert keys to match our unified dictionary format
            return {
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
                'source': 'supabase_cache'
            }
    except Exception as e:
        print(f"Supabase cache lookup error: {e}")
    return None

def save_cache(features: dict, vibe_score: float) -> bool:
    """Saves track features and calculated vibe score to the Supabase cache."""
    client = get_supabase_client()
    if not client:
        return False
        
    try:
        payload = {
            'track_id': features['track_id'],
            'title': features['title'],
            'artist': features['artist'],
            'danceability': float(features['danceability']),
            'energy': float(features['energy']),
            'valence': float(features['valence']),
            'tempo': float(features['tempo']),
            'acousticness': float(features['acousticness']),
            'loudness': float(features['loudness']),
            'vibe_score': float(vibe_score)
        }
        # Upsert: insert or update if track_id exists
        client.table("track_cache").upsert(payload).execute()
        return True
    except Exception as e:
        print(f"Supabase cache save error: {e}")
    return False
