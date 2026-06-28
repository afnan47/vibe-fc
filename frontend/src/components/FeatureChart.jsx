import React, { useState } from 'react';

const FEATURE_KEYS = ['danceability', 'energy', 'valence', 'tempo', 'loudness', 'acousticness'];
const FEATURE_LABELS = ['DAN', 'ENG', 'VAL', 'TEM', 'LOU', 'ACO'];

const FEATURE_TOOLTIPS = {
  danceability: {
    label: 'Danceability',
    description: 'How easy it is to move to this track. High = floor-filler banger. Low = headphones-only territory.',
  },
  energy: {
    label: 'Energy',
    description: 'Raw intensity and power. High energy = stadium anthem. Low = calm background vibe.',
  },
  valence: {
    label: 'Valence',
    description: 'Emotional brightness. High = euphoric and menu-ready. Low = dark, melancholic, and intense.',
  },
  tempo: {
    label: 'Tempo',
    description: 'Beats per minute. FIFA sweet spot is ~100–140 BPM — fast enough to feel alive, not chaotic.',
  },
  loudness: {
    label: 'Loudness',
    description: 'Perceived loudness in decibels. Closer to 0 dB = loud and punchy. More negative = quiet and dynamic.',
  },
  acousticness: {
    label: 'Acousticness',
    description: 'How electronic vs. organic the track is. High = unplugged feel. Low = full digital production.',
  },
};

export default function FeatureChart({ trackFeatures, averageFeatures }) {
  const [tooltip, setTooltip] = useState(null);

  const cx = 180;
  const cy = 150;
  const maxRadius = 110;

  const normalize = (key, val) => {
    if (val === undefined || val === null) return 0;
    switch (key) {
      case 'danceability':
      case 'energy':
      case 'valence':
      case 'acousticness':
        return Math.min(Math.max(val, 0), 100);
      case 'tempo':
        return Math.min(Math.max(((val - 60) / (180 - 60)) * 100, 0), 100);
      case 'loudness':
        return Math.min(Math.max(((val - -20) / (-2 - -20)) * 100, 0), 100);
      default:
        return val;
    }
  };

  const getCoordinates = (index, value) => {
    const angle = (index * 2 * Math.PI) / 6 - Math.PI / 2;
    const r = (value / 100) * maxRadius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const gridLevels = [20, 40, 60, 80, 100];
  const gridPolygons = gridLevels.map(level =>
    FEATURE_KEYS.map((_, idx) => {
      const { x, y } = getCoordinates(idx, level);
      return `${x},${y}`;
    }).join(' ')
  );

  const trackPoints = FEATURE_KEYS.map((key, idx) => {
    const { x, y } = getCoordinates(idx, normalize(key, trackFeatures[key]));
    return `${x},${y}`;
  }).join(' ');

  const avgPoints = FEATURE_KEYS.map((key, idx) => {
    const { x, y } = getCoordinates(idx, normalize(key, averageFeatures[key]));
    return `${x},${y}`;
  }).join(' ');

  const labelPositions = FEATURE_KEYS.map((_, idx) => {
    const angle = (idx * 2 * Math.PI) / 6 - Math.PI / 2;
    const r = maxRadius + 18;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    let textAnchor = 'middle';
    if (Math.cos(angle) > 0.1) textAnchor = 'start';
    if (Math.cos(angle) < -0.1) textAnchor = 'end';
    return { x, y, textAnchor };
  });

  const formatRawVal = (key, val) => {
    if (val === undefined || val === null) return 'N/A';
    if (key === 'tempo') return `${Math.round(val)} BPM`;
    if (key === 'loudness') return `${Number(val).toFixed(1)} dB`;
    return `${Math.round(val)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '0.5rem' }}>
      <h3 style={{
        fontSize: '1rem', fontWeight: '800', textTransform: 'uppercase',
        letterSpacing: '1px', color: 'var(--text-primary)', marginBottom: '1rem'
      }}>
        Vibe Attribute Breakdown
      </h3>

      <div style={{ position: 'relative', width: '360px', height: '300px' }}>
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: `${tooltip.svgX}px`,
            top: `${tooltip.svgY}px`,
            transform: 'translate(-50%, -115%)',
            background: 'rgba(18, 20, 28, 0.97)',
            border: '1px solid rgba(203, 249, 0, 0.3)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            zIndex: 100,
            pointerEvents: 'none',
            width: '170px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontWeight: '800', fontSize: '0.72rem', color: 'var(--fc-lime)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>
              {FEATURE_TOOLTIPS[tooltip.key]?.label}: {tooltip.rawVal}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              {FEATURE_TOOLTIPS[tooltip.key]?.description}
            </div>
          </div>
        )}

        <svg width="360" height="300" style={{ overflow: 'visible' }}>
          {FEATURE_KEYS.map((_, idx) => {
            const outerPoint = getCoordinates(idx, 100);
            return <line key={`axis-${idx}`} x1={cx} y1={cy} x2={outerPoint.x} y2={outerPoint.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
          })}
          {gridPolygons.map((points, idx) => (
            <polygon key={`grid-${idx}`} points={points} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          <polygon points={avgPoints} fill="rgba(217, 70, 239, 0.15)" stroke="#D946EF" strokeWidth="2.5" strokeOpacity="0.8" strokeDasharray="3 3" style={{ filter: 'drop-shadow(0 0 3px rgba(217, 70, 239, 0.5))' }} />
          <polygon points={trackPoints} fill="rgba(203,249,0,0.25)" stroke="var(--fc-lime)" strokeWidth="2.5" style={{ filter: 'drop-shadow(0 0 4px rgba(203,249,0,0.3))' }} />
          {FEATURE_KEYS.map((key, idx) => {
            const { x, y } = getCoordinates(idx, normalize(key, trackFeatures[key]));
            return (
              <circle
                key={`dot-${idx}`}
                cx={x} cy={y} r="5"
                fill="var(--fc-lime)" stroke="#12141c" strokeWidth="1.5"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  e.currentTarget.setAttribute('r', '7');
                  setTooltip({ key, svgX: x, svgY: y, rawVal: formatRawVal(key, trackFeatures[key]) });
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.setAttribute('r', '5');
                  setTooltip(null);
                }}
              />
            );
          })}
          {FEATURE_LABELS.map((label, idx) => {
            const pos = labelPositions[idx];
            return (
              <text key={`label-${idx}`} x={pos.x} y={pos.y + 4} fill="var(--text-secondary)" fontSize="11" fontWeight="700" textAnchor={pos.textAnchor} style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: '600' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(203,249,0,0.25)', border: '2.5px solid var(--fc-lime)', borderRadius: '2px' }}></span>
          <span style={{ color: 'var(--text-primary)' }}>This Song</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(217, 70, 239, 0.15)', border: '2px dashed #D946EF', borderRadius: '2px' }}></span>
          <span style={{ color: 'var(--text-secondary)' }}>FIFA Vibe Avg</span>
        </div>
      </div>
    </div>
  );
}
