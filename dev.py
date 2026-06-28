import subprocess
import sys
import os
import time

def main():
    print("====================================================")
    print("           FIFA VIBE FC - DEVELOPER RUNNER          ")
    print("====================================================")

    # 1. Verify backend model exists
    models_dir = os.path.join("backend", "models")
    if not os.path.exists(os.path.join(models_dir, "vibe_model.joblib")):
        print("[!] Warning: Trained model assets not found.")
        print("[*] Training the One-Class SVM model first...")
        try:
            subprocess.run([sys.executable, "backend/scripts/train_vibe_model.py"], check=True)
        except Exception as e:
            print(f"[x] Failed to run training script: {e}")
            sys.exit(1)
            
    # 2. Start FastAPI Backend
    print("\n[*] Starting FastAPI Backend on http://127.0.0.1:8000...")
    backend_cmd = [".venv/Scripts/python", "backend/run.py"]
    if not os.path.exists(".venv"):
        backend_cmd = [sys.executable, "backend/run.py"] # Fallback
        
    backend_process = subprocess.Popen(
        backend_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # 3. Start Vite Frontend
    print("[*] Starting Vite React Frontend on http://localhost:5173...")
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend",
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # Function to print output from a process in a non-blocking way
    def check_process_output(process, prefix):
        if process.poll() is not None:
            return False
        # Read available lines
        line = process.stdout.readline()
        if line:
            print(f"[{prefix}] {line.strip()}")
        return True

    print("\nApplication started! Press Ctrl+C to stop both servers.")
    print("----------------------------------------------------\n")

    try:
        while True:
            # Check processes and print logs
            backend_alive = check_process_output(backend_process, "Backend")
            frontend_alive = check_process_output(frontend_process, "Frontend")
            
            # Sleep briefly to avoid 100% CPU usage
            time.sleep(0.01)
            
            if backend_process.poll() is not None and frontend_process.poll() is not None:
                break
    except KeyboardInterrupt:
        print("\nStopping servers...")
    finally:
        backend_process.terminate()
        frontend_process.terminate()
        backend_process.wait()
        frontend_process.wait()
        print("[-] Servers stopped.")

if __name__ == '__main__':
    main()
