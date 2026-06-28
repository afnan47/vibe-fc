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
  { id: '7ouMYWpwJ422jRcDASZB7P', name: 'Knights of Cydonia', artist: 'Muse', desc: 'FIFA 07 Epic Rock' },
  { id: '2TpxZ7JUBn3uw46aR7qd6V', name: 'Kids', artist: 'MGMT', desc: 'FIFA 09 Anthem' }
];

export default function App() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [datasetStats, setDatasetStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch playlist averages and history on mount
  useEffect(() => {
    fetchStats();
    fetchHistory();
  }, []);

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
    try {
      const res = await fetch(`${API_BASE}/api/vibe?track_input=${encodeURIComponent(inputString)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to analyze track.");
      }
      const data = await res.json();
      setSelectedTrack(data);
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
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />
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
        gridTemplateColumns: selectedTrack ? '1.2fr 2fr' : '1fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {selectedTrack ? (
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
              
              <div className={`fut-card ${getCardClass(selectedTrack.vibe_score)} vibe-active`}>
                {/* Rating badge */}
                <div className="badge-rating">
                  <span className="rating-val">{Math.round(selectedTrack.vibe_score)}</span>
                  <span className="position-val">VIB</span>
                </div>
                
                {/* Placeholder cover art */}
                <div className="card-art">
                  🎵
                </div>
                
                {/* Title & Artist */}
                <div className="song-name">{selectedTrack.title}</div>
                <div className="artist-name">{selectedTrack.artist}</div>
                
                {/* FUT Hexagon-ish 6 features breakdown */}
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-val">{Math.round(selectedTrack.danceability)}</span>
                    <span className="stat-label">DN</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-val">{Math.round(selectedTrack.energy)}</span>
                    <span className="stat-label">EN</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-val">{Math.round(selectedTrack.valence)}</span>
                    <span className="stat-label">VL</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-val">{Math.round(selectedTrack.tempo)}</span>
                    <span className="stat-label">TM</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-val">{Math.round(selectedTrack.acousticness)}</span>
                    <span className="stat-label">AC</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-val">{Math.round(selectedTrack.loudness)}</span>
                    <span className="stat-label">LD</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Vibe scoring and Radar Chart Comparison */}
            <div className="glass-card" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem',
              alignItems: 'center',
              minHeight: '420px'
            }}>
              <VibeGauge score={selectedTrack.vibe_score} />
              
              {datasetStats && (
                <FeatureChart 
                  trackFeatures={selectedTrack} 
                  averageFeatures={datasetStats.averages} 
                />
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
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                Try one of these FUT Golden standards:
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem'
              }}>
                {GOLDEN_EXAMPLES.map(ex => (
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
