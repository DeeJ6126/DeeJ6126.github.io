// BGM player. The <audio> element is created once by the inline script in
// SiteLayout.astro's <head> and exposed as window.__bgmAudio, so it sits
// outside the tree the ClientRouter swaps. That is what makes playback
// survive navigation: a declarative <audio> in the body is re-created from
// every incoming document (even with transition:persist), which used to
// rewind/stop the music on each click.
//
// The control panel lives in MusicPlayer.astro and is hidden via bgm.css on
// pages other than course pages; the audio keeps playing regardless.
//
// Behavior contract (per user request):
// - Music starts BY DEFAULT, and quietly: DEFAULT_VOLUME is deliberately low so
//   the page never opens with a burst of sound. A stored volume always wins.
// - Browsers block unmuted autoplay until the user has interacted with the page,
//   so when the initial play() is rejected we arm a one-shot listener and start
//   on the first click / key / touch. That is the only way to honour "on by
//   default" without lying about the state.
// - An EXPLICIT pause is remembered: a stored '0' suppresses the autoplay on
//   later visits. A fresh visit has no record at all, which now means "play".
// - Once started, music keeps playing across in-site navigations with no
//   audible gap and no progress rewind.
// - The queue plays in order; after the last song it wraps back to the
//   first. With a single song that means that song repeats forever.
// - Leaving the site (closing the tab, a full external page load) stops it.

const LS_INDEX = 'bgm:index';
const LS_VOLUME = 'bgm:volume';
const LS_PLAYING = 'bgm:playing';
const LS_TIME = 'bgm:time';

// Quiet by default: about a fifth of full scale.
const DEFAULT_VOLUME = 0.18;

// Audio-event bindings are attached only once per document lifetime. The
// audio element outlives navigations, so binding them again on every
// astro:page-load would stack duplicate listeners (N timeupdate handlers
// after N navigations, N redundant seeks on loadedmetadata, ...).
const AUDIO_WIRED = '__bgmAudioWired';

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getAudio() {
  return window.__bgmAudio || document.getElementById('bgm-audio');
}

// Status text and play/pause chrome are written through the CURRENT panel
// (published on window.__bgmUi by init), never through a captured node:
// the audio listeners are bound once and outlive the panel that was live
// when they were attached.
function setStatus(text) {
  const ui = window.__bgmUi;
  if (ui && ui.statusEl) ui.statusEl.textContent = text;
}

function setPlayingUI(isPlaying) {
  const ui = window.__bgmUi;
  if (!ui || !ui.panel) return;
  // The play/pause glyph and the play-button tint are driven by
  // `.bgm[data-playing="true"]` in bgm.css, so the flag has to land on the
  // .bgm root — not on .bgm-panel. Writing it to the panel left the icon
  // stuck on ▶ while the status text correctly said 正在播放.
  const root = ui.root || ui.panel.closest('.bgm');
  if (root) root.dataset.playing = isPlaying ? 'true' : 'false';
  if (ui.playBtn) ui.playBtn.setAttribute('aria-label', isPlaying ? '暂停' : '播放');
}

