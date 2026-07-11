import React, { useState, useEffect } from 'react';
import ScoutColumn from './components/ScoutColumn';
import ShowcaseColumn from './components/ShowcaseColumn';
import ScouterPlaylist from './components/ScouterPlaylist';
import MiniPlayer from './components/MiniPlayer';
import { initPlayer } from './lib/audioPlayer';

const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '';

export default function App() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [error, setError] = useState(null);

  // Responsive & Active Tab States
  const [activeTab, setActiveTab] = useState('scout'); // 'scout' | 'showcase' | 'leaderboard'
  const [activeModal, setActiveModal] = useState(null); // null | 'privacy' | 'terms'

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
              VIBEFC
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

      {/* Footer Disclaimer & Legal Links */}
      <footer className="app-footer-bar">
        <div className="footer-content">
          <span>VibeFC is a fan-made soundtrack companion not affiliated with EA Sports or FIFA.</span>
          <div className="footer-links">
            <button className="footer-btn" onClick={() => setActiveModal('privacy')}>Privacy Policy</button>
            <span className="footer-sep">|</span>
            <button className="footer-btn" onClick={() => setActiveModal('terms')}>Terms of Service</button>
          </div>
        </div>
      </footer>

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

      {/* Legal Modal Overlay */}
      {activeModal && (
        <div className="legal-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="legal-modal-content" onClick={e => e.stopPropagation()}>
            <button className="legal-modal-close" onClick={() => setActiveModal(null)}>×</button>
            {activeModal === 'privacy' ? (
              <div className="legal-text-content">
                <h2>Privacy Policy</h2>
                <p className="last-updated">Last Updated: July 9, 2026</p>
                <p>This Privacy Policy describes how VibeFC handles information when you use our website and services.</p>
                <h3>1. Information We Do Not Collect</h3>
                <p>We do not collect, store, or share any personal information, such as your name, email address, IP address, or physical location. No registration is required.</p>
                <h3>2. Cached Data</h3>
                <p>When you search or check a track, the track metadata (such as title, artist, cover art, and audio features) and its calculated vibe score are cached anonymously in our database to optimize future lookups.</p>
                <h3>3. Third-Party Services</h3>
                <p>We access metadata, cover art, and audio previews from public third-party CDNs (like Spotify). Their own terms and privacy policies apply to content accessed from their systems.</p>
              </div>
            ) : (
              <div className="legal-text-content">
                <h2>Terms of Service</h2>
                <p className="last-updated">Last Updated: July 9, 2026</p>
                <p>Welcome to VibeFC! By using our website, you agree to the following terms.</p>
                <h3>1. Permitted Use</h3>
                <p>This service is provided for personal, non-commercial entertainment and research. Automated query flooding or abuse is prohibited.</p>
                <h3>2. Intellectual Property</h3>
                <p>All music metadata, artists, album names, cover art, and audio previews remain properties of their respective copyright holders. VibeFC does not claim ownership over any musical assets.</p>
                <h3>3. Disclaimer & Non-Affiliation</h3>
                <p>FIFA, FUT, and EA FC are trademarks of Electronic Arts Inc. and FIFA. VibeFC is an independent fan-made platform not officially sponsored or endorsed by them.</p>
                <h3>4. Warranties</h3>
                <p>This service is provided "as is" without warranty of any kind, including vibe score accuracy or uninterrupted uptime.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
