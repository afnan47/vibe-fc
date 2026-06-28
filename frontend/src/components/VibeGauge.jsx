import React, { useEffect, useState } from 'react';

export default function VibeGauge({ score }) {
  const [offset, setOffset] = useState(0);
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    // Animate the progress ring on mount / score change
    const progressOffset = circumference - (score / 100) * circumference;
    const timer = setTimeout(() => {
      setOffset(progressOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  // Determine colors based on score
  let strokeColor = 'var(--fc-lime)';
  let glowColor = 'var(--fc-lime-glow)';
  let vibeLabel = 'FIFA ELITE';
  let desc = 'Matches the high-intensity FUT vibe perfectly!';

  if (score < 50.0) {
    strokeColor = 'var(--text-muted)';
    glowColor = 'rgba(100, 116, 139, 0.1)';
    vibeLabel = 'OFF BEAT';
    desc = 'Too slow, acoustic, or missing the energetic FIFA tempo.';
  } else if (score < 75.0) {
    strokeColor = 'var(--fc-blue)';
    glowColor = 'rgba(0, 229, 255, 0.2)';
    vibeLabel = 'SQUAD ROTATION';
    desc = 'Good energy, but sits closer to the boundary of the vibe.';
  } else if (score < 90.0) {
    strokeColor = 'var(--fc-purple)';
    glowColor = 'var(--fc-purple-glow)';
    vibeLabel = 'STARTING XI';
    desc = 'Strong contender. Sits firmly in the FIFA soundtrack range.';
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      textAlign: 'center'
    }}>
      <div style={{ position: 'relative', width: size, height: size, marginBottom: '1.5rem' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 8px ${strokeColor})`
            }}
          />
        </svg>
        
        {/* Score text centered */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{
            fontSize: '3rem',
            fontWeight: '800',
            lineHeight: 1,
            color: strokeColor,
            textShadow: `0 0 10px ${glowColor}`
          }}>
            {score.toFixed(1)}%
          </span>
          <span style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: 'var(--text-secondary)',
            marginTop: '4px'
          }}>
            Vibe Match
          </span>
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        padding: '0.75rem 1.25rem',
        borderRadius: '12px',
        maxWidth: '260px'
      }}>
        <h4 style={{
          color: strokeColor,
          fontWeight: '800',
          textTransform: 'uppercase',
          fontSize: '0.9rem',
          letterSpacing: '1px',
          marginBottom: '4px'
        }}>
          {vibeLabel}
        </h4>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.75rem',
          lineHeight: '1.4'
        }}>
          {desc}
        </p>
      </div>
    </div>
  );
}
