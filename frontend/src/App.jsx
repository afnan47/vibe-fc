import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import VibeGauge from './components/VibeGauge';
import FeatureChart from './components/FeatureChart';
import HistoryList from './components/HistoryList';

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
  const [error, setError] = useState(null);

  // Audio Playback State
  const [audio, setAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);



  const [trackInput, setTrackInput] = useState('');
  const [presets, setPresets] = useState([]);

  // Fetch playlist averages, history, and random presets on mount
  useEffect(() => {
    fetchStats();
    fetchHistory();
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
    }
    if (selectedTrack?.preview_url) {
      const newAudio = new Audio(selectedTrack.preview_url);
      newAudio.onended = () => setIsPlaying(false);
      setAudio(newAudio);
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
      audio.play();
      setIsPlaying(true);
    }
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

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const handleSearch = async (inputString) => {
    setIsLoading(true);
    setError(null);
    setTrackInput(inputString); // populate the search input box
    try {
      const res = await fetch(`${API_BASE}/api/vibe?track_input=${encodeURIComponent(inputString)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to analyze track.");
      }
      const data = await res.json();
      setSelectedTrack(data);
      
      // Haptic feedback trigger (vibrate 100ms, pause 50ms, vibrate 100ms)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      
      fetchHistory(); // Refresh history list
    } catch (err) {
      setError(err.message);
      setSelectedTrack(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine FUT Card quality (Gold, Silver, Bronze) based on vibe score
  const getCardClass = (score) => {
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
      <header style={{
        textAlign: 'center',
        marginBottom: '2.5rem',
        marginTop: '1rem'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(203, 249, 0, 0.05)',
          border: '1.5px solid var(--fc-lime)',
          padding: '0.4rem 1rem',
          borderRadius: '20px',
          color: 'var(--fc-lime)',
          fontSize: '0.8rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginBottom: '1rem'
        }}>
          ⚽ Vibe Scout Pipeline
        </div>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: '800',
          lineHeight: '1.1',
          letterSpacing: '-1px',
          background: 'linear-gradient(to right, #ffffff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          FUT VIBE <span style={{ color: 'var(--fc-lime)' }}>FC</span>
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          maxWidth: '550px',
          margin: '0 auto'
        }}>
          Evaluate if a song belongs on the official FIFA / EA FC soundtrack using our custom 
          <strong> One-Class Support Vector Machine (OC-SVM)</strong> trained on 1,400+ historical FUT tracks.
        </p>
      </header>

      {/* Main Search Panel */}
      <section style={{ marginBottom: '3rem' }}>
        <SearchBar onSearch={handleSearch} isLoading={isLoading} value={trackInput} onChange={setTrackInput} />
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            maxWidth: '700px',
            margin: '1rem auto 0',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            ⚠️ {error}
          </div>
        )}
      </section>

      {/* Results / Dashboard Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: (isLoading || selectedTrack) ? '1.2fr 2fr' : '1fr',
        gap: '2.5rem',
        alignItems: 'start'
      }}>
        {isLoading ? (
          <>
            {/* Left Column: Pulse Skeleton Card */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem'
            }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: 'var(--fc-lime)',
                textShadow: '0 0 10px var(--fc-lime-glow)'
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
                      {[0,1,2,3,4,5].map(i => (
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

            {/* Right Column: Pulse Skeleton Dashboard */}
            <div className="glass-card" style={{
              minHeight: '430px',
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '2.5rem'
            }}>
              <div className="skeleton-circle" style={{ width: '160px', height: '160px' }}></div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="skeleton-text" style={{ width: '90%' }}></div>
                <div className="skeleton-text" style={{ width: '75%' }}></div>
                <div className="skeleton-text" style={{ width: '85%' }}></div>
              </div>
            </div>
          </>
        ) : selectedTrack ? (
          <>
            {/* Left Column: FUT Player-Style Song Card */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem'
            }}>
              <h2 style={{
                fontSize: '1rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: 'var(--text-secondary)'
              }}>
                Scout Report Card
              </h2>
              
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
                          <span className="stat-label">DNC</span>
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
                          <span className="stat-label">ACO</span>
                          <span className="stat-val">{Math.round(selectedTrack.acousticness)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">LOU</span>
                          <span className="stat-val">{Math.round(selectedTrack.loudness)}</span>
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
            </div>

            {/* Right Column: Dashboard Panel */}
            <div className="glass-card" style={{
              minHeight: '430px',
              padding: '2.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem'
            }}>
              {/* Standard Dashboard details (Radar + Gauge) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.1fr',
                gap: '2rem',
                alignItems: 'center',
                width: '100%'
              }}>
                <VibeGauge score={selectedTrack.vibe_score} />
                
                {datasetStats && (
                  <FeatureChart 
                    trackFeatures={selectedTrack} 
                    averageFeatures={datasetStats.averages} 
                  />
                )}
              </div>

              {/* Song Preview Control — only shown when Spotify preview exists */}
              {selectedTrack?.preview_url && (
                <div className="preview-control-row">
                  <div className="preview-track-info">
                    <div className="preview-track-title">{selectedTrack.title}</div>
                    <div className="preview-track-artist">{selectedTrack.artist}</div>
                  </div>
                  <button
                    className={`preview-play-btn ${isPlaying ? 'is-playing' : ''}`}
                    onClick={togglePlay}
                    aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                  >
                    {isPlaying ? (
                      /* Pause icon */
                      <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                        <rect x="0" y="0" width="4.5" height="16" rx="1.5"/>
                        <rect x="9.5" y="0" width="4.5" height="16" rx="1.5"/>
                      </svg>
                    ) : (
                      /* Play icon */
                      <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                        <polygon points="0,0 14,8 0,16"/>
                      </svg>
                    )}
                  </button>
                  {isPlaying && (
                    <div className="preview-wave">
                      <span/><span/><span/><span/><span/>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State: Prompt user or show instructions */
          <div className="glass-card" style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            color: 'var(--text-secondary)',
            maxWidth: '750px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              fontSize: '3rem',
              opacity: 0.85
            }}>
              🎮
            </div>
            <h3 style={{ fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Scout A Track
            </h3>
            <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              Paste a Spotify link to run a mock scout check. The pipeline will fetch the track's audio features from the Supabase cache, local FUT database, or ReccoBeats API, and pass it through the calibrated One-Class SVM model.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              width: '100%',
              maxWidth: '450px',
              marginTop: '1rem',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              paddingTop: '1.5rem'
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
                    onClick={() => handleSearch(ex.id)}
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

      {/* Bottom Row: History Panel */}
      <section className="glass-card" style={{
        marginTop: '2.5rem',
        maxWidth: '850px',
        marginRight: 'auto',
        marginLeft: 'auto'
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⏱️</span> Recent Scouts
        </h3>
        <HistoryList history={history} onSelectTrack={handleSearch} />
      </section>

      <style>{`
        .ex-btn:hover {
          background: rgba(203, 249, 0, 0.08) !important;
          border-color: var(--fc-lime) !important;
        }
      `}</style>
    </div>
  );
}
