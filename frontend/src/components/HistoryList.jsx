import React from 'react';

export default function HistoryList({ history, onSelectTrack }) {
  if (!history || history.length === 0) {
    return (
      <div style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
      }}>
        No songs checked yet. Try searching a song above!
      </div>
    );
  }

  // Get badge color based on score
  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--fc-lime)';
    if (score >= 75) return 'var(--fc-purple)';
    if (score >= 50) return 'var(--fc-blue)';
    return 'var(--text-muted)';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: '0.75rem',
      overflowX: 'auto',
      overflowY: 'hidden',
      paddingBottom: '4px',
      width: '100%',
    }}>
      {history.map((track, idx) => (
        <div
          key={`${track.id || track.track_id || idx}-${idx}`}
          onClick={() => onSelectTrack(track.track_id || track.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.65rem 0.9rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
            width: '240px',
          }}
          className="history-item"
        >
          {/* Cover Art Thumbnail */}
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            marginRight: '0.75rem',
            background: 'rgba(255, 255, 255, 0.05)',
            backgroundImage: track.cover_art_url ? `url(${track.cover_art_url})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            flexShrink: 0
          }}>
            {!track.cover_art_url && '🎵'}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
            <h4 style={{
              fontSize: '0.85rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {track.title || 'Unknown Song'}
            </h4>
            <p style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '2px'
            }}>
              {track.artist || 'Unknown Artist'}
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }}>
            {/* Score Badge */}
            <span style={{
              background: 'rgba(0,0,0,0.2)',
              border: `1.5px solid ${getScoreColor(track.vibe_score)}`,
              color: getScoreColor(track.vibe_score),
              fontSize: '0.8rem',
              fontWeight: '800',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              minWidth: '50px',
              textAlign: 'center'
            }}>
              {parseFloat(track.vibe_score).toFixed(0)}%
            </span>
          </div>
        </div>
      ))}
      <style>{`
        .history-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
