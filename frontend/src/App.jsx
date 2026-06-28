import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import HistoryList from './components/HistoryList';
import ScouterPlaylist from './components/ScouterPlaylist';

// Host setup: FastAPI backend runs on localhost:8000
const API_BASE = 'http://127.0.0.1:8000';

// Quick test tracks from the Golden Dataset
const GOLDEN_EXAMPLES = [
  { id: '3Uj8h9FZigjBq6NYW2wRWC', name: 'Bonafied Lovin', artist: 'Yuksek', desc: 'FIFA 09 Classic' },
  { id: '7bLk4tjwot6OunULKjPcPA', name: 'Lights & Music', artist: 'Cut Copy', desc: 'FIFA 09 Indie Vibe' },
  { id: '1jJci4qxiYcOHhQR247rEU', name: 'Kids', artist: 'MGMT', desc: 'FIFA 09 Anthem' }
];

export default function App() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [datasetStats, setDatasetStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  // Responsive & Active Tab States
  const [activeTab, setActiveTab] = useState('scout'); // 'scout' | 'showcase' | 'leaderboard'
  // Audio Playback State
  const [audio, setAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);


  const [trackInput, setTrackInput] = useState('');
  const [presets, setPresets] = useState([]);

  // Fetch playlist averages and random presets on mount
  useEffect(() => {
    fetchStats();
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/random-presets`);
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.error("Failed to fetch presets:", err);
    }
  };

  // Sync Audio instances when selectedTrack changes
  useEffect(() => {
    if (audio) {
      audio.pause();
      setIsPlaying(false);
      setCurrentTime(0);
    }
    if (selectedTrack?.preview_url) {
      const newAudio = new Audio(selectedTrack.preview_url);
      newAudio.volume = volume;
      newAudio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      newAudio.ontimeupdate = () => {
        setCurrentTime(newAudio.currentTime);
      };
      newAudio.onloadedmetadata = () => {
        setDuration(newAudio.duration || 30);
      };
      setAudio(newAudio);

      // Autoplay preview immediately on track selection unless prevented
      if (selectedTrack.preventAutoplay) {
        setIsPlaying(false);
      } else {
        const playPromise = newAudio.play();
        if (playPromise !== undefined) {
          setIsPlaying(true);
          playPromise.catch(err => {
            console.warn("Autoplay blocked by browser policy:", err);
            setIsPlaying(false);
          });
        }
      }
    } else {
      setAudio(null);
    }
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [selectedTrack]);



  const togglePlay = () => {
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        if (audio.duration) {
          setDuration(audio.duration);
        }
      }).catch(err => console.error("Audio playback interrupted:", err));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e) => {
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  useEffect(() => {
    if (audio) {
      audio.volume = volume;
    }
  }, [volume, audio]);

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };



  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setDatasetStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  };

  const handleSearch = async (inputString, isManualSearch = false) => {
    setIsLoading(true);
    if (isManualSearch) {
      setIsSearchLoading(true);
    }
    setError(null);
    if (isManualSearch) {
      setTrackInput(inputString); // populate the search input box
    } else {
      setTrackInput(''); // Clear the search bar when selecting from lists/presets
    }
    try {
      const res = await fetch(`${API_BASE}/api/vibe?track_input=${encodeURIComponent(inputString)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to analyze track.");
      }
      const data = await res.json();
      const isLink = /https?:\/\//i.test(inputString) || inputString.includes('spotify.com') || inputString.includes('spotify:track:');
      setSelectedTrack({
        ...data,
        preventAutoplay: isLink
      });
      if (isManualSearch) {
        setTrackInput(`${data.title} — ${data.artist}`);
      } else {
        setTrackInput('');
      }
      
      // Haptic feedback trigger (vibrate 100ms, pause 50ms, vibrate 100ms)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      
      
      setHistory(prev => {
        const filtered = prev.filter(t => (t.id || t.track_id) !== (data.id || data.track_id));
        return [data, ...filtered].slice(0, 10);
      }); // Add to session history without duplicates
    } catch (err) {
      setError(err.message);
      setSelectedTrack(null);
    } finally {
      setIsLoading(false);
      setIsSearchLoading(false);
    }
  };

  // Determine FUT Card quality (Gold, Silver, Bronze, TOTS) based on vibe score
  const getCardClass = (score) => {
    if (score >= 85) return 'tots';
    if (score >= 80) return 'gold';
    if (score >= 60) return 'silver';
    return 'bronze';
  };

  // Helper to color-code attribute bars (Green/Cyan, Yellow/Blue, Pink)
  const getBarFillColor = (val) => {
    if (val >= 75) return 'var(--fc-lime)';
    if (val >= 50) return 'var(--fc-blue)';
    return 'var(--fc-pink)';
  };

  // Normalization helper for progress bars matching radar chart logic
  const getNormalizedVal = (key, val) => {
    if (val === undefined || val === null) return 0;
    switch(key) {
      case 'danceability':
      case 'energy':
      case 'valence':
      case 'acousticness':
        return Math.min(Math.max(val, 0), 100);
      case 'tempo':
        return Math.min(Math.max(((val - 60) / (180 - 60)) * 100, 0), 100);
      case 'loudness':
        return Math.min(Math.max(((val - (-20)) / (-2 - (-20))) * 100, 0), 100);
      default:
        return val;
    }
  };

  return (
    <div className="container">
      {/* Header Banner */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h1>
              FUTVIBE
            </h1>
          </div>
        </div>
      </header>

      {/* Main Grid: 3 columns */}
      <div className="main-app-grid">
        {/* Column 1: Left Sidebar (Search + Recent Scouts) */}
        <div className={`glass-card app-col-scout ${activeTab === 'scout' ? 'active-tab' : ''}`} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          height: '100%',
          minHeight: 0,
          padding: '1.25rem',
          boxSizing: 'border-box'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              fontStyle: 'italic',
              color: 'var(--text-primary)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              margin: '0 0 0.75rem 0'
            }}>Scout Track
            </h3>
            <SearchBar onSearch={(val) => handleSearch(val, true)} isLoading={isSearchLoading} value={trackInput} onChange={setTrackInput} />
          </div>

          <div style={{
            width: '100%',
            height: '1.5px',
            background: 'rgba(255, 255, 255, 0.06)',
          }}></div>

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden'
          }}>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              fontStyle: 'italic',
              color: 'var(--text-primary)',
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              margin: '0 0 0.75rem 0'
            }}>Recent Scouts
            </h3>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <HistoryList history={history} onSelectTrack={(val) => handleSearch(val, false)} layout="vertical" />
            </div>
          </div>
        </div>

        {/* Column 2: Center Showcase Area */}
        <div className={`app-col-showcase ${activeTab === 'showcase' ? 'active-tab' : ''}`} style={{
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              textAlign: 'center',
              flexShrink: 0,
              width: '100%',
              marginBottom: '1rem'
            }}>
              Warning: {error}
            </div>
          )}

          <div style={{
            flex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
          }}>
            {isLoading ? (
              /* Pulse Skeleton Card */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                flexShrink: 0
              }}>
                <h2 style={{
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: 'var(--fc-lime)',
                  textShadow: '0 0 10px var(--fc-lime-glow)',
                  margin: '0 0 0.5rem 0'
                }}>
                  Scouting Song Pack...
                </h2>
                <div className="fut-card-wrapper">
                  <div className="fut-card-border-glow" style={{ animation: 'borderGlowPulse 1.5s infinite ease-in-out' }}>
                    <div className="fut-skeleton">
                      {/* Top-left: rating + position block */}
                      <div className="skel-rating-block">
                        <div className="skel-chip skel-chip--lg"></div>
                        <div className="skel-chip skel-chip--sm"></div>
                        {/* Playstyle badge on left edge */}
                        <div className="skel-playstyle"></div>
                      </div>

                      {/* Photo area */}
                      <div className="skel-photo"></div>

                      {/* Divider */}
                      <div className="skel-divider"></div>

                      {/* Song name + artist */}
                      <div className="skel-chip skel-chip--name"></div>
                      <div className="skel-chip skel-chip--artist"></div>

                      {/* 6-stat row */}
                      <div className="skel-stats-row">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="skel-stat-col">
                            <div className="skel-chip skel-chip--stat-label"></div>
                            <div className="skel-chip skel-chip--stat-val"></div>
                          </div>
                        ))}
                      </div>

                      {/* Bottom: 3 badge circles (flag / league / club) */}
                      <div className="skel-badges-row">
                        <div className="skel-badge-circle"></div>
                        <div className="skel-badge-circle"></div>
                        <div className="skel-badge-circle"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedTrack ? (
              /* FUT Player-Style Song Card */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.25rem',
                flexShrink: 0
              }}>
                <div 
                  className="fut-card-wrapper"
                  onMouseMove={(e) => {
                    const card = e.currentTarget.querySelector('.fut-card-border-glow');
                    if (!card) return;
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const midX = rect.width / 2;
                    const midY = rect.height / 2;
                    const rotX = -((y - midY) / midY) * 15; // Max 15deg tilt
                    const rotY = ((x - midX) / midX) * 15;
                    
                    card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
                    card.style.setProperty('--sheen-x', `${(x / rect.width) * 100 - 50}%`);
                    card.style.setProperty('--sheen-y', `${(y / rect.height) * 100 - 50}%`);
                  }}
                  onMouseLeave={(e) => {
                    const card = e.currentTarget.querySelector('.fut-card-border-glow');
                    if (!card) return;
                    card.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
                    card.style.setProperty('--sheen-x', '0%');
                    card.style.setProperty('--sheen-y', '0%');
                  }}
                >
                  {/* Key on outer wrapper resets the entire card stack on track change */}
                  <div className="vibe-active-glow" key={selectedTrack.id}>
                    <div className="fut-card-border-glow reveal-anim">
                      <div className={`fut-card ${getCardClass(selectedTrack.vibe_score)}`}>
                        {/* Rating badge */}
                        <div className="badge-rating">
                          <span className="rating-val">{Math.round(selectedTrack.vibe_score)}</span>
                          <span className="position-val">VIB</span>
                        </div>

                        {/* Cover art area — clean, no overlay */}
                        <div 
                          className={`card-art ${isPlaying ? 'playing' : ''}`}
                          style={{
                            backgroundImage: selectedTrack?.cover_art_url ? `url(${selectedTrack.cover_art_url})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            position: 'relative'
                          }}
                        >
                          {!selectedTrack?.cover_art_url && <span>🎵</span>}
                        </div>
                        
                        {/* Horizontal divider line like player card */}
                        <div style={{
                          width: '80%',
                          height: '1.5px',
                          background: 'rgba(255, 255, 255, 0.18)',
                          margin: '0.25rem 0 0.5rem 0'
                        }}></div>

                        {/* Title & Artist */}
                        <div className="song-name">
                          {selectedTrack?.title}
                        </div>
                        <div className="artist-name">
                          {selectedTrack?.artist}
                        </div>
                        
                        {/* FUT 6-stat breakdown */}
                        <div className="stats-grid">
                          <div className="stat-item">
                            <span className="stat-label">DAN</span>
                            <span className="stat-val">{Math.round(selectedTrack.danceability)}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">ENG</span>
                            <span className="stat-val">{Math.round(selectedTrack.energy)}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">VAL</span>
                            <span className="stat-val">{Math.round(selectedTrack.valence)}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">TEM</span>
                            <span className="stat-val">{Math.round(selectedTrack.tempo)}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">LOU</span>
                            <span className="stat-val">{Math.round(selectedTrack.loudness)}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">ACO</span>
                            <span className="stat-val">{Math.round(selectedTrack.acousticness)}</span>
                          </div>
                        </div>

                        {/* Bottom badge row: Spotify logo only */}
                        <div className="badges-row">
                          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '15px', height: '15px', opacity: 0.75 }}>
                            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.377-1.454-5.37-1.783-8.894-.982-.336.075-.668-.135-.744-.47-.077-.336.135-.668.47-.743 3.856-.88 7.15-.506 9.822 1.13.294.178.385.56.203.858zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.076-1.183-.412.125-.845-.107-.97-.52-.125-.413.107-.847.52-.97 3.666-1.11 8.24-.57 11.34 1.34.368.226.488.708.26 1.073zm.106-2.833C14.385 8.81 8.566 8.62 5.176 9.648a1.008 1.008 0 0 1-1.224-.714c-.156-.514.137-1.06.65-1.217 3.882-1.18 10.312-.96 14.373 1.452.46.273.612.87.34 1.33-.273.46-.87.61-1.33.34z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pedestal Dock Player */}
                <div style={{
                  backgroundColor: 'rgba(13, 15, 21, 0.85)',
                  border: selectedTrack.preview_url ? '1px solid rgba(229, 193, 88, 0.25)' : '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  transition: 'border-color 0.3s ease',
                  boxSizing: 'border-box',
                }} className="player-dock">
                  
                  {/* Row 1: Controls (if preview is available) or status banner */}
                  {selectedTrack.preview_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', width: '100%' }}>
                      <button
                        onClick={togglePlay}
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          border: 'none',
                          background: isPlaying ? 'var(--fc-lime)' : 'rgba(255, 255, 255, 0.08)',
                          color: isPlaying ? '#12141c' : 'var(--fc-lime)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: isPlaying ? '0 0 12px var(--fc-lime-glow)' : 'none',
                        }}
                        aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                      >
                        {isPlaying ? (
                          <svg width="14" height="16" viewBox="0 0 12 14" fill="currentColor"><rect x="0" y="0" width="4" height="14" rx="1" /><rect x="8" y="0" width="4" height="14" rx="1" /></svg>
                        ) : (
                          <svg width="14" height="16" viewBox="0 0 12 14" fill="currentColor" style={{ marginLeft: '3px' }}><polygon points="0,0 12,7 0,14" /></svg>
                        )}
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-end',
                          marginBottom: '4px',
                          gap: '0.5rem',
                          width: '100%'
                        }}>
                          <span style={{
                            fontSize: '0.92rem',
                            fontWeight: '850',
                            color: '#fff',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1
                          }}>
                            {selectedTrack.title}
                          </span>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '45%'
                          }}>
                            {selectedTrack.artist}
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.88rem',
                          fontWeight: '700',
                          color: 'var(--text-secondary)'
                        }}>
                          <span>{formatTime(currentTime)}</span>
                          <div 
                            onClick={handleSeek}
                            style={{
                              flex: 1,
                              height: '8px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            <div style={{
                              width: `${(currentTime / (duration || 1)) * 100}%`,
                              height: '100%',
                              background: 'var(--fc-lime)',
                              borderRadius: '4px',
                              transition: 'width 0.1s linear'
                            }} />
                          </div>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {isPlaying && (
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '22px', width: '24px', flexShrink: 0 }}>
                          {[1,2,3,4,5].map(i => (
                            <div key={i} style={{ width: '3px', background: 'var(--fc-lime)', borderRadius: '2px', animation: `eqBar${i} ${0.35 + i * 0.08}s ease-in-out infinite alternate`, height: '100%' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      fontWeight: '700',
                      padding: '0.20rem 0'
                    }}>
                      ⚠️ Spotify Preview Unavailable for this Song
                    </div>
                  )}

                  {/* Horizontal Divider */}
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', width: '100%' }}></div>

                  {/* Row 2: Metadata & Spotify link */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    width: '100%'
                  }}>
                    {selectedTrack.preview_url ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        <div
                          onClick={() => setVolume(volume > 0 ? 0 : 1)}
                          style={{ display: 'flex', cursor: 'pointer', flexShrink: 0 }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px', color: volume > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {volume === 0 ? (
                              <path d="M3 9v6h4l5 5V4L7 9H3zm13 3.5l2.5-2.5 1.5 1.5-2.5 2.5 2.5 2.5-1.5 1.5-2.5-2.5-2.5 2.5-1.5-1.5 2.5-2.5-2.5-2.5 1.5-1.5 2.5 2.5z"/>
                            ) : (
                              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            )}
                          </svg>
                        </div>
                        <div
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = (e.clientX - rect.left) / rect.width;
                            const newVol = Math.max(0, Math.min(1, x));
                            setVolume(newVol);
                          }}
                          style={{
                            flex: 1,
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            maxWidth: '120px'
                          }}
                        >
                          <div style={{
                            width: `${volume * 100}%`,
                            height: '100%',
                            background: 'var(--fc-lime)',
                            borderRadius: '3px',
                            transition: 'width 0.05s linear'
                          }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: '800',
                          color: '#fff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {selectedTrack.title}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '1px'
                        }}>
                          {selectedTrack.artist}
                        </div>
                      </div>
                    )}

                    <a
                      href={`https://open.spotify.com/track/${selectedTrack.track_id || selectedTrack.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#1DB954',
                        textDecoration: 'none',
                        background: 'rgba(29, 185, 84, 0.08)',
                        border: '1px solid rgba(29, 185, 84, 0.25)',
                        padding: '0.38rem 0.7rem',
                        borderRadius: '6px',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                      className="spotify-full-link"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '13px', height: '13px' }}>
                        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.377-1.454-5.37-1.783-8.894-.982-.336.075-.668-.135-.744-.47-.077-.336.135-.668.47-.743 3.856-.88 7.15-.506 9.822 1.13.294.178.385.56.203.858zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.076-1.183-.412.125-.845-.107-.97-.52-.125-.413.107-.847.52-.97 3.666-1.11 8.24-.57 11.34 1.34.368.226.488.708.26 1.073zm.106-2.833C14.385 8.81 8.566 8.62 5.176 9.648a1.008 1.008 0 0 1-1.224-.714c-.156-.514.137-1.06.65-1.217 3.882-1.18 10.312-.96 14.373 1.452.46.273.612.87.34 1.33-.273.46-.87.61-1.33.34z"/>
                      </svg>
                      Full Song
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State: Prompt user or show instructions */
              <div className="glass-card" style={{
                textAlign: 'center',
                padding: '2.5rem 2rem',
                color: 'var(--text-secondary)',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.75rem',
                margin: 0,
                boxSizing: 'border-box'
              }}>
                <div style={{
                  fontSize: '2.8rem',
                  opacity: 0.85
                }}>
                  🎮
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                  Scout A Track
                </h3>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)', maxWidth: '600px', margin: 0 }}>
                  Paste a Spotify link or search for a song to run a vibe check. Our pipeline uses a 
                  <strong> One-Class SVM</strong> trained on 1,400+ FUT tracks to predict if it belongs on the soundtrack.
                </p>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  width: '100%',
                  maxWidth: '550px',
                  marginTop: '0.75rem',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  paddingTop: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                      Try one of these FUT Golden standards:
                    </span>
                    <button 
                      onClick={fetchPresets}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--fc-lime)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      🔄 Shuffle
                    </button>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem'
                  }}>
                    {presets.map(ex => (
                      <button
                        key={ex.id}
                        onClick={() => handleSearch(ex.id, false)}
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          padding: '0.5rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.8rem',
                          transition: 'all 0.2s ease'
                        }}
                        className="ex-btn"
                      >
                        <div style={{ fontWeight: '700', color: '#fff' }}>{ex.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ex.artist} ({ex.desc})</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Right Sidebar — Daily Scouter */}
        <div className={`app-col-leaderboard ${activeTab === 'leaderboard' ? 'active-tab' : ''}`} style={{
          height: '100%',
          minHeight: 0
        }}>
          <ScouterPlaylist onSelectTrack={(val) => handleSearch(val, false)} />
        </div>
      </div>

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${activeTab === 'scout' ? 'active' : ''}`}
          onClick={() => setActiveTab('scout')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Scout</span>
        </button>
        
        <button 
          className={`bottom-nav-item ${activeTab === 'showcase' ? 'active' : ''}`}
          onClick={() => setActiveTab('showcase')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>Showcase</span>
        </button>
        
        <button 
          className={`bottom-nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
          <span>Leaderboard</span>
        </button>
      </nav>

      <style>{`
        .ex-btn:hover {
          background: rgba(203, 249, 0, 0.08) !important;
          border-color: var(--fc-lime) !important;
        }
      `}</style>

    </div>
  );
}
