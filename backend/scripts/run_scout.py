import os
import sys
import asyncio
from dotenv import load_dotenv

# Add backend directory to sys.path so we can import app modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

# Load environment variables (useful for local testing)
dotenv_path = os.path.join(backend_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

from app.scouter import run_daily_scout_async

async def main():
    print("Initializing Vibe Scouter Daily Crawl...")
    try:
        results = await run_daily_scout_async()
        print(f"Scout completed successfully. Ranked {len(results)} tracks.")
        for i, t in enumerate(results, 1):
            print(f"  {i}. {t['title']} - {t['artist']} ({t['vibe_score']:.1f}%)")
    except Exception as e:
        print(f"Scouter execution failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
