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
      flexDirection: 'column',
      gap: '0.5rem',
      maxHeight: '350px',
      overflowY: 'auto',
      paddingRight: '4px'
    }}>
      {history.map((track, idx) => (
        <div
          key={track.track_id || idx}
          onClick={() => onSelectTrack(track.track_id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          className="history-item"
        >
          <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
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
              fontSize: '0.7rem',
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
            gap: '0.75rem'
          }}>
            {/* Score Badge */}
            <span style={{
              background: 'rgba(0,0,0,0.2)',
              border: `1.5px solid ${getScoreColor(track.vibe_score)}`,
              color: getScoreColor(track.vibe_score),
              fontSize: '0.8rem',
              fontWeight: '800',
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              minWidth: '55px',
              textAlign: 'center'
            }}>
              {parseFloat(track.vibe_score).toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
      <style>{`
        .history-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          transform: translateX(4px);
        }
      `}</style>
    </div>
  );
}
