import React from 'react';

export default function MiniPlayer({ selectedTrack, isPlaying, togglePlay, onNavigateToShowcase }) {
  if (!selectedTrack) return null;

  return (
    <div className="mini-player" onClick={onNavigateToShowcase}>
      <div
        className="mini-player-art"
        style={{
          backgroundImage: selectedTrack?.cover_art_url
            ? `url(${selectedTrack.cover_art_url})`
            : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />

      <div className="mini-player-info">
        <div className="mini-player-title">
          {selectedTrack.title}
        </div>
        <div className="mini-player-artist">
          {selectedTrack.artist}
        </div>
      </div>

      <button
        className="mini-player-play-btn"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 12 14" fill="currentColor">
            <rect x="0" y="0" width="4" height="14" rx="1" />
            <rect x="8" y="0" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 12 14" fill="currentColor" style={{ marginLeft: '2px' }}>
            <polygon points="0,0 12,7 0,14" />
          </svg>
        )}
      </button>
    </div>
  );
}
