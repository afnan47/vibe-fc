import os
from datetime import datetime

def log_search_path(track_id: str, path_steps: list, final_source: str, track_info: dict = None):
    """Logs the song search path details to backend/app/search_paths.log and prints to stdout."""
    log_dir = os.path.dirname(os.path.abspath(__file__))
    log_file_path = os.path.join(log_dir, "search_paths.log")
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    steps_str = " -> ".join(path_steps)
    
    title = "Unknown"
    artist = "Unknown"
    if track_info:
        title = track_info.get("title") or track_info.get("name") or "Unknown"
        artist = track_info.get("artist") or "Unknown"
        
    log_line = f"[{timestamp}] ID: {track_id} | Track: '{title}' by '{artist}' | Path: {steps_str} | Found At: {final_source}\n"
    
    # Print to console/stdout for real-time visibility
    print(f"[SearchPathLog] {log_line.strip()}", flush=True)
    
    try:
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(log_line)
    except Exception as e:
        print(f"Failed to write to search_paths.log: {e}", flush=True)
