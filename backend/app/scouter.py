import os
import re
import json
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime

import requests
from dotenv import load_dotenv

from .cache import get_supabase_client, lookup_cache, save_cache
from .fetcher import (
    get_spotify_api_client,
    search_local_csv,
    query_sharded_parquet_lake,
    fetch_from_rapidapi,
    fetch_from_spotify_api,
    fetch_spotify_metadata_via_embed,
    fetch_fallback_metadata_features,
)
from .model import score_track

load_dotenv()

SPOTIFY_NMF_PLAYLIST_ID = os.getenv("SPOTIFY_NMF_PLAYLIST_ID", "37i9dQZF1DX4JAvHpjipBk")
PITCHFORK_RSS_URL = os.getenv("PITCHFORK_RSS_URL", "https://pitchfork.com/feed/feed-track-reviews/rss")
SOUNDCLOUD_CLIENT_ID = os.getenv("SOUNDCLOUD_CLIENT_ID", "")


# ---------------------------------------------------------------------------
# Platform Crawlers
# ---------------------------------------------------------------------------

def crawl_spotify_nmf(max_tracks: int = 20) -> list[dict]:
    """Fetch newest tracks from Spotify's New Music Friday playlist.

    Uses Spotify embed scraping (no API key required).
    Falls back to Spotipy if available.
    """
    # Try Spotipy first (fastest, most reliable when it works)
    sp = get_spotify_api_client()
    if sp:
        try:
            results = sp.playlist_tracks(SPOTIFY_NMF_PLAYLIST_ID, limit=max_tracks, fields="items(track(id,name,artists(name)))")
            tracks = []
            for item in results.get("items", []):
                t = item.get("track")
                if not t or not t.get("id"):
                    continue
                tracks.append({
                    "track_id": t["id"],
                    "title": t.get("name", "Unknown"),
                    "artist": ", ".join(a["name"] for a in t.get("artists", []) if a.get("name")),
                    "source_platform": "spotify_nmf",
                })
            print(f"[Scouter] Spotify NMF (API): found {len(tracks)} tracks")
            return tracks
        except Exception as e:
            print(f"[Scouter] Spotify NMF API failed ({e}), falling back to embed scrape...")

    # Fallback: scrape the embed playlist page (no auth required)
    try:
        url = f"https://open.spotify.com/embed/playlist/{SPOTIFY_NMF_PLAYLIST_ID}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            print(f"[Scouter] Spotify NMF embed page returned {r.status_code}")
            return []

        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">([\s\S]+?)</script>', r.text)
        if not match:
            print("[Scouter] Spotify NMF embed: no __NEXT_DATA__ found")
            return []

        data = json.loads(match.group(1))
        props = data.get("props", {})
        page_props = props.get("pageProps", {})
        state = page_props.get("state", {})
        entity = state.get("data", {}).get("entity", {})

        tracks = []
        track_list = entity.get("trackList", entity.get("items", entity.get("tracks", {}).get("items", [])))
        if not isinstance(track_list, list):
            track_list = []

        for item in track_list:
            if len(tracks) >= max_tracks:
                break
            uri = item.get("uri", "")
            tid = uri.split(":")[-1] if ":" in uri else item.get("id", "")
            if not tid or len(tid) != 22:
                continue
            tracks.append({
                "track_id": tid,
                "title": item.get("title", "Unknown"),
                "artist": item.get("subtitle", "Unknown"),
                "source_platform": "spotify_nmf",
            })

        print(f"[Scouter] Spotify NMF (embed): found {len(tracks)} tracks")
        return tracks
    except Exception as e:
        print(f"[Scouter] Spotify NMF embed scrape error: {e}")
        return []


def crawl_pitchfork(max_tracks: int = 15) -> list[dict]:
    """Parse Pitchfork's Best New Tracks RSS feed."""
    try:
        r = requests.get(PITCHFORK_RSS_URL, timeout=15)
        r.raise_for_status()
        root = ET.fromstring(r.content)

        ns = {"atom": "http://www.w3.org/2005/Atom"}
        entries = root.findall(".//atom:entry", ns)
        if not entries:
            entries = root.findall(".//item")

        tracks = []
        for entry in entries:
            if len(tracks) >= max_tracks:
                break
            title_el = entry.find("atom:title", ns) or entry.find("title")
            desc_el = entry.find("atom:summary", ns) or entry.find("description")
            if title_el is None or title_el.text is None:
                continue

            raw_title = title_el.text.strip()
            artist, song = _parse_pitchfork_title(raw_title)
            if not song or not artist:
                continue

            track_id = _search_spotify_id(song, artist)
            if track_id:
                tracks.append({
                    "track_id": track_id,
                    "title": song,
                    "artist": artist,
                    "source_platform": "pitchfork",
                })
            time.sleep(0.3)

        print(f"[Scouter] Pitchfork: resolved {len(tracks)} tracks")
        return tracks
    except Exception as e:
        print(f"[Scouter] Pitchfork crawl error: {e}")
        return []


