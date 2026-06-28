import os
import csv
from dotenv import load_dotenv
from supabase import create_client

def seed_database():
    # Load environment variables
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
    else:
        load_dotenv()
        
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("Error: Supabase credentials not found in environment.")
        return

    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "The Ultimate FUT Playlist.csv")
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return

    print("Connecting to Supabase...")
    client = create_client(supabase_url, supabase_key)
    
    print("Reading CSV tracks...")
    tracks = []
    with open(csv_path, mode='r', encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for row in reader:
            track_id = row.get('Spotify Track Id')
            if not track_id or len(track_id.strip()) != 22:
                continue
                
            # Build cache payload. Score is set to 100.0 (or we can estimate/fallback, but this guarantees it's scouted)
            tracks.append({
                'track_id': track_id.strip(),
                'title': row.get('Song', 'Unknown Song'),
                'artist': row.get('Artist', 'Unknown Artist'),
                'danceability': float(row.get('Dance', 0)) * 100.0 if float(row.get('Dance', 0)) <= 1.0 else float(row.get('Dance', 0)),
                'energy': float(row.get('Energy', 0)) * 100.0 if float(row.get('Energy', 0)) <= 1.0 else float(row.get('Energy', 0)),
                'valence': float(row.get('Valence', 0)) * 100.0 if float(row.get('Valence', 0)) <= 1.0 else float(row.get('Valence', 0)),
                'tempo': float(row.get('BPM', 0)),
                'acousticness': float(row.get('Acoustic', 0)) * 100.0 if float(row.get('Acoustic', 0)) <= 1.0 else float(row.get('Acoustic', 0)),
                'loudness': float(row.get('Loud (Db)', 0)),
                'vibe_score': 100.0, # Pre-approved official soundtrack
                'preview_url': None,
                'cover_art_url': None
            })

    print(f"Loaded {len(tracks)} tracks from CSV. Seeding to Supabase...")
    
    # Upsert in batches of 100
    batch_size = 100
    success_count = 0
    for i in range(0, len(tracks), batch_size):
        batch = tracks[i:i+batch_size]
        try:
            client.table("track_cache").upsert(batch).execute()
            success_count += len(batch)
            print(f"Seeded {success_count}/{len(tracks)} tracks...")
        except Exception as e:
            print(f"Error seeding batch starting at index {i}: {e}")
            # Try fallback insertion (older schema without new metadata columns)
            fallback_batch = [{k: v for k, v in t.items() if k not in ['preview_url', 'cover_art_url']} for t in batch]
            try:
                client.table("track_cache").upsert(fallback_batch).execute()
                success_count += len(fallback_batch)
                print(f"Seeded {success_count}/{len(tracks)} tracks using schema fallback...")
            except Exception as e_fallback:
                print(f"Fallback seeding failed: {e_fallback}")
                
    print("Database seeding completed.")

if __name__ == "__main__":
    seed_database()
