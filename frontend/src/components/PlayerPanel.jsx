import React, { memo } from 'react';
import { useAudioPlayer } from '../lib/useAudioPlayer';

const PlayerPanel = memo(function PlayerPanel({ selectedTrack }) {
  const { isPlaying, currentTime, duration, volume, togglePlay, seek, setVolume, formatTime } = useAudioPlayer();

  if (!selectedTrack) return null;

  return (
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
      {selectedTrack.preview_url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', width: '100%' }}>
          <button
            onClick={togglePlay}
            style={{
              width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
              border: 'none',
              background: isPlaying ? 'var(--fc-lime)' : 'rgba(255, 255, 255, 0.08)',
              color: isPlaying ? '#12141c' : 'var(--fc-lime)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px', gap: '0.5rem', width: '100%' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: '850', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {selectedTrack.title}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' }}>
                {selectedTrack.artist}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
              <span>{formatTime(currentTime)}</span>
              <div onClick={seek} style={{ flex: 1, height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: `${(currentTime / (duration || 1)) * 100}%`, height: '100%', background: 'var(--fc-lime)', borderRadius: '4px', transition: 'width 0.1s linear' }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700', padding: '0.20rem 0' }}>
          Spotify Preview Unavailable for this Song
        </div>
      )}

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', width: '100%' }}></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
        {selectedTrack.preview_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
            <div onClick={() => setVolume(volume > 0 ? 0 : 1)} style={{ display: 'flex', cursor: 'pointer', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px', color: volume > 0 ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {volume === 0 ? (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13 3.5l2.5-2.5 1.5 1.5-2.5 2.5 2.5 2.5-1.5 1.5-2.5-2.5-2.5 2.5-1.5-1.5 2.5-2.5-2.5-2.5 1.5-1.5 2.5 2.5z"/>
                ) : (
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                )}
              </svg>
            </div>
            <div onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width; setVolume(Math.max(0, Math.min(1, x))); }} style={{ flex: 1, height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', cursor: 'pointer', position: 'relative', overflow: 'hidden', maxWidth: '120px' }}>
              <div style={{ width: `${volume * 100}%`, height: '100%', background: 'var(--fc-lime)', borderRadius: '3px', transition: 'width 0.05s linear' }} />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedTrack.title}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
              {selectedTrack.artist}
            </div>
          </div>
        )}

        <a
          href={`https://open.spotify.com/track/${selectedTrack.track_id || selectedTrack.id}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1DB954', textDecoration: 'none', background: 'rgba(29, 185, 84, 0.08)', border: '1px solid rgba(29, 185, 84, 0.25)', padding: '0.38rem 0.7rem', borderRadius: '6px', transition: 'all 0.2s ease', flexShrink: 0 }}
          className="spotify-full-link"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '13px', height: '13px' }}>
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.563.387-.857.207-2.377-1.454-5.37-1.783-8.894-.982-.336.075-.668-.135-.744-.47-.077-.336.135-.668.47-.743 3.856-.88 7.15-.506 9.822 1.13.294.178.385.56.203.858zm1.224-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.076-1.183-.412.125-.845-.107-.97-.52-.125-.413.107-.847.52-.97 3.666-1.11 8.24-.57 11.34 1.34.368.226.488.708.26 1.073zm.106-2.833C14.385 8.81 8.566 8.62 5.176 9.648a1.008 1.008 0 0 1-1.224-.714c-.156-.514.137-1.06.65-1.217 3.882-1.18 10.312-.96 14.373 1.452.46.273.612.87.34 1.33-.273.46-.87.61-1.33.34z"/>
          </svg>
          Full Song
        </a>
      </div>
    </div>
  );
});

export default PlayerPanel;
