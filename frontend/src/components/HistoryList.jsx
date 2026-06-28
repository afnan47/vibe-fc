import React from 'react';

export default function HistoryList({ history, onSelectTrack, layout = 'horizontal' }) {
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

  const isVertical = layout === 'vertical';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isVertical ? 'column' : 'row',
      gap: isVertical ? '0.55rem' : '0.85rem',
      overflowX: isVertical ? 'hidden' : 'auto',
      overflowY: isVertical ? 'auto' : 'hidden',
      paddingBottom: isVertical ? '0' : '4px',
      width: '100%',
      height: isVertical ? '100%' : 'auto',
    }}>
      {history.map((track, idx) => (
        <div
          key={`${track.id || track.track_id || idx}-${idx}`}
          onClick={() => onSelectTrack(track.track_id || track.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: isVertical ? '0.6rem 0.8rem' : '0.75rem 1rem',
            background: 'rgba(255, 255, 255, 0.015)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '10px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            flexShrink: 0,
            width: isVertical ? '100%' : '250px',
            boxSizing: 'border-box',
          }}
          className={`history-item ${isVertical ? 'vertical' : 'horizontal'}`}
        >
          {/* Cover Art Thumbnail */}
          <div style={{
            width: isVertical ? '38px' : '42px',
            height: isVertical ? '38px' : '42px',
            borderRadius: '6px',
            marginRight: '0.85rem',
            background: 'rgba(255, 255, 255, 0.05)',
            backgroundImage: track.cover_art_url ? `url(${track.cover_art_url})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            flexShrink: 0
          }}>
            {!track.cover_art_url && '🎵'}
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
            <h4 style={{
              fontSize: '0.9rem',
              fontWeight: '800',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0
            }}>
              {track.title || 'Unknown Song'}
            </h4>
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px',
              marginBottom: 0
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
              fontSize: '0.85rem',
              fontWeight: '900',
              padding: '0.2rem 0.5rem',
              borderRadius: '5px',
              minWidth: '45px',
              textAlign: 'center'
            }}>
              {parseFloat(track.vibe_score).toFixed(0)}%
            </span>
          </div>
        </div>
      ))}
      <style>{`
        .history-item:hover {
          background: rgba(255, 255, 255, 0.04) !important;
          border-color: var(--fc-lime) !important;
        }
        .history-item.horizontal:hover {
          transform: translateY(-2px);
        }
        .history-item.vertical:hover {
          transform: translateX(3px);
        }
      `}</style>
    </div>
  );
}