async function init() {
  const audio = getAudio();
  const panel = document.querySelector('[data-bgm-panel]');
  if (!audio || !panel) return;

  const songSelect = panel.querySelector('[data-bgm-song]');
  const seek = panel.querySelector('[data-bgm-seek]');
  const currentEl = panel.querySelector('[data-bgm-current]');
  const durationEl = panel.querySelector('[data-bgm-duration]');
  const statusEl = panel.querySelector('[data-bgm-status]');
  const playBtn = panel.querySelector('[data-bgm-play]');
  const prevBtn = panel.querySelector('[data-bgm-prev]');
  const nextBtn = panel.querySelector('[data-bgm-next]');
  const volumeInput = panel.querySelector('[data-bgm-volume]');

  if (!audio.src) audio.volume = storedVolume();

  let songs = [];
  try {
    const r = await fetch('/music/index.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('index.json not available');
    const j = await r.json();
    songs = Array.isArray(j.songs) ? j.songs.filter((s) => s && s.url) : [];
  } catch (_) {
    songs = [];
  }

  if (!songs.length) {
    setStatus('没有可用的音乐文件');
    panel.dataset.bgmReady = 'true';
    return;
  }

  // The dropdown only needs to be built once per tab. The panel is
  // transition:persist, so we tag it to avoid re-appending options (and
  // duplicate <option>s) on every navigation.
  if (!panel.dataset.bgmSongListBuilt) {
    songSelect.textContent = '';
    for (const s of songs) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.title || s.id;
      songSelect.appendChild(opt);
    }
    panel.dataset.bgmSongListBuilt = 'true';
  }

  // Which song is selected: prefer whatever the live audio element is
  // already playing (navigation), otherwise the last stored index.
  //
  // The queue and the current index live on `window`, NOT in this closure.
  // The panel's buttons are bound exactly once (see the bgmPanelWired guard
  // below), so a closure-captured `songs`/`index` would keep driving the
  // player with the FIRST page's queue after a navigation. Every handler
  // reads the shared state instead.
  let index = songs.findIndex((s) => s.url === audio.getAttribute('src'));
  if (index < 0) {
    let stored = NaN;
    try { stored = Number(localStorage.getItem(LS_INDEX)); } catch (_) { /* ignore */ }
    index = stored >= 0 && stored < songs.length ? stored : 0;
  }
  window.__bgmSongs = songs;
  window.__bgmIndex = index;
  songSelect.value = songs[index].id;

  // A fresh document takes the stored preference (or the quiet default); after
  // a navigation the live element already carries the user's current level, so
  // leave it alone - re-applying here would undo a change made while a
  // localStorage write was unavailable.
  audio.volume = audio.src ? audio.volume : storedVolume();
  if (volumeInput) volumeInput.value = String(audio.volume);

  function persist(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) { /* ignore */ }
  }

  // While the user is dragging the seek slider, timeupdate must not write
  // back to it: the handler would keep snapping the thumb and the time
  // readout back to the current playback position, so the display
  // "bounced" for the whole drag and only settled on release.
  let scrubbing = false;
  let scrubTimer = 0;
  function beginScrub() {
    scrubbing = true;
    // Safety net: if no change/pointerup ever arrives (pointer released
    // outside the window, event lost), stop suppressing anyway.
    clearTimeout(scrubTimer);
    scrubTimer = setTimeout(() => { scrubbing = false; }, 4000);
  }
  function endScrub() {
    clearTimeout(scrubTimer);
    scrubbing = false;
  }

  // The once-bound audio handlers below must not close over these nodes:
  // a navigation can hand us a different panel element, and a captured
  // stale reference would freeze the progress bar / time readout. They read
  // the current nodes from this shared object at call time instead.
  // `root` is the .bgm wrapper that bgm.css keys the play/pause glyph off.
  window.__bgmUi = { root: panel.closest('.bgm'), panel, seek, currentEl, durationEl, statusEl, songSelect, volumeInput, playBtn };

  function loadCurrent() {
    const list = window.__bgmSongs || [];
    const s = list[window.__bgmIndex];
    if (!s) return;
    audio.src = s.url;
    audio.load();
    songSelect.value = s.id;
    if (currentEl) currentEl.textContent = '0:00';
    if (durationEl) durationEl.textContent = '0:00';
    if (seek) seek.value = '0';
  }

  function play() {
    const attempt = audio.play();
    if (!attempt || typeof attempt.then !== 'function') return;
    return attempt.then(() => {
      setStatus('正在播放');
      persist(LS_PLAYING, 1);
    }).catch(() => {
      // Autoplay blocked because the document has no user gesture yet. Keep the
      // intent and start on the first interaction instead of just giving up.
      setStatus('点击任意处开始播放');
      setPlayingUI(false);
      armGestureResume(audio);
    });
  }

  function pause() {
    audio.pause();
    setStatus('已暂停');
    persist(LS_PLAYING, 0);
  }

  function togglePlay() {
    if (audio.paused) play(); else pause();
  }

  function select(newIndex, autoplay = true) {
    const list = window.__bgmSongs || [];
    if (!list.length) return;
    const n = ((newIndex % list.length) + list.length) % list.length;
    if (n === window.__bgmIndex && audio.getAttribute('src')) {
      // Same track. Restart it from the top: this is the single-song loop
      // case, and also what "play again" means after the track ended (an
      // ended element sits at the end, so play() alone would re-fire ended
      // immediately).
      if (audio.ended || audio.currentTime >= (audio.duration || Infinity)) {
        audio.currentTime = 0;
      }
      if (autoplay) play();
      return;
    }
    window.__bgmIndex = n;
    loadCurrent();
    persist(LS_INDEX, n);
    if (autoplay) play();
  }

  // ---- Audio bindings: once per document, not once per navigation ----
  if (!window[AUDIO_WIRED]) {
    window[AUDIO_WIRED] = true;

    audio.addEventListener('loadedmetadata', () => {
      const ui = window.__bgmUi || {};
      if (ui.durationEl) ui.durationEl.textContent = fmtTime(audio.duration);
      // Resume the stored position only when it belongs to THIS song (a reload
      // of the track that was playing). After a navigation the element is
      // untouched and must keep playing from where it is.
      const song = (window.__bgmSongs || [])[window.__bgmIndex];
      const savedT = song ? storedTimeFor(song.id) : 0;
      if (savedT > 0 && savedT < audio.duration - 0.5 && audio.currentTime < 0.5) {
        audio.currentTime = savedT;
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      // Don't fight the user's drag: the slider and readout are theirs until
      // they release, at which point `change` commits the new position.
      if (scrubbing) return;
      const ui = window.__bgmUi || {};
      if (ui.seek) ui.seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      if (ui.currentEl) ui.currentEl.textContent = fmtTime(audio.currentTime);
      const now = Date.now();
      if (now - (window.__bgmLastPersist || 0) > 5000) {
        window.__bgmLastPersist = now;
        persistTime(audio);
      }
    });

    audio.addEventListener('ended', () => {
      // Sequential queue that wraps: after the last song comes the first.
      // With a single song that means the song loops forever.
      const list = window.__bgmSongs;
      if (!list || !list.length) return;
      if (list.length === 1) {
        // Re-select the only track; select() restarts it because its src is
        // already set and play() is called again.
        window.__bgmSelect(0, true);
        return;
      }
      window.__bgmSelect(1, true);
    });

    audio.addEventListener('pause', () => setPlayingUI(false));
    audio.addEventListener('play', () => setPlayingUI(true));
  }

  // Publish the navigation hook for the once-bound handlers (the queue and
  // index are already on window above), plus the play hook the gesture
  // fallback needs.
  window.__bgmSelect = select;
  window.__bgmPlay = play;
  // A local mascot request goes through the same queue, audio node and saved state as the controls.
  window.__bgmPlaySong = (songId, { restart = false } = {}) => {
    const list = window.__bgmSongs || [];
    const next = list.findIndex(song => song.id === songId);
    if (next < 0) return Promise.reject(new Error('Song is not in the music queue'));
    select(next, false);
    if (restart) { audio.currentTime = 0; persistTime(audio); }
    return play();
  };

  // ---- Panel bindings: the panel element is persisting, but a swap may
  // still hand us a fresh node, so guard on the node itself.
  if (!panel.dataset.bgmPanelWired) {
    panel.dataset.bgmPanelWired = 'true';
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', () => select((window.__bgmIndex || 0) - 1));
    nextBtn.addEventListener('click', () => select((window.__bgmIndex || 0) + 1));
    songSelect.addEventListener('change', () => {
      const list = window.__bgmSongs || [];
      const i = list.findIndex((s) => s.id === songSelect.value);
      if (i >= 0) select(i);
    });
    if (volumeInput) {
      volumeInput.addEventListener('input', () => {
        audio.volume = clampVolume(Number(volumeInput.value));
        persist(LS_VOLUME, audio.volume);
      });
    }
    if (seek) {
      // Commit the seek on release (change) instead of on every input event:
      // continuous currentTime writes during a drag make the audio stutter.
      seek.addEventListener('pointerdown', beginScrub);
      seek.addEventListener('keydown', beginScrub);
      seek.addEventListener('input', () => {
        beginScrub();
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        const t = (Number(seek.value) / 1000) * audio.duration;
        if (currentEl) currentEl.textContent = fmtTime(t);
      });
      seek.addEventListener('change', () => {
        endScrub();
        if (!isFinite(audio.duration) || audio.duration <= 0) return;
        audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
        persistTime(audio);
      });
      seek.addEventListener('pointerup', endScrub);
      seek.addEventListener('pointercancel', endScrub);
      seek.addEventListener('blur', endScrub);
    }
  }

  // ---- Restore state ----
  if (!audio.getAttribute('src')) loadCurrent();
  setPlayingUI(!audio.paused);

  const storedPlaying = storedPlayingFlag();

  if (!audio.paused) {
    // Navigation case: the element never stopped, nothing to do.
    setStatus('正在播放');
  } else if (storedPlaying === '0') {
    // The user paused it deliberately last time: respect that and stay quiet.
    setStatus('点击 ▶ 开始播放');
  } else {
    // Default: start playing. A fresh visit stores nothing at all, and that now
    // means "play"; play() arms a gesture fallback if the browser blocks it.
    setStatus('正在播放');
    play();
  }

  // Always clear the "not ready" state: whatever happened above, the panel
  // is now wired and must be visible. Leaving it false would hide the
  // controls permanently with no way back.
  panel.dataset.bgmReady = 'true';
}

