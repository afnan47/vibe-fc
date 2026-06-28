import { useState, useEffect } from 'react';
import { subscribe, getState, initPlayer, togglePlay, seek, setVolume, formatTime } from './audioPlayer';

export function useAudioPlayer() {
  const [s, setS] = useState(getState);
  useEffect(() => subscribe(setS), []);
  return { ...s, initPlayer, togglePlay, seek, setVolume, formatTime };
}
