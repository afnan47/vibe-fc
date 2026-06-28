import React, { memo } from 'react';
import SearchBar from './SearchBar';
import HistoryList from './HistoryList';

const ScoutColumn = memo(function ScoutColumn({ activeTab, handleSearch, isSearchLoading, trackInput, setTrackInput, history }) {
  return (
    <div className={`glass-card app-col-scout ${activeTab === 'scout' ? 'active-tab' : ''}`} style={{
      display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', minHeight: 0, padding: '1.25rem', boxSizing: 'border-box'
    }}>
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', fontStyle: 'italic', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.75rem 0' }}>
          Scout Track
        </h3>
        <SearchBar onSearch={(val) => handleSearch(val, true)} isLoading={isSearchLoading} value={trackInput} onChange={setTrackInput} />
      </div>
      <div style={{ width: '100%', height: '1.5px', background: 'rgba(255, 255, 255, 0.06)' }}></div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1.5px', fontStyle: 'italic', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0 0 0.75rem 0' }}>
          Recent Scouts
        </h3>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <HistoryList history={history} onSelectTrack={(val) => handleSearch(val, false)} layout="vertical" />
        </div>
      </div>
    </div>
  );
});

export default ScoutColumn;
