import React, { useState, useEffect } from 'react';
import ScoutColumn from './components/ScoutColumn';
import ShowcaseColumn from './components/ShowcaseColumn';
import ScouterPlaylist from './components/ScouterPlaylist';
import MiniPlayer from './components/MiniPlayer';
import { initPlayer } from './lib/audioPlayer';

const API_BASE = 'http://127.0.0.1:8000';

export default function App() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  // Responsive & Active Tab States
  const [activeTab, setActiveTab] = useState('scout'); // 'scout' | 'showcase' | 'leaderboard'

  const [trackInput, setTrackInput] = useState('');
  const [presets, setPresets] = useState([]);

  // Fetch random presets on mount
  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/random-presets`);
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.error("Failed to fetch presets:", err);
    }
  };

  const handleSearch = async (inputString, isManualSearch = false) => {
    setIsLoading(true);
    if (isManualSearch) {
      setIsSearchLoading(true);
    }
    setError(null);
    if (isManualSearch) {
      setTrackInput(inputString); // populate the search input box
    } else {
      setTrackInput(''); // Clear the search bar when selecting from lists/presets
    }
    try {
      const res = await fetch(`${API_BASE}/api/vibe?track_input=${encodeURIComponent(inputString)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to analyze track.");
      }
      const data = await res.json();
      const isLink = /https?:\/\//i.test(inputString) || inputString.includes('spotify.com') || inputString.includes('spotify:track:');
      const trackData = { ...data, preventAutoplay: isLink };
      setSelectedTrack(trackData);
      initPlayer(trackData);
      if (isManualSearch) {
        setTrackInput(`${data.title} — ${data.artist}`);
      } else {
        setTrackInput('');
      }
      
      // Haptic feedback trigger (vibrate 100ms, pause 50ms, vibrate 100ms)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      
      
      setHistory(prev => {
        const filtered = prev.filter(t => (t.id || t.track_id) !== (data.id || data.track_id));
        return [data, ...filtered].slice(0, 10);
      }); // Add to session history without duplicates
    } catch (err) {
      setError(err.message);
      setSelectedTrack(null);
      initPlayer(null);
    } finally {
      setIsLoading(false);
      setIsSearchLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Header Banner */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h1>
              FUTVIBE
            </h1>
          </div>
        </div>
      </header>

      {/* Main Grid: 3 columns */}
      <div className="main-app-grid">
        <ScoutColumn
          activeTab={activeTab}
          handleSearch={handleSearch}
          isSearchLoading={isSearchLoading}
          trackInput={trackInput}
          setTrackInput={setTrackInput}
          history={history}
        />
        <ShowcaseColumn
          activeTab={activeTab}
          selectedTrack={selectedTrack}
          isLoading={isLoading}
          error={error}
          presets={presets}
          fetchPresets={fetchPresets}
          onSearch={handleSearch}
        />
        <div className={`app-col-leaderboard ${activeTab === 'leaderboard' ? 'active-tab' : ''}`} style={{
          height: '100%',
          minHeight: 0
        }}>
          <ScouterPlaylist onSelectTrack={(val) => handleSearch(val, false)} />
        </div>
      </div>

      {/* MiniPlayer: Persistent mobile bottom bar */}
      <MiniPlayer
        selectedTrack={selectedTrack}
        onNavigateToShowcase={() => setActiveTab('showcase')}
      />

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${activeTab === 'scout' ? 'active' : ''}`}
          onClick={() => setActiveTab('scout')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Scout</span>
        </button>
        
        <button 
          className={`bottom-nav-item ${activeTab === 'showcase' ? 'active' : ''}`}
          onClick={() => setActiveTab('showcase')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <span>Showcase</span>
        </button>
        
        <button 
          className={`bottom-nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
          </svg>
          <span>Leaderboard</span>
        </button>
      </nav>

    </div>
  );
}
