import React, { useEffect, useState, useRef, memo } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const PLATFORM_META = {
  spotify_nmf: { label: 'NMF', color: '#1DB954', icon: 's', title: 'New Music Friday' },
  pitchfork: { label: 'PFK', color: '#ff4500', icon: 'P', title: 'Pitchfork' },
  soundcloud: { label: 'SC', color: '#ff7700', icon: 'S', title: 'SoundCloud' },
  fut_classic: { label: 'FUT', color: '#cbf900', icon: 'F', title: 'FUT Classic' },
};

function ScouterPlaylist({ onSelectTrack }) {
  const [playlist, setPlaylist] = useState([]);
  const [loading, setLoading] = useState(true);

  const pollingRef = useRef(null);

  const fetchPlaylist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/scouter/playlist`);
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data || []);
        if (data && data.length > 0 && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err) {
      console.error("Failed to fetch scouter playlist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylist();
    pollingRef.current = setInterval(() => {
      if (!document.hidden) fetchPlaylist();
    }, 10000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--fc-lime)';
    if (score >= 75) return 'var(--fc-purple)';
    return 'var(--fc-blue)';
  };

  return (
    <div className="scouter-panel glass-card" style={{
      padding: '0.5rem 1.25rem 1.25rem 1.25rem',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.85rem',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <h3 style={{
            fontSize: '2.2rem',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '-0.8px',
            fontStyle: 'italic',
            fontFamily: "'Barlow Condensed', sans-serif",
            lineHeight: '1.0',
            background: 'linear-gradient(135deg, #ffffff 0%, #e5c158 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 12px rgba(229, 193, 88, 0.35))',
            margin: 0,
          }}>
            VIBE <span style={{ color: 'var(--fc-lime)', WebkitTextFillColor: 'var(--fc-lime)' }}>SCOUTER</span>
          </h3>

        </div>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color: 'var(--fc-lime)',
          background: 'rgba(203, 249, 0, 0.08)',
          padding: '0.25rem 0.55rem',
          borderRadius: '4px',
          border: '1px solid rgba(203, 249, 0, 0.2)',
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
          gap: '0.55rem',
          flex: 1,
          minHeight: 0,
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
                  gap: '0.75rem',
                  padding: '0.65rem 0.8rem',
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {/* Rank badge */}
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: item.scout_rank <= 3 ? 'rgba(203, 249, 0, 0.08)' : 'rgba(255,255,255,0.04)',
                  border: item.scout_rank <= 3 ? '1px solid rgba(203, 249, 0, 0.15)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: '900',
                  color: getScoreColor(item.vibe_score),
                  flexShrink: 0,
                }}>
                  {item.scout_rank}
                </div>

                {/* Cover art */}
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  flexShrink: 0,
                  background: cache.cover_art_url ? `url(${cache.cover_art_url}) center/cover` : 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  boxShadow: cache.cover_art_url ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                }}>
                  {!cache.cover_art_url && '🎵'}
                </div>

                {/* Track info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{
                     fontSize: '0.9rem',
                     fontWeight: '800',
                     color: 'var(--text-primary)',
                     whiteSpace: 'nowrap',
                     overflow: 'hidden',
                     textOverflow: 'ellipsis',
                     lineHeight: 1.3,
                   }}>
                    {cache.title || 'Unknown'}
                  </div>
                   <div style={{
                     fontSize: '0.7rem',
                     color: 'var(--text-secondary)',
                     whiteSpace: 'nowrap',
                     overflow: 'hidden',
                     textOverflow: 'ellipsis',
                     lineHeight: 1.3,
                     marginTop: '2px',
                   }}>
                    {cache.artist || 'Unknown'}
                  </div>
                </div>

                {/* Score + Platform */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontSize: '1rem',
                    fontWeight: '900',
                    color: getScoreColor(item.vibe_score),
                    minWidth: '42px',
                    textAlign: 'right',
                    textShadow: '0 0 12px currentColor',
                  }}>
                    {Number(item.vibe_score).toFixed(0)}%
                  </span>
                  <span 
                    title={platform.title || ''}
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: platform.label === 'FUT' ? '#12141c' : '#fff',
                      background: platform.color,
                      padding: '0.2rem 0.45rem',
                      borderRadius: '3.5px',
                      lineHeight: '1.2',
                      opacity: 0.9,
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
          border-color: rgba(229, 193, 88, 0.3) !important;
          transform: translateX(4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }
        .scouter-track-item:active {
          transform: translateX(2px);
        }
      `}      </style>
    </div>
  );
}

export default memo(ScouterPlaylist);
