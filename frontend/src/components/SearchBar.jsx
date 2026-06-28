import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000';
const SPOTIFY_RE = /(?:open\.spotify\.com\/track\/|spotify:track:)[a-zA-Z0-9]{22}|^[a-zA-Z0-9]{22}$/;

export default function SearchBar({ onSearch, isLoading, value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const isSpotifyInput = (val) => SPOTIFY_RE.test(val.trim());

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2 || isSpotifyInput(q)) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        const uniqueData = [];
        const seen = new Set();
        for (const item of data) {
          if (item?.id && !seen.has(item.id)) {
            seen.add(item.id);
            uniqueData.push(item);
          }
        }
        setSuggestions(uniqueData);
        setShowDrop(uniqueData.length > 0);
        setActiveIdx(-1);
      }
    } catch { /* silent */ }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  const selectSuggestion = (item) => {
    onChange(`${item.name} — ${item.artist}`);
    setSuggestions([]);
    setShowDrop(false);
    setActiveIdx(-1);
    onSearch(item.id);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!value.trim()) return;
    if (showDrop && activeIdx >= 0 && suggestions[activeIdx]) {
      selectSuggestion(suggestions[activeIdx]);
      return;
    }
    setShowDrop(false);
    setSuggestions([]);
    onSearch(value.trim());
  };

  const handleKeyDown = (e) => {
    if (!showDrop) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') { setShowDrop(false); }
  };

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div ref={wrapperRef} style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '700px', margin: '0 auto', position: 'relative' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Paste Spotify link..."
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoComplete="off"
            style={{ width: '100%', paddingLeft: '2.75rem', paddingRight: '2.75rem', height: '50px' }}
          />
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>

          {value && value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setSuggestions([]);
                setShowDrop(false);
                setActiveIdx(-1);
              }}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                zIndex: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'none';
              }}
              title="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}

          {showDrop && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'rgba(18, 20, 28, 0.98)', border: '1px solid rgba(203,249,0,0.2)',
              borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 200, overflow: 'hidden', backdropFilter: 'blur(16px)',
            }}>
              {suggestions.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  onMouseDown={() => selectSuggestion(item)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    padding: '0.6rem 1rem', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    background: idx === activeIdx ? 'rgba(203,249,0,0.08)' : 'transparent',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#fff' }}>{item.name}</span>
                  <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{item.artist}</span>
                </div>
              ))}
              <div style={{ padding: '0.35rem 1rem', fontSize: '0.62rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ⚽ FUT Golden Dataset
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="btn-primary" disabled={isLoading} style={{ height: '50px', padding: '0 2rem' }}>
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                <path d="M12 2C6.47715 2 2 6.47715 2 12C2 13.579 2.368 15.074 3.02 16.42" strokeDasharray="30" strokeDashoffset="10"></path>
              </svg>
              Checking...
            </span>
          ) : 'Scout Vibe'}
        </button>
      </div>

      <div style={{
        marginTop: '0.65rem',
        fontSize: '0.78rem',
        color: 'var(--text-secondary)',
        textAlign: 'center',
        opacity: 0.9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px'
      }}>
        <span>💡</span>
        <span>Tip: Search directly for songs or artists featured in past <strong style={{ color: 'var(--fc-lime)', fontWeight: '700' }}>FIFA</strong> soundtracks!</span>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
