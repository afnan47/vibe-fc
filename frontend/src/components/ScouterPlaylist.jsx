import React, { useEffect, useState } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const PLATFORM_META = {
  spotify_nmf: { label: 'NMF', color: '#1DB954', icon: 's', title: 'New Music Friday' },
  pitchfork: { label: 'PFK', color: '#ff4500', icon: 'P', title: 'Pitchfork' },
  soundcloud: { label: 'SC', color: '#ff7700', icon: 'S', title: 'SoundCloud' },
  fut_classic: { label: 'FUT', color: '#cbf900', icon: 'F', title: 'FUT Classic' },
};

export default function ScouterPlaylist({ onSelectTrack }) {
  const [playlist, setPlaylist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaylist();
  }, []);

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/scouter/playlist`);
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch scouter playlist:", err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--fc-lime)';
    if (score >= 75) return 'var(--fc-purple)';
    return 'var(--fc-blue)';
  };

  return (
    <div className="scouter-panel glass-card" style={{
      padding: '1.25rem',
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>📡</span>
          <h3 style={{
            fontSize: '0.85rem',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            FIFA Elite Scouter
          </h3>
        </div>
        <span style={{
          fontSize: '0.6rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.03)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          Top 10 Daily
        </span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} className="skeleton-text" style={{ height: '52px', borderRadius: '8px', width: '100%' }}></div>
          ))}
        </div>
      ) : playlist.length === 0 ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem 1rem',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '2rem', opacity: 0.3 }}>🔍</span>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            lineHeight: '1.5',
            maxWidth: '200px',
            margin: 0,
          }}>
            Daily scout in progress. Check back soon for the top 10 elite picks.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          flex: 1,
          overflowY: 'auto',
        }}>
          {playlist.map((item) => {
            const cache = item.track_cache || {};
            const platform = PLATFORM_META[item.source_platform] || { label: 'WEB', color: '#666', icon: 'W' };

            return (
              <div
                key={`${item.track_id}-${item.scout_batch_id}`}
                onClick={() => onSelectTrack(item.track_id)}
                className="scouter-track-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.5rem 0.6rem',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {/* Rank badge */}
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: '900',
                  color: getScoreColor(item.vibe_score),
                  flexShrink: 0,
                }}>
                  {item.scout_rank}
                </div>

                {/* Cover art */}
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  flexShrink: 0,
                  background: cache.cover_art_url ? `url(${cache.cover_art_url}) center/cover` : 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                }}>
                  {!cache.cover_art_url && '🎵'}
                </div>

                {/* Track info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.3,
                  }}>
                    {cache.title || 'Unknown'}
                  </div>
                  <div style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.3,
                  }}>
                    {cache.artist || 'Unknown'}
                  </div>
                </div>

                {/* Score + Platform */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    color: getScoreColor(item.vibe_score),
                    minWidth: '36px',
                    textAlign: 'right',
                  }}>
                    {Number(item.vibe_score).toFixed(0)}%
                  </span>
                  <span 
                    title={platform.title || ''}
                    style={{
                      fontSize: '0.5rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: platform.label === 'FUT' ? '#12141c' : '#fff',
                      background: platform.color,
                      padding: '0.15rem 0.35rem',
                      borderRadius: '3px',
                      lineHeight: '1.2',
                      opacity: 0.85,
                    }}
                  >
                    {platform.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .scouter-track-item:hover {
          background: rgba(255, 255, 255, 0.04) !important;
          border-color: var(--fc-lime) !important;
          transform: translateX(3px);
        }
      `}</style>
    </div>
  );
}
