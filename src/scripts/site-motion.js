import {
  INTRO_CLASS,
  INTRO_STORAGE_KEY,
  MOTION_DURATIONS,
  classifyMotionIntent,
  clearMotionLayer,
  endIntroSession,
  playCourseEnter,
  playCourseExit,
  playIntro,
  playProjectEnter,
  playProjectExit,
  playSectionEnter,
  playSectionExit,
  shouldPlayIntro,
} from './motion-timelines.mjs';

const setupKey = '__deeSiteMotionReady';

function pageFromPath(pathname) {
  if (pathname.startsWith('/projects')) return 'projects';
  if (pathname.startsWith('/about')) return 'about';
  return 'courses';
}

function snapshotSource(source, kind) {
  if (!(source instanceof Element)) return null;
  const root = kind === 'course-detail'
    ? source.closest('[data-course-entry]')?.querySelector('.course-cover')
    : kind === 'project-detail'
      ? source.closest('[data-project-entry]')?.querySelector('.project-visual')
      : source;
  if (!(root instanceof HTMLElement)) return null;
  const rect = root.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const image = root.querySelector('img');
  return {
    sourceRect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    imageSrc: image instanceof HTMLImageElement ? image.currentSrc || image.src : '',
  };
}

function buildIntent(event) {
  const source = event.sourceElement instanceof Element
    ? event.sourceElement.closest('a')
    : null;
  const explicit = source?.dataset.motion;
  const kind = classifyMotionIntent({ explicit, direction: event.direction });
  const currentPage = document.body.dataset.motionPage || pageFromPath(location.pathname);
  const targetPage = source?.dataset.motionTargetPage || pageFromPath(event.to.pathname);
  const pageOrder = { courses: 0, projects: 1, about: 2 };
  const travelDirection = pageOrder[targetPage] >= pageOrder[currentPage] ? 1 : -1;
  const snapshot = snapshotSource(source, kind);
  if ((kind === 'course-detail' || kind === 'project-detail') && !snapshot) {
    return {
      kind: 'section',
      currentPage,
      targetPage,
      travelDirection,
      crossSection: currentPage !== targetPage,
    };
  }
  return {
    kind,
    currentPage,
    targetPage,
    travelDirection,
    crossSection: currentPage !== targetPage,
    ...snapshot,
  };
}

function playExit(layer, intent) {
  if (intent.kind === 'course-detail') return playCourseExit(layer, intent, intent.runId);
  if (intent.kind === 'project-detail') return playProjectExit(layer, intent, intent.runId);
  return playSectionExit(layer, intent, intent.runId);
}

function playEnter(layer, intent) {
  if (intent.kind === 'course-detail') return playCourseEnter(layer, intent, intent.runId);
  if (intent.kind === 'project-detail') return playProjectEnter(layer, intent, intent.runId);
  return playSectionEnter(layer, intent, intent.runId);
}

function focusPage() {
  const target = document.querySelector('main h1, main');
  if (!(target instanceof HTMLElement)) return;
  const hadTabindex = target.hasAttribute('tabindex');
  if (!hadTabindex) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  if (!hadTabindex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
}

function sessionHasIntro() {
  try {
    return sessionStorage.getItem(INTRO_STORAGE_KEY) === '1';
  } catch {
    return window.__deeMotionIntroSeen === true;
  }
}

function markIntroSeen() {
  window.__deeMotionIntroSeen = true;
  try {
    sessionStorage.setItem(INTRO_STORAGE_KEY, '1');
  } catch {
    // Storage can be unavailable in strict privacy modes; navigation still works.
  }
}

function setup() {
  if (window[setupKey]) return;
  window[setupKey] = true;
  const layer = document.querySelector('[data-motion-layer]');
  if (!(layer instanceof HTMLElement)) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let activeIntent = null;
  let cleanupTimer = 0;
  let introTimer = 0;
  let introFrame = 0;
  let nextRunId = 0;

  const scheduleFailsafe = (runId, duration) => {
    clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      clearMotionLayer(layer, runId);
    }, duration);
  };

  const startRun = () => {
    clearTimeout(cleanupTimer);
    clearTimeout(introTimer);
    if (introFrame) cancelAnimationFrame(introFrame);
    introFrame = 0;
    endIntroSession(layer);
    nextRunId += 1;
    return nextRunId;
  };

  document.addEventListener('astro:before-preparation', event => {
    if (reduceMotion.matches) return;
    const runId = startRun();
    const intent = { ...buildIntent(event), runId };
    activeIntent = intent;
    const originalLoader = event.loader;
    event.loader = async () => {
      const results = await Promise.allSettled([
        originalLoader(),
        playExit(layer, intent),
      ]);
      const loadResult = results[0];
      if (loadResult.status === 'rejected') {
        clearMotionLayer(layer, runId);
        if (activeIntent?.runId === runId) {
          clearTimeout(cleanupTimer);
          activeIntent = null;
        }
        throw loadResult.reason;
      }
    };
    event.signal.addEventListener('abort', () => {
      clearMotionLayer(layer, runId);
      if (activeIntent?.runId === runId) activeIntent = null;
    }, { once: true });
    scheduleFailsafe(runId, 10000);
  });

  document.addEventListener('astro:after-swap', () => {
    if (!activeIntent) {
      if (reduceMotion.matches) focusPage();
      return;
    }
    if (reduceMotion.matches) {
      const intent = activeIntent;
      clearTimeout(cleanupTimer);
      activeIntent = null;
      clearMotionLayer(layer, intent.runId);
      focusPage();
      return;
    }
    const intent = activeIntent;
    clearTimeout(cleanupTimer);
    scheduleFailsafe(intent.runId, 1800);
    document.documentElement.classList.add('is-motion-running');
    playEnter(layer, intent)
      .catch(() => clearMotionLayer(layer, intent.runId))
      .finally(() => {
        if (activeIntent?.runId !== intent.runId) return;
        clearTimeout(cleanupTimer);
        activeIntent = null;
        clearMotionLayer(layer, intent.runId);
        focusPage();
      });
  });

  if (shouldPlayIntro({ seen: sessionHasIntro(), reduceMotion: reduceMotion.matches })) {
    markIntroSeen();
    // Hide the finished page before first paint so the intro never flashes content.
    document.documentElement.classList.add(INTRO_CLASS);
    introFrame = requestAnimationFrame(() => {
      introFrame = 0;
      const runId = startRun();
      document.documentElement.classList.add(INTRO_CLASS);
      // Failsafe, not a budget: it must sit ABOVE the intro's own length
      // (MOTION_DURATIONS.intro) or it cuts the sequence off mid-reveal.
      introTimer = window.setTimeout(() => endIntroSession(layer, runId), MOTION_DURATIONS.intro + 600);
      playIntro(layer, runId)
        .catch(() => endIntroSession(layer, runId))
        .finally(() => {
          clearTimeout(introTimer);
          endIntroSession(layer, runId);
        });
    });
  }

  reduceMotion.addEventListener('change', event => {
    if (!event.matches) return;
    clearTimeout(cleanupTimer);
    clearTimeout(introTimer);
    if (introFrame) cancelAnimationFrame(introFrame);
    introFrame = 0;
    activeIntent = null;
    endIntroSession(layer);
  });
}

setup();
