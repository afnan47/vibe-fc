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

    import sqlite3
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "The Ultimate FUT Playlist.db")
    if not os.path.exists(db_path):
        print(f"Error: SQLite DB file not found at {db_path}")
        return

    print("Connecting to Supabase...")
    client = create_client(supabase_url, supabase_key)
    
    print("Reading tracks from SQLite database...")
    tracks = []
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT track_id, title, artist, danceability, energy, valence, tempo, acousticness, loudness FROM tracks")
        rows = cursor.fetchall()
        conn.close()
        
        for row in rows:
            track_id = row[0]
            if not track_id or len(track_id.strip()) != 22:
                continue
                
            dance = float(row[3])
            energy = float(row[4])
            valence = float(row[5])
            tempo = float(row[6])
            acoustic = float(row[7])
            loudness = float(row[8])
            
            # Build cache payload. Score is set to 100.0 (or we can estimate/fallback, but this guarantees it's scouted)
            tracks.append({
                'track_id': track_id.strip(),
                'title': row[1] or 'Unknown Song',
                'artist': row[2] or 'Unknown Artist',
                'danceability': dance * 100.0 if dance <= 1.0 else dance,
                'energy': energy * 100.0 if energy <= 1.0 else energy,
                'valence': valence * 100.0 if valence <= 1.0 else valence,
                'tempo': tempo,
                'acousticness': acoustic * 100.0 if acoustic <= 1.0 else acoustic,
                'loudness': loudness,
                'vibe_score': 100.0, # Pre-approved official soundtrack
                'preview_url': None,
                'cover_art_url': None
            })
    except Exception as e:
        print(f"Error reading SQLite database: {e}")
        return

    print(f"Loaded {len(tracks)} tracks from database. Seeding to Supabase...")
    
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
