const listeners = new Set();
let state = { isPlaying: false, currentTime: 0, duration: 0, volume: 1 };
let audio = null;
let currentTrackId = null;

function notify() {
  listeners.forEach(fn => fn(state));
}

export function initPlayer(track) {
  const trackId = track?.track_id || track?.id;
  if (trackId && trackId === currentTrackId) return;

  if (audio) {
    audio.pause();
    audio = null;
  }
  currentTrackId = trackId;
  state = { ...state, isPlaying: false, currentTime: 0, duration: 0 };

  if (!track?.preview_url) {
    notify();
    return;
  }

  const newAudio = new Audio(track.preview_url);
  newAudio.volume = state.volume;

  newAudio.onloadedmetadata = () => {
    state = { ...state, duration: newAudio.duration || 30 };
    notify();
  };

  newAudio.ontimeupdate = () => {
    state = { ...state, currentTime: newAudio.currentTime };
    notify();
  };

  newAudio.onended = () => {
    state = { ...state, isPlaying: false, currentTime: 0 };
    notify();
  };

  audio = newAudio;

  if (track.preventAutoplay) {
    notify();
  } else {
    const playPromise = newAudio.play();
    if (playPromise !== undefined) {
      state = { ...state, isPlaying: true };
      notify();
      playPromise.catch(err => {
        console.warn("Autoplay blocked by browser policy:", err);
        state = { ...state, isPlaying: false };
        notify();
      });
    }
  }
}

export function togglePlay() {
  if (!audio) return;
  if (state.isPlaying) {
    audio.pause();
    state = { ...state, isPlaying: false };
  } else {
    audio.play().then(() => {
      if (audio.duration) {
        state = { ...state, duration: audio.duration };
      }
    }).catch(err => console.error("Audio playback interrupted:", err));
    state = { ...state, isPlaying: true };
  }
  notify();
}

export function seek(e) {
  if (!audio) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;
  const newTime = (clickX / width) * state.duration;
  audio.currentTime = newTime;
  state = { ...state, currentTime: newTime };
  notify();
}

export function setVolume(v) {
  state = { ...state, volume: v };
  if (audio) audio.volume = v;
  notify();
}

export function setPlaying(playing) {
  if (playing && !state.isPlaying) {
    togglePlay();
  } else if (!playing && state.isPlaying) {
    togglePlay();
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function formatTime(secs) {
  if (isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
