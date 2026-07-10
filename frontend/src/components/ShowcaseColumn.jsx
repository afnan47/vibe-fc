import React, { memo } from 'react';
import PlayerPanel from './PlayerPanel';
import { useAudioPlayer } from '../lib/useAudioPlayer';

const getCardClass = (score) => {
  if (score >= 85) return 'tots';
  if (score >= 80) return 'gold';
  if (score >= 60) return 'silver';
  return 'bronze';
};

const LoadingSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexShrink: 0 }}>
    <h2 style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--fc-lime)', textShadow: '0 0 10px var(--fc-lime-glow)', margin: '0 0 0.5rem 0' }}>
      Scouting Song Pack...
    </h2>
    <div className="fut-card-wrapper">
      <div className="fut-card-border-glow" style={{ animation: 'borderGlowPulse 1.5s infinite ease-in-out' }}>
        <div className="fut-skeleton">
          <div className="skel-rating-block">
            <div className="skel-chip skel-chip--lg"></div>
            <div className="skel-chip skel-chip--sm"></div>
            <div className="skel-playstyle"></div>
          </div>
          <div className="skel-photo"></div>
          <div className="skel-divider"></div>
          <div className="skel-chip skel-chip--name"></div>
          <div className="skel-chip skel-chip--artist"></div>
          <div className="skel-stats-row">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skel-stat-col">
                <div className="skel-chip skel-chip--stat-label"></div>
                <div className="skel-chip skel-chip--stat-val"></div>
              </div>
            ))}
          </div>
          <div className="skel-badges-row">
            <div className="skel-badge-circle"></div>
            <div className="skel-badge-circle"></div>
            <div className="skel-badge-circle"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const TrackCard = memo(function TrackCard({ track }) {
  const { isPlaying } = useAudioPlayer();

  const roundedScore = Math.round(track.vibe_score);
  const isThreeDigits = roundedScore >= 100;
  
  // Normalize Tempo (BPM) from [65, 185] -> [45, 99]
  const displayTempo = Math.round(45 + Math.max(0, Math.min(1, (track.tempo - 65) / 120)) * 54);
  
  // Normalize Loudness (dB) from [-16, -3] -> [45, 99]
  const displayLoudness = Math.round(45 + Math.max(0, Math.min(1, (track.loudness - (-16)) / 13)) * 54);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', flexShrink: 0 }}>
      <div className="fut-card-wrapper"
        onMouseMove={(e) => {
          const card = e.currentTarget.querySelector('.fut-card-border-glow');
          if (!card) return;
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const midX = rect.width / 2;
          const midY = rect.height / 2;
          card.style.transform = `rotateX(${-((y - midY) / midY) * 15}deg) rotateY(${((x - midX) / midX) * 15}deg) scale(1.03)`;
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
        <div className="vibe-active-glow" key={track.id}>
          <div className="fut-card-border-glow reveal-anim">
            <div className={`fut-card ${getCardClass(track.vibe_score)}`}>
              <div className="badge-rating">
                <span className={`rating-val ${isThreeDigits ? 'three-digits' : ''}`}>{roundedScore}</span>
                <span className="position-val">VIB</span>
              </div>
              <div className={`card-art ${isPlaying ? 'playing' : ''}`}
                style={{ backgroundImage: track?.cover_art_url ? `url(${track.cover_art_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}
              >
                {!track?.cover_art_url && <span>🎵</span>}
              </div>
              <div style={{ width: '80%', height: '1.5px', background: 'rgba(255, 255, 255, 0.18)', margin: '0.25rem 0 0.5rem 0' }}></div>
              <div className="song-name">{track?.title}</div>
              <div className="artist-name">{track?.artist}</div>
              <div className="stats-grid">
                <div className="stat-item"><span className="stat-label">DAN</span><span className="stat-val">{Math.round(track.danceability)}</span></div>
                <div className="stat-item"><span className="stat-label">ENG</span><span className="stat-val">{Math.round(track.energy)}</span></div>
                <div className="stat-item"><span className="stat-label">VAL</span><span className="stat-val">{Math.round(track.valence)}</span></div>
                <div className="stat-item"><span className="stat-label">TEM</span><span className="stat-val">{displayTempo}</span></div>
                <div className="stat-item"><span className="stat-label">LOU</span><span className="stat-val">{displayLoudness}</span></div>
                <div className="stat-item"><span className="stat-label">ACO</span><span className="stat-val">{Math.round(track.acousticness)}</span></div>
              </div>
              <div className="badges-row">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '15px', height: '15px', opacity: 0.75 }}>
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.377-1.454-5.37-1.783-8.894-.982-.336.075-.668-.135-.744-.47-.077-.336.135-.668.47-.743 3.856-.88 7.15-.506 9.822 1.13.294.178.385.56.203.858zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.076-1.183-.412.125-.845-.107-.97-.52-.125-.413.107-.847.52-.97 3.666-1.11 8.24-.57 11.34 1.34.368.226.488.708.26 1.073zm.106-2.833C14.385 8.81 8.566 8.62 5.176 9.648a1.008 1.008 0 0 1-1.224-.714c-.156-.514.137-1.06.65-1.217 3.882-1.18 10.312-.96 14.373 1.452.46.273.612.87.34 1.33-.273.46-.87.61-1.33.34z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PlayerPanel selectedTrack={track} />
    </div>
  );
});

const EmptyState = memo(function EmptyState({ presets, fetchPresets, onSearch }) {
  return (
    <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 2rem', color: 'var(--text-secondary)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem', margin: 0, boxSizing: 'border-box' }}>
      <svg viewBox="0 0 64 64" fill="none" style={{ width: '48px', height: '48px', opacity: 0.5 }}>
        <circle cx="26" cy="26" r="18" stroke="var(--fc-lime)" strokeWidth="3"/>
        <line x1="38" y1="38" x2="54" y2="54" stroke="var(--fc-lime)" strokeWidth="3" strokeLinecap="round"/>
      </svg>
      <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0 }}>
        Scout A Track
      </h3>
      <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 0 0.5rem 0' }}>
        Paste a Spotify link or search for a song to check its FIFA vibe score.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '480px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
            Try a classic
          </span>
          <button onClick={fetchPresets} style={{ background: 'none', border: 'none', color: 'var(--fc-lime)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.7, transition: 'opacity 0.2s ease' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '14px', height: '14px' }}><path d="M14.66 10.5a5 5 0 1 1-4.66-6.5V2a7 7 0 1 0 7 7h-2.34z"/></svg>
            Shuffle
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {presets.map(ex => (
            <button key={ex.id} onClick={() => onSearch(ex.id, false)}
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.6rem 0.65rem', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', transition: 'all 0.2s ease' }}
              className="ex-btn"
            >
              <div style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem' }}>{ex.name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>{ex.artist}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

const ShowcaseColumn = memo(function ShowcaseColumn({ activeTab, selectedTrack, isLoading, error, presets, fetchPresets, onSearch }) {
  return (
    <div className={`app-col-showcase ${activeTab === 'showcase' ? 'active-tab' : ''}`} style={{ minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center', flexShrink: 0, width: '100%', marginBottom: '1rem' }}>
          Warning: {error}
        </div>
      )}
      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'min-content', padding: '1rem 0' }}>
        {isLoading ? (
          <LoadingSkeleton />
        ) : selectedTrack ? (
          <TrackCard track={selectedTrack} />
        ) : (
          <EmptyState presets={presets} fetchPresets={fetchPresets} onSearch={onSearch} />
        )}
      </div>
    </div>
  );
});

export default ShowcaseColumn;
