import re
import csv
import os
import requests

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

def fetch_from_reccobeats(track_id: str) -> dict:
    """Fetches track metadata and audio features from the public ReccoBeats API."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    # 1. Fetch metadata (Title, Artist)
    metadata_url = f"https://api.reccobeats.com/v1/track?ids={track_id}"
    title = "Unknown Song"
    artist = "Unknown Artist"
    try:
        meta_res = requests.get(metadata_url, headers=headers, timeout=5)
        if meta_res.status_code == 200:
            content = meta_res.json().get('content', [])
            if content:
                track_info = content[0]
                title = track_info.get('trackTitle', 'Unknown Song')
                artists = track_info.get('artists', [])
                if artists:
                    artist = ", ".join([a.get('name', '') for a in artists if a.get('name')])
    except Exception as e:
        print(f"Metadata fetch failed: {e}")

    # 2. Fetch audio features
    features_url = f"https://api.reccobeats.com/v1/audio-features?ids={track_id}"
    try:
        feat_res = requests.get(features_url, headers=headers, timeout=5)
        if feat_res.status_code == 200:
            content = feat_res.json().get('content', [])
            if content:
                feat = content[0]
                
                # NOTE: ReccoBeats returns values between 0.0 and 1.0 for:
                # acousticness, danceability, energy, valence.
                # The training set is on a scale of 0 to 100.
                # We scale these four variables to match the CSV features.
                return {
                    'track_id': track_id,
                    'title': title,
                    'artist': artist,
                    'danceability': float(feat.get('danceability', 0.0)) * 100.0,
                    'energy': float(feat.get('energy', 0.0)) * 100.0,
                    'valence': float(feat.get('valence', 0.0)) * 100.0,
                    'tempo': float(feat.get('tempo', 120.0)),
                    # Ensure acousticness is scaled 0-100
                    'acousticness': float(feat.get('acousticness', 0.0)) * 100.0,
                    'loudness': float(feat.get('loudness', -6.0)),
                    'source': 'reccobeats_api'
                }
    except Exception as e:
        print(f"Features fetch failed: {e}")
        
    return None