/**
 * Remember the playback position, tagged with the song it belongs to.
 *
 * The tag is load-bearing. This used to be a single bare number, so switching
 * songs made the new one jump to the OLD song's position: loadedmetadata fires
 * for the incoming track, reads the stored seconds, and seeks there as long as
 * the value fits the new duration (measured: song 2 started at 41.4s because
 * song 1 had reached 40s). Tagging makes a cross-song restore impossible while
 * a reload of the SAME song still resumes where it left off.
 */
function persistTime(audio) {
  const song = (window.__bgmSongs || [])[window.__bgmIndex];
  if (!song) return;
  try { localStorage.setItem(LS_TIME, `${song.id}:${audio.currentTime || 0}`); } catch (_) { /* ignore */ }
}

/** The stored position for this song, or 0 when there is none for it. */
function storedTimeFor(songId) {
  let raw = null;
  try { raw = localStorage.getItem(LS_TIME); } catch (_) { return 0; }
  if (!raw) return 0;
  const sep = raw.lastIndexOf(':');
  // No separator means the old bare-number format, whose song is unknown:
  // ignoring it is the only safe reading.
  if (sep < 0) return 0;
  if (raw.slice(0, sep) !== songId) return 0;
  const seconds = Number(raw.slice(sep + 1));
  return isFinite(seconds) && seconds > 0 ? seconds : 0;
}

