import React, { useState } from 'react';

export default function SearchBar({ onSearch, isLoading, value, onChange }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSearch(value.trim());
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        width: '100%',
        maxWidth: '700px',
        margin: '0 auto'
      }}>
        <div style={{
          position: 'relative',
          flex: 1
        }}>
          <input
            type="text"
            className="input-field"
            placeholder="Paste Spotify Song Link or Track ID (e.g. 7ouMYWpwJ...)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isLoading}
            style={{
              width: '100%',
              paddingLeft: '2.75rem',
              height: '50px'
            }}
          />
          <span style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            opacity: 0.5
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
        </div>
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={isLoading}
          style={{ height: '50px', padding: '0 2rem' }}
        >
          {isLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="spinner-icon" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                <path d="M12 2C6.47715 2 2 6.47715 2 12C2 13.579 2.368 15.074 3.02 16.42" strokeDasharray="30" strokeDashoffset="10"></path>
              </svg>
              Checking...
            </span>
          ) : (
            "Analyze Vibe"
          )}
        </button>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
}