def crawl_soundcloud(max_tracks: int = 15) -> list[dict]:
    """Fetch trending tracks from SoundCloud's public chart API."""
    if not SOUNDCLOUD_CLIENT_ID:
        print("[Scouter] SOUNDCLOUD_CLIENT_ID not set, attempting to extract from web...")
        cid = _extract_soundcloud_client_id()
        if not cid:
            print("[Scouter] Could not obtain SoundCloud client_id, skipping.")
            return []
        soundcloud_client_id = cid
    else:
        soundcloud_client_id = SOUNDCLOUD_CLIENT_ID

    try:
        url = "https://api-v2.soundcloud.com/charts"
        params = {
            "kind": "trending",
            "genre": "soundcloud:genres:all-music",
            "client_id": soundcloud_client_id,
            "limit": max_tracks,
            "offset": 0,
        }
        r = requests.get(url, params=params, timeout=15)
        if r.status_code != 200:
            print(f"[Scouter] SoundCloud API returned {r.status_code}")
            return []

        data = r.json()
        tracks = []
        for entry in data.get("collection", []):
            t = entry.get("track", {})
            if not t.get("permalink_url"):
                continue
            title = t.get("title", "")
            artist = t.get("user", {}).get("username", "")

            track_id = _search_spotify_id(title, artist)
            if track_id:
                tracks.append({
                    "track_id": track_id,
                    "title": title,
                    "artist": artist,
                    "source_platform": "soundcloud",
                })
            if len(tracks) >= max_tracks:
                break
            time.sleep(0.3)

        print(f"[Scouter] SoundCloud: resolved {len(tracks)} tracks")
        return tracks
    except Exception as e:
        print(f"[Scouter] SoundCloud crawl error: {e}")
        return []


def crawl_golden_pool(count: int = 15) -> list[dict]:
    """Pick random tracks from the golden dataset CSV as a guaranteed fallback."""
    import pandas as pd
    csv_path = "The Ultimate FUT Playlist.csv"
    if not os.path.exists(csv_path):
        csv_path = os.path.join("..", csv_path)
        if not os.path.exists(csv_path):
            print("[Scouter] Golden CSV not found, skipping pool.")
            return []
    try:
        df = pd.read_csv(csv_path, encoding="latin-1")
        valid = df.dropna(subset=["Spotify Track Id", "Song", "Artist"])
        samples = valid.sample(n=min(count, len(valid)))
        tracks = []
        for _, row in samples.iterrows():
            tid = str(row["Spotify Track Id"]).strip()
            if len(tid) == 22:
                tracks.append({
                    "track_id": tid,
                    "title": str(row.get("Song", "Unknown")),
                    "artist": str(row.get("Artist", "Unknown")),
                    "source_platform": "fut_classic",
                })
        print(f"[Scouter] Golden Pool: selected {len(tracks)} tracks")
        return tracks
    except Exception as e:
        print(f"[Scouter] Golden pool error: {e}")
        return []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_pitchfork_title(raw: str) -> tuple[str | None, str | None]:
    """Parse 'Artist: "Song Title"' or 'Artist — Song' formats."""
    # Format: Artist: "Song Title"
    m = re.match(r'^(.+?):\s*["\u201c](.+?)["\u201d]', raw)
    if m:
        return m.group(1).strip(), m.group(2).strip()

    # Format: Artist — Song
    m = re.match(r'^(.+?)\s*[\u2014\u2013-]\s*(.+)$', raw)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, None


def _search_spotify_id(song: str, artist: str) -> str | None:
    """Search Spotify for a track by name + artist, return first track ID.

    Tries Spotipy first, falls back to anonymous web search.
    """
    # Try Spotipy
    sp = get_spotify_api_client()
    if sp:
        try:
            query = f"track:{song} artist:{artist}"
            results = sp.search(q=query, type="track", limit=1)
            items = results.get("tracks", {}).get("items", [])
            if items:
                return items[0]["id"]
        except Exception as e:
            print(f"[Scouter] Spotipy search failed for '{song}', falling back to web search...")
            if "403" in str(e) or "premium" in str(e).lower():
                from .fetcher import disable_spotify_api
                disable_spotify_api()
                print("[Scouter] Spotify API disabled due to 403 (No premium subscription) during search.")

    # Fallback: anonymous web search using Spotify's public token
    return _search_spotify_id_via_web(song, artist)


