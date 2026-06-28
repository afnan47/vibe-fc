import React from 'react';

// Selected features in clockwise order:
// 1. Danceability
// 2. Energy
// 3. Valence
// 4. BPM (Tempo)
// 5. Loudness (Db)
// 6. Acousticness
const FEATURE_KEYS = ['danceability', 'energy', 'valence', 'tempo', 'loudness', 'acousticness'];
const FEATURE_LABELS = ['Dance', 'Energy', 'Valence', 'Tempo (BPM)', 'Loudness', 'Acoustic'];

export default function FeatureChart({ trackFeatures, averageFeatures }) {
  // Center and radius of the radar chart
  const cx = 150;
  const cy = 130;
  const maxRadius = 90;
  
  // Normalization helper: Maps each feature to a 0-100 scale for plotting
  const normalize = (key, val) => {
    if (val === undefined || val === null) return 0;
    switch(key) {
      case 'danceability':
      case 'energy':
      case 'valence':
      case 'acousticness':
        // Already 0-100
        return Math.min(Math.max(val, 0), 100);
      case 'tempo':
        // BPM: Map 60bpm -> 0, 180bpm -> 100
        return Math.min(Math.max(((val - 60) / (180 - 60)) * 100, 0), 100);
      case 'loudness':
        // dB: Map -20dB -> 0, -2dB -> 100
        return Math.min(Math.max(((val - (-20)) / (-2 - (-20))) * 100, 0), 100);
      default:
        return val;
    }
  };

  // Get point coordinates for an index and a normalized value (0-100)
  const getCoordinates = (index, value) => {
    const angle = (index * 2 * Math.PI) / 6 - Math.PI / 2; // Subtract pi/2 to start pointing up
    const r = (value / 100) * maxRadius;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y };
  };

  // Draw concentric polygon grid lines (e.g. at 20%, 40%, 60%, 80%, 100%)
  const gridLevels = [20, 40, 60, 80, 100];
  const gridPolygons = gridLevels.map(level => {
    return FEATURE_KEYS.map((_, idx) => {
      const { x, y } = getCoordinates(idx, level);
      return `${x},${y}`;
    }).join(' ');
  });

  // Calculate points for the track features
  const trackPoints = FEATURE_KEYS.map((key, idx) => {
    const normVal = normalize(key, trackFeatures[key]);
    const { x, y } = getCoordinates(idx, normVal);
    return `${x},${y}`;
  }).join(' ');

  // Calculate points for the average FIFA features
  const avgPoints = FEATURE_KEYS.map((key, idx) => {
    const normVal = normalize(key, averageFeatures[key]);
    const { x, y } = getCoordinates(idx, normVal);
    return `${x},${y}`;
  }).join(' ');

  // Helper to draw text labels around the outer edge (100% + padding)
  const labelPositions = FEATURE_KEYS.map((_, idx) => {
    const angle = (idx * 2 * Math.PI) / 6 - Math.PI / 2;
    const r = maxRadius + 18;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    
    // Adjust alignment based on angle
    let textAnchor = 'middle';
    if (Math.cos(angle) > 0.1) textAnchor = 'start';
    if (Math.cos(angle) < -0.1) textAnchor = 'end';
    
    return { x, y, textAnchor };
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      padding: '0.5rem'
    }}>
      <h3 style={{
        fontSize: '1rem',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: 'var(--text-primary)',
        marginBottom: '1rem'
      }}>
        Vibe Attribute Breakdown
      </h3>

      <div style={{ position: 'relative', width: '300px', height: '260px' }}>
        <svg width="300" height="260">
          {/* Radial Grid lines */}
          {FEATURE_KEYS.map((_, idx) => {
            const outerPoint = getCoordinates(idx, 100);
            return (
              <line
                key={`axis-${idx}`}
                x1={cx}
                y1={cy}
                x2={outerPoint.x}
                y2={outerPoint.y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth="1"
              />
            );
          })}

          {/* Concentric grid rings */}
          {gridPolygons.map((points, idx) => (
            <polygon
              key={`grid-${idx}`}
              points={points}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
            />
          ))}

          {/* Average FIFA Playlist Polygon (Background reference) */}
          <polygon
            points={avgPoints}
            fill="rgba(138, 43, 226, 0.15)"
            stroke="var(--fc-purple)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />

          {/* Selected Track Polygon (Foreground highlight) */}
          <polygon
            points={trackPoints}
            fill="rgba(203, 249, 0, 0.25)"
            stroke="var(--fc-lime)"
            strokeWidth="2.5"
            style={{ filter: 'drop-shadow(0 0 4px rgba(203, 249, 0, 0.3))' }}
          />

          {/* Dots on Track corners for extra polish */}
          {FEATURE_KEYS.map((key, idx) => {
            const normVal = normalize(key, trackFeatures[key]);
            const { x, y } = getCoordinates(idx, normVal);
            return (
              <circle
                key={`dot-${idx}`}
                cx={x}
                cy={y}
                r="4"
                fill="var(--fc-lime)"
                stroke="#12141c"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Labels */}
          {FEATURE_LABELS.map((label, idx) => {
            const pos = labelPositions[idx];
            return (
              <text
                key={`label-${idx}`}
                x={pos.x}
                y={pos.y + 4} // small vertical offset alignment
                fill="var(--text-secondary)"
                fontSize="10"
                fontWeight="700"
                textAnchor={pos.textAnchor}
                style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '1.5rem',
        marginTop: '0.5rem',
        fontSize: '0.75rem',
        fontWeight: '600'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            background: 'rgba(203, 249, 0, 0.25)',
            border: '2.5px solid var(--fc-lime)',
            borderRadius: '2px'
          }}></span>
          <span style={{ color: 'var(--text-primary)' }}>This Song</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            background: 'rgba(138, 43, 226, 0.15)',
            border: '1.5px dashed var(--fc-purple)',
            borderRadius: '2px'
          }}></span>
          <span style={{ color: 'var(--text-secondary)' }}>FIFA Vibe Avg</span>
        </div>
      </div>
    </div>
  );
}