function clampVolume(value) {
  if (!isFinite(value)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(1, value));
}

/**
 * The volume to start from: the stored preference when there is one, otherwise
 * the quiet default. Written with an explicit null check rather than
 * `stored || DEFAULT` so that a stored 0 (fully muted) is honoured instead of
 * being treated as falsy.
 */
function storedVolume() {
  let raw = null;
  try { raw = localStorage.getItem(LS_VOLUME); } catch (_) { /* ignore */ }
  if (raw === null || raw === '') return DEFAULT_VOLUME;
  return clampVolume(Number(raw));
}

function storedPlayingFlag() {
  try { return localStorage.getItem(LS_PLAYING); } catch (_) { return null; }
}

/**
 * Browsers reject unmuted play() until the user has interacted with the page.
 * Arm a one-shot listener so the autoplay still happens — on the first gesture
 * instead of silently doing nothing — and drop the pending attempt if the user
 * pauses in the meantime.
 */
function armGestureResume(audio) {
  if (window.__bgmGestureArmed) return;
  window.__bgmGestureArmed = true;
  const start = () => {
    document.removeEventListener('pointerdown', start, true);
    document.removeEventListener('keydown', start, true);
    document.removeEventListener('touchstart', start, true);
    window.__bgmGestureArmed = false;
    if (storedPlayingFlag() === '0') return;   // an explicit pause wins
    if (audio.paused) window.__bgmPlay();
  };
  document.addEventListener('pointerdown', start, true);
  document.addEventListener('keydown', start, true);
  document.addEventListener('touchstart', start, true);
}

// Attach the lifecycle hooks exactly once. The code below runs on every
// navigation (bgm.js is imported with ?astro-rerun) but the document-level
// listener must not stack. Deliberately NOT pausing on astro:before-swap:
// the audio element lives outside the swapped tree and has to keep going.
if (!window.__bgmListenersAttached) {
  window.__bgmListenersAttached = true;
  document.addEventListener('astro:page-load', () => {
    // The ClientRouter replaces the whole <head>, which detaches the audio
    // element we created in the inline bootstrap script. A detached media
    // element keeps playing, but it is unreachable through the document, so
    // re-attach the live node to the incoming head before init() looks it
    // up. Clearing any duplicate audio nodes also keeps us at exactly one.
    const audio = window.__bgmAudio;
    if (audio) {
      document.querySelectorAll('audio[data-bgm-audio]').forEach((el) => {
        if (el !== audio) el.remove();
      });
      if (!audio.isConnected) document.head.appendChild(audio);
    }
    // Re-hide the panel until init has re-bound the incoming DOM, so a
    // half-initialized panel never flashes mid-swap.
    const panel = document.querySelector('[data-bgm-panel]');
    if (panel) panel.dataset.bgmReady = 'false';
    init();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
