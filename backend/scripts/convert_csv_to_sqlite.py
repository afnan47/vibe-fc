import os
import csv
import sqlite3

def convert():
    csv_path = "The Ultimate FUT Playlist.csv"
    db_path = "The Ultimate FUT Playlist.db"
    
    if not os.path.exists(csv_path):
        # Check one level up
        parent_csv = os.path.join("..", csv_path)
        if os.path.exists(parent_csv):
            csv_path = parent_csv
            db_path = os.path.join("..", db_path)
        else:
            print(f"Error: CSV file not found at {csv_path}")
            return
        
    print(f"Reading {csv_path} and writing to {db_path}...")
    
    # Connect to SQLite
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracks (
            track_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            danceability REAL NOT NULL,
            energy REAL NOT NULL,
            valence REAL NOT NULL,
            tempo REAL NOT NULL,
            acousticness REAL NOT NULL,
            loudness REAL NOT NULL
        )
    """)
    
    # Create indexes for search autocomplete performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);")
    
    inserted = 0
    skipped = 0
    
    with open(csv_path, mode='r', encoding='latin-1') as f:
        reader = csv.DictReader(f)
        for row in reader:
            track_id = row.get('Spotify Track Id')
            if not track_id or len(track_id.strip()) != 22:
                skipped += 1
                continue
                
            track_id = track_id.strip()
            title = row.get('Song', 'Unknown Song').strip()
            artist = row.get('Artist', 'Unknown Artist').strip()
            
            try:
                danceability = float(row.get('Dance', 0))
                energy = float(row.get('Energy', 0))
                valence = float(row.get('Valence', 0))
                tempo = float(row.get('BPM', 0))
                acousticness = float(row.get('Acoustic', 0))
                loudness = float(row.get('Loud (Db)', 0))
            except ValueError:
                skipped += 1
                continue
                
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO tracks 
                    (track_id, title, artist, danceability, energy, valence, tempo, acousticness, loudness)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (track_id, title, artist, danceability, energy, valence, tempo, acousticness, loudness))
                inserted += 1
            except Exception as e:
                print(f"Error inserting row: {e}")
                skipped += 1
                
    conn.commit()
    
    # Get database file size
    db_size = os.path.getsize(db_path)
    csv_size = os.path.getsize(csv_path)
    
    print(f"Conversion complete!")
    print(f"Inserted: {inserted} tracks")
    print(f"Skipped: {skipped} rows")
    print(f"Original CSV Size: {csv_size / 1024:.2f} KB")
    print(f"New SQLite DB Size: {db_size / 1024:.2f} KB")
    
    # Verify a search query
    cursor.execute("SELECT * FROM tracks LIMIT 1")
    print("Sample track:", cursor.fetchone())
    
    conn.close()

if __name__ == "__main__":
    convert()
