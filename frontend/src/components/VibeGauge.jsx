import React, { useEffect, useState } from 'react';

export default function VibeGauge({ score }) {
  const [offset, setOffset] = useState(0);
  const size = 230;
  const strokeWidth = 14;
  const radius = (size - strokeWidth - 18) / 2; // leaves space for HUD ring
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    // Animate the progress ring on mount / score change
    const progressOffset = circumference - (score / 100) * circumference;
    const timer = setTimeout(() => {
      setOffset(progressOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  // Determine tier properties
  let gradId = 'elite-grad';
  let strokeColor = 'var(--fc-lime)';
  let glowColor = 'var(--fc-lime-glow)';
  let vibeLabel = 'FIFA ELITE';
  let desc = 'Matches the high-intensity FUT vibe perfectly!';

  if (score < 50.0) {
    gradId = 'offbeat-grad';
    strokeColor = 'var(--text-muted)';
    glowColor = 'rgba(113, 128, 150, 0.15)';
    vibeLabel = 'OFF BEAT';
    desc = 'Too slow, acoustic, or missing the energetic FIFA tempo.';
  } else if (score < 75.0) {
    gradId = 'rotation-grad';
    strokeColor = 'var(--fc-blue)';
    glowColor = 'var(--fc-cyan-glow)';
    vibeLabel = 'SQUAD ROTATION';
    desc = 'Good energy, but sits closer to the boundary of the vibe.';
  } else if (score < 90.0) {
    gradId = 'starting-grad';
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
      padding: '1rem',
      textAlign: 'center',
      position: 'relative'
    }}>
      <div style={{ 
        position: 'relative', 
        width: size, 
        height: size, 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Futuristic HUD Rotation Glow Elements */}
        <div className="hud-outer-ring" style={{
          position: 'absolute',
          width: `${size - 4}px`,
          height: `${size - 4}px`,
          border: '1.5px dashed rgba(255, 255, 255, 0.08)',
          borderRadius: '50%',
          animation: 'spinHUD 25s linear infinite',
          pointerEvents: 'none'
        }}></div>

        <div className="hud-inner-bracket-left" style={{
          position: 'absolute',
          left: '25px',
          width: '6px',
          height: '40px',
          borderLeft: `2.5px solid ${strokeColor}`,
          borderTop: `2.5px solid ${strokeColor}`,
          borderBottom: `2.5px solid ${strokeColor}`,
          opacity: 0.8,
          pointerEvents: 'none'
        }}></div>

        <div className="hud-inner-bracket-right" style={{
          position: 'absolute',
          right: '25px',
          width: '6px',
          height: '40px',
          borderRight: `2.5px solid ${strokeColor}`,
          borderTop: `2.5px solid ${strokeColor}`,
          borderBottom: `2.5px solid ${strokeColor}`,
          opacity: 0.8,
          pointerEvents: 'none'
        }}></div>

        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', zIndex: 1 }}>
          <defs>
            <filter id="hud-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Gradient Definitions based on Tier */}
            <linearGradient id="elite-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#cbf900" />
              <stop offset="100%" stopColor="#00e5ff" />
            </linearGradient>

            <linearGradient id="starting-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8a2be2" />
              <stop offset="100%" stopColor="#ff007f" />
            </linearGradient>

            <linearGradient id="rotation-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00e5ff" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>

            <linearGradient id="offbeat-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#718096" />
              <stop offset="100%" stopColor="#2d3748" />
            </linearGradient>
          </defs>

          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.03)"
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            filter="url(#hud-glow)"
            style={{
              transition: 'stroke-dashoffset 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
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
          justifyContent: 'center',
          zIndex: 2
        }}>
          <span style={{
            fontSize: '4.2rem',
            fontWeight: '900',
            fontFamily: "'Barlow Condensed', sans-serif",
            lineHeight: 0.95,
            color: strokeColor,
            textShadow: `0 0 15px ${glowColor}`,
            letterSpacing: '-0.5px'
          }}>
            {score.toFixed(1)}%
          </span>
          <span style={{
            fontSize: '0.85rem',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: 'var(--text-secondary)',
            marginTop: '3px'
          }}>
            VIBE MATCH
          </span>
        </div>
      </div>

      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '0.9rem 1.4rem',
        borderRadius: '12px',
        maxWidth: '320px',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.05)',
        backdropFilter: 'blur(10px)'
      }}>
        <h4 style={{
          color: strokeColor,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: '900',
          textTransform: 'uppercase',
          fontSize: '1.25rem',
          letterSpacing: '1px',
          marginBottom: '3px',
          textShadow: `0 0 8px ${glowColor}`
        }}>
          {vibeLabel}
        </h4>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.88rem',
          lineHeight: '1.4'
        }}>
          {desc}
        </p>
      </div>

      <style>{`
        @keyframes spinHUD {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