_spotify_web_token: str | None = None


def _get_spotify_web_token() -> str | None:
    """Extract an anonymous access token from Spotify embed page."""
    global _spotify_web_token
    if _spotify_web_token:
        return _spotify_web_token

    try:
        url = f"https://open.spotify.com/embed/playlist/{SPOTIFY_NMF_PLAYLIST_ID}"
        r = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        })
        if r.status_code != 200:
            return None

        # Look in __NEXT_DATA__
        m = re.search(r'<script id="__NEXT_DATA__" type="application/json">([\s\S]+?)</script>', r.text)
        if m:
            data = json.loads(m.group(1))
            state = data.get("props", {}).get("pageProps", {}).get("state", {})
            token = state.get("settings", {}).get("session", {}).get("accessToken")
            if token:
                _spotify_web_token = token
                return _spotify_web_token
    except Exception as e:
        print(f"[Scouter] Failed to get Spotify web token: {e}")
    return None


def _search_spotify_id_via_web(song: str, artist: str) -> str | None:
    """Search Spotify using their internal web API with an anonymous token."""
    token = _get_spotify_web_token()
    if not token:
        return None

    try:
        query = f"track:{song} artist:{artist}"
        url = "https://api.spotify.com/v1/search"
        headers = {"Authorization": f"Bearer {token}"}
        params = {"q": query, "type": "track", "limit": 1}
        r = requests.get(url, headers=headers, params=params, timeout=10)
        if r.status_code == 200:
            data = r.json()
            items = data.get("tracks", {}).get("items", [])
            if items:
                return items[0]["id"]
        else:
            # Token expired, clear cache
            global _spotify_web_token
            _spotify_web_token = None
            print(f"[Scouter] Web search returned {r.status_code}, token cleared")
    except Exception as e:
        print(f"[Scouter] Web search error for '{song}' by '{artist}': {e}")
    return None


def _extract_soundcloud_client_id() -> str | None:
    """Scrape SoundCloud.com for a bootstrapped API client_id."""
    try:
        r = requests.get("https://soundcloud.com", timeout=10)
        m = re.search(r'client_id["\':]\s*["\']([a-zA-Z0-9]+)["\']', r.text)
        if m:
            cid = m.group(1)
            print(f"[Scouter] Extracted SoundCloud client_id from web")
            return cid
    except Exception as e:
        print(f"[Scouter] SoundCloud client_id extraction failed: {e}")
    return None


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def _fetch_features(track_id: str) -> dict | None:
    """Run the existing 4-tier feature pipeline for a single track_id."""
    cached = lookup_cache(track_id)
    if cached:
        return cached

    data = search_local_csv(track_id)
    if not data:
        data = query_sharded_parquet_lake(track_id)
    if not data:
        data = fetch_from_rapidapi(track_id)
    if not data:
        data = fetch_from_spotify_api(track_id)
    if not data:
        data = fetch_fallback_metadata_features(track_id)
    if not data:
        return None

    needs_metadata = (
        not data.get("preview_url")
        or not data.get("cover_art_url")
        or data.get("title") == "Unknown Song"
    )
    if needs_metadata and data.get("source") != "official_spotify_api":
        meta = fetch_spotify_metadata_via_embed(track_id)
        if meta:
            data["title"] = meta.get("title") or data.get("title", "Unknown Song")
            data["artist"] = meta.get("artist") or data.get("artist", "Unknown Artist")
            data["preview_url"] = meta.get("preview_url") or data.get("preview_url")
            data["cover_art_url"] = meta.get("cover_art_url") or data.get("cover_art_url")

    data.setdefault("title", "Unknown Song")
    data.setdefault("artist", "Unknown Artist")
    data.setdefault("preview_url", None)
    data.setdefault("cover_art_url", None)

    try:
        vibe_score, _ = score_track(data)
    except Exception as e:
        print(f"[Scouter] Scoring error for {track_id}: {e}")
        vibe_score = 50.0

    data["vibe_score"] = vibe_score
    save_cache(data, vibe_score)
    return data


def _get_today_batch() -> str:
    return date.today().isoformat()


