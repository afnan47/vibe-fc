import os
import sys
import time
import shutil
import json
import requests
import duckdb
from dotenv import load_dotenv
from huggingface_hub import HfApi

# Define paths relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
ENV_PATH = os.path.join(ROOT_DIR, '.env')
PROGRESS_FILE = os.path.join(SCRIPT_DIR, 'sharding_progress.json')

# Load environment variables
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
HF_REPO_ID = os.getenv("HF_REPO_ID")

def load_progress():
    """Loads the progress state from disk."""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load progress file: {e}")
    return {"completed_files": [], "upload_done": False}

def save_progress(state):
    """Saves the progress state to disk."""
    try:
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to save progress file: {e}")

def download_file(url, dest_path):
    """Downloads a file in chunks with simple progress feedback."""
    print(f"Downloading {url} to {dest_path}...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    # Simple retry mechanism (up to 3 times)
    for attempt in range(3):
        try:
            r = requests.get(url, headers=headers, stream=True, timeout=30)
            if r.status_code != 200:
                print(f"Failed download: status code {r.status_code}")
                time.sleep(2)
                continue
                
            total_size = int(r.headers.get('content-length', 0))
            downloaded = 0
            last_progress = 0
            
            with open(dest_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024): # 1MB chunks
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            percent = int(downloaded * 100 / total_size)
                            # Print progress every 10%
                            if percent // 10 > last_progress:
                                last_progress = percent // 10
                                print(f"  Download progress: {percent}% ({downloaded / (1024*1024):.1f} MB)")
            print("Download completed successfully.")
            return True
        except Exception as e:
            print(f"Download attempt {attempt+1} failed: {e}")
            time.sleep(3)
            
    return False

def run_partitioning():
    if not HF_TOKEN or not HF_REPO_ID:
        print("Error: HF_TOKEN and HF_REPO_ID must be set in your .env file.")
        print(f"Looked for .env file at: {ENV_PATH}")
        sys.exit(1)
        
    local_output_dir = os.path.join(ROOT_DIR, "sharded_spotify_lake")
    temp_file = os.path.join(ROOT_DIR, "temp_dataset.parquet")
    
    # Load progress state
    state = load_progress()
    completed_files = state.setdefault("completed_files", [])
    
    # Create output directory if it doesn't exist
    os.makedirs(local_output_dir, exist_ok=True)
    
    if os.path.exists(temp_file):
        os.remove(temp_file)
        
    print("Connecting to DuckDB...")
    con = duckdb.connect()
    
    # Partition dataset file-by-file (10 files total)
    total_files = 10
    start_time = time.time()
    
    print("\nStarting sharding pipeline (Downloading and partitioning 256M songs)...")
    for i in range(total_files):
        if i in completed_files:
            print(f"\n--- File {i+1} of {total_files} already processed. Skipping. ---")
            continue
            
        file_start = time.time()
        print(f"\n--- Processing file {i+1} of {total_files} ---")
        
        # Source URL on Hugging Face
        url = f"https://huggingface.co/datasets/ozefe/spotify_audio_features/resolve/main/data/spotify_audio_features_{i}.parquet"
        
        # Download file locally to avoid network drops during decompression
        success = download_file(url, temp_file)
        if not success:
            print(f"Error: Failed to download source file {i}. Aborting.")
            if os.path.exists(temp_file):
                os.remove(temp_file)
            sys.exit(1)
            
        print("Sharding file using DuckDB...")
        # SQL Query: extracts lowercase 2-character prefix as partition_key
        query = f"""
            COPY (
                SELECT *, LOWER(SUBSTR(id, 1, 2)) AS partition_key
                FROM '{temp_file.replace('\\', '/')}'
            ) TO '{local_output_dir.replace('\\', '/')}' (
                FORMAT PARQUET,
                PARTITION_BY (partition_key),
                OVERWRITE_OR_IGNORE
            );
        """
        
        try:
            con.execute(query)
            # Remove the temp file immediately to conserve disk space
            os.remove(temp_file)
            file_duration = time.time() - file_start
            print(f"Completed file {i+1} sharding in {file_duration:.2f} seconds.")
            
            # Record progress
            completed_files.append(i)
            state["completed_files"] = completed_files
            save_progress(state)
        except Exception as e:
            print(f"Error partitioning file {i}: {e}")
            if os.path.exists(temp_file):
                os.remove(temp_file)
            print("Aborting partition pipeline.")
            sys.exit(1)
            
    total_duration = time.time() - start_time
    print(f"\nAll sharding completed successfully in {total_duration/60:.2f} minutes.")
    
    # 3. Upload sharded directory to Hugging Face
    if not state.get("upload_done", False):
        print(f"\nInitializing Hugging Face API to upload to repository: {HF_REPO_ID}...")
        try:
            api = HfApi(token=HF_TOKEN)
            
            # Create dataset repo if it doesn't exist
            print(f"Creating/verifying Hugging Face dataset repository: {HF_REPO_ID}...")
            api.create_repo(repo_id=HF_REPO_ID, repo_type="dataset", exist_ok=True)
            
            # Upload sharded folder
            print(f"Uploading partitioned files to Hugging Face (This will take a moment)...")
            upload_start = time.time()
            api.upload_folder(
                folder_path=local_output_dir,
                repo_id=HF_REPO_ID,
                repo_type="dataset"
            )
            upload_duration = time.time() - upload_start
            print(f"Upload completed successfully in {upload_duration/60:.2f} minutes!")
            
            state["upload_done"] = True
            save_progress(state)
            
        except Exception as e:
            print(f"Hugging Face Upload failed: {e}")
            print(f"Note: Sharded files are preserved locally at: {local_output_dir}")
            sys.exit(1)
            
    # 4. Clean up local files to save disk space
    print(f"\nCleaning up local sharded directory to free disk space...")
    try:
        shutil.rmtree(local_output_dir)
        print("Local files cleaned up. 0MB disk space used!")
        # Delete progress file when pipeline is fully complete
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
    except Exception as e:
        print(f"Warning: Failed to delete local sharded files: {e}")
        
    print("\nPipeline finished successfully! Hugging Face sharded Parquet lake is ready.")

if __name__ == "__main__":
    run_partitioning()