def run_daily_scout() -> list[dict]:
    """Crawl all platforms, score, pick top 10 unique, save to Supabase."""
    print(f"[Scouter] === Daily Scout Run Started ({datetime.now().isoformat()}) ===")

    batch_id = _get_today_batch()
    supabase = get_supabase_client()

    if not supabase:
        print("[Scouter] Supabase client unavailable, can't persist scouted tracks.")
        return []

    raw_candidates: list[dict] = []
    seen_ids: set[str] = set()

    sources = [
        ("Spotify NMF", crawl_spotify_nmf()),
        ("Pitchfork", crawl_pitchfork()),
        ("SoundCloud", crawl_soundcloud()),
    ]

    # Ensure some initial pool size
    total_candidates = sum(len(c) for _, c in sources)
    if total_candidates < 10:
        needed = 15 - total_candidates
        golden = crawl_golden_pool(needed)
        if golden:
            sources.append(("FUT Classic", golden))

    for name, candidates in sources:
        for c in candidates:
            tid = c["track_id"]
            if tid not in seen_ids:
                seen_ids.add(tid)
                raw_candidates.append(c)
            else:
                print(f"[Scouter]  -> skipping duplicate {tid} from {name}")

    print(f"[Scouter] Total unique candidates: {len(raw_candidates)}")

    scored: list[dict] = []
    for i, c in enumerate(raw_candidates):
        print(f"[Scouter]  [{i+1}/{len(raw_candidates)}] Fetching features for {c['track_id']}...")
        features = _fetch_features(c["track_id"])
        if features and features.get("vibe_score") is not None:
            scored.append({
                "track_id": c["track_id"],
                "title": features.get("title", "Unknown"),
                "artist": features.get("artist", "Unknown"),
                "vibe_score": float(features["vibe_score"]),
                "source_platform": c["source_platform"],
                "cover_art_url": features.get("cover_art_url"),
                "preview_url": features.get("preview_url"),
            })
        time.sleep(0.1)

    # Supplement from Golden Pool if we don't have enough successfully scored tracks
    if len(scored) < 10:
        print(f"[Scouter] Only {len(scored)} tracks successfully scored. Supplementing from Golden Pool...")
        needed = 15 - len(scored)
        golden = crawl_golden_pool(needed)
        for c in golden:
            tid = c["track_id"]
            if tid not in seen_ids:
                seen_ids.add(tid)
                print(f"[Scouter] Fetching features for Golden Pool track {tid}...")
                features = _fetch_features(tid)
                if features and features.get("vibe_score") is not None:
                    scored.append({
                        "track_id": tid,
                        "title": features.get("title", "Unknown"),
                        "artist": features.get("artist", "Unknown"),
                        "vibe_score": float(features["vibe_score"]),
                        "source_platform": c["source_platform"],
                        "cover_art_url": features.get("cover_art_url"),
                        "preview_url": features.get("preview_url"),
                    })

    scored.sort(key=lambda x: x["vibe_score"], reverse=True)
    top10 = scored[:10]

    print(f"[Scouter] === Top 10 Elite Tracks ===")
    for i, t in enumerate(top10, 1):
        print(f"  {i}. {t['title']} - {t['artist']} ({t['vibe_score']:.1f}%) [{t['source_platform']}]")

    # Remove old batch for today (if re-run), then insert fresh
    try:
        supabase.table("scouted_tracks").delete().eq("scout_batch_id", batch_id).execute()
    except Exception as e:
        print(f"[Scouter] Error clearing old batch: {e}")

    for rank, t in enumerate(top10, 1):
        payload = {
            "track_id": t["track_id"],
            "scout_batch_id": batch_id,
            "scout_rank": rank,
            "vibe_score": t["vibe_score"],
            "source_platform": t["source_platform"],
        }
        try:
            supabase.table("scouted_tracks").insert(payload).execute()
        except Exception as e:
            print(f"[Scouter] Error inserting {t['track_id']}: {e}")

    print(f"[Scouter] === Daily Scout Complete ({datetime.now().isoformat()}) ===")
    return top10


def get_scouter_playlist() -> list[dict]:
    """Return today's top 10 from Supabase, with full metadata from track_cache."""
    supabase = get_supabase_client()
    if not supabase:
        return []

    batch_id = _get_today_batch()
    try:
        res = supabase.table("scouted_tracks") \
            .select("*, track_cache!inner(title, artist, preview_url, cover_art_url)") \
            .eq("scout_batch_id", batch_id) \
            .order("scout_rank") \
            .execute()
        return res.data or []
    except Exception as e:
        print(f"[Scouter] Error fetching playlist: {e}")
        return []
