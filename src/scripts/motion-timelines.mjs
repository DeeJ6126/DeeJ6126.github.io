export const INTRO_STORAGE_KEY = 'dee:motion-intro-seen';

export const INTRO_CLASS = 'is-intro-playing';
export const INTRO_LIT_CLASS = 'is-intro-lit';
export const INTRO_IN_CLASS = 'is-intro-in';

export const MOTION_ASSETS = Object.freeze({
  birdFlight: '/img/motion/bird-flight.png',
});

const courseTiming = Object.freeze({
  exitCover: 340,
  exitGuide: 300,
  exitGuideDelay: 36,
  exitGuideStagger: 22,
  enterCover: 370,
  enterGuide: 310,
  enterGuideDelay: 34,
  enterGuideStagger: 20,
  enterFade: 384,
  baseline: 30,
});

const courseExitDuration = Math.max(
  courseTiming.exitCover,
  courseTiming.exitGuideDelay + courseTiming.exitGuideStagger * 2 + courseTiming.exitGuide,
);
const courseEnterDuration = Math.max(
  courseTiming.enterCover,
  courseTiming.enterGuideDelay + courseTiming.enterGuideStagger * 2 + courseTiming.enterGuide,
  courseTiming.enterFade,
) + courseTiming.baseline;

const projectTiming = Object.freeze({
  exitClone: 330,
  exitNode: 250,
  exitNodeDelay: 76,
  exitNodeStagger: 18,
  exitLink: 210,
  exitLinkDelay: 96,
  exitLinkStagger: 18,
  collapseNode: 140,
  collapseLink: 130,
  collapseStagger: 5,
  enterClone: 330,
  enterFade: 110,
  enterFadeDelay: 230,
});

const projectExitDuration = Math.max(
  projectTiming.exitClone,
  projectTiming.exitNodeDelay + projectTiming.exitNodeStagger * 6 + projectTiming.exitNode,
  projectTiming.exitLinkDelay + projectTiming.exitLinkStagger * 6 + projectTiming.exitLink,
);
const projectEnterDuration = Math.max(
  projectTiming.collapseNode + projectTiming.collapseStagger * 6,
  projectTiming.collapseLink + projectTiming.collapseStagger * 6,
) + Math.max(
  projectTiming.enterClone,
  projectTiming.enterFadeDelay + projectTiming.enterFade,
);

export const MOTION_DURATIONS = Object.freeze({
  // The opening sequence is now the full brand intro: wireframe 0.77s, black
  // held until the square closes, word entrance/exit through 2.6s, then the
  // square dissolves and the page reveals in one motion, settling at 3.2s. (It
  // was 2.32s when the intro was the three-block self-assembly.)
  intro: 3200,
  section: 850,
  courseDetail: courseExitDuration + courseEnterDuration,
  projectDetail: projectExitDuration + projectEnterDuration,
});

const colors = ['#17336c', '#1265f3', '#78cdf9', '#d7eaff'];
const enterEase = 'cubic-bezier(.22,.72,.18,1)';
const exitEase = 'cubic-bezier(.7,0,.84,.24)';
const shiftEase = 'cubic-bezier(.4,0,.2,1)';

export function classifyMotionIntent({ explicit, direction } = {}) {
  if (explicit === 'course-detail' || explicit === 'project-detail' || explicit === 'section') {
    return explicit;
  }
  if (direction === 'back' || direction === 'forward') return 'section';
  return 'section';
}

export function shouldPlayIntro({ seen, reduceMotion }) {
  return !seen && !reduceMotion;
}

const wait = duration => new Promise(resolve => setTimeout(resolve, duration));

function applyFinalFrame(element, frame) {
  for (const [property, value] of Object.entries(frame ?? {})) {
    if (property === 'offset' || property === 'easing' || property === 'composite') continue;
    element.style[property] = String(value);
  }
}

function tween(element, keyframes, options = {}) {
  if (!(element instanceof Element)) return Promise.resolve();
  const duration = Number(options.duration ?? 0);
  const delay = Number(options.delay ?? 0);
  if (typeof element.animate !== 'function') {
    applyFinalFrame(element, keyframes[0]);
    return wait(delay + duration).then(() => applyFinalFrame(element, keyframes.at(-1)));
  }
  const animation = element.animate(keyframes, { fill: 'forwards', ...options });
  return animation.finished.catch(() => undefined);
}

function make(stage, className, tagName = 'i') {
  const element = document.createElement(tagName);
  element.className = className;
  stage.append(element);
  return element;
}

function setRect(element, rect) {
  Object.assign(element.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
}

function moveTo(element, target, options) {
  const source = element.getBoundingClientRect();
  setRect(element, target);
  const scaleX = target.width ? source.width / target.width : 1;
  const scaleY = target.height ? source.height / target.height : 1;
  const inverse = `translate3d(${source.left - target.left}px,${source.top - target.top}px,0) scale(${scaleX},${scaleY})`;
  return tween(element, [
    { transform: inverse, transformOrigin: 'top left' },
    { transform: 'translate3d(0,0,0) scale(1,1)', transformOrigin: 'top left' },
  ], options);
}

function morphRect(element, target, options) {
  const source = element.getBoundingClientRect();
  return tween(element, [
    {
      left: `${source.left}px`,
      top: `${source.top}px`,
      width: `${source.width}px`,
      height: `${source.height}px`,
    },
    {
      left: `${target.left}px`,
      top: `${target.top}px`,
      width: `${target.width}px`,
      height: `${target.height}px`,
    },
  ], options);
}

function isCurrent(layer, runId) {
  return runId === undefined || layer.dataset.motionRun === String(runId);
}

function getRunStage(layer, runId) {
  return layer.querySelector(`[data-motion-run="${runId}"]`);
}

function activate(layer, state, runId) {
  layer.hidden = false;
  layer.dataset.motionState = state;
  layer.dataset.motionRun = String(runId);
  layer.classList.add('is-active');
  layer.style.opacity = '1';
  document.documentElement.classList.add('is-motion-running');
  const root = layer.querySelector('[data-motion-stage]');
  root?.replaceChildren();
  if (!(root instanceof HTMLElement)) return null;
  const stage = document.createElement('div');
  stage.className = 'motion-run';
  stage.dataset.motionRun = String(runId);
  root.append(stage);
  return stage;
}

export function clearMotionLayer(layer, runId) {
  if (!(layer instanceof HTMLElement)) return;
  if (!isCurrent(layer, runId)) return;
  if (typeof layer.getAnimations === 'function') {
    layer.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
  }
  layer.querySelector('[data-motion-stage]')?.replaceChildren();
  layer.classList.remove('is-active', 'is-opaque', 'is-dark');
  layer.style.removeProperty('opacity');
  delete layer.dataset.motionState;
  delete layer.dataset.motionRun;
  layer.hidden = true;
  document.documentElement.classList.remove('is-motion-running');
}

export function endIntroSession(layer, runId) {
  // 通知 <head> 里的内联兜底定时器：开场已被脚本接管并结束。
  window.__deeMotionIntroDone = true;
  document.documentElement.classList.remove(INTRO_CLASS);
  document.querySelectorAll(`.${INTRO_LIT_CLASS}, .${INTRO_IN_CLASS}`).forEach(element => {
    element.classList.remove(INTRO_LIT_CLASS, INTRO_IN_CLASS);
    if (element instanceof HTMLElement) element.style.removeProperty('--intro-tone');
  });
  clearMotionLayer(layer, runId);
}

// ---------------------------------------------------------------------------
// Opening sequence ("brand intro").
//
// Recreates the measured first seconds of the source clip, then dissolves the
// gradient square and reveals the page in two tight phases:
//
//   0-767      the wireframe draws itself counter-clockwise
//   767-967    black -> paper crossfade; the gradient square fills in
//   1400-1900  "Dee's" and "Blog" decelerate onto their cell centres
//   2200-2600  the words accelerate off-frame
//   2200-2660  the square (and the paper beneath it) dissolve away
//   2280-2600  phase 1: the site chrome (header, rail) rises in
//   2690-3280  phase 2: the page content follows, a short beat later
//   3400       settled
//
// Geometry is authored in a 1920x1080 reference frame and converted to viewport
// Geometry is authored in a 1920x1080 reference frame that brandFrame() centres
// in the viewport, so it lines up at any window size. The reveal is
// driven from JS rather than the CSS delays that used to live in
// site-motion.css: two clocks over the same elements drift apart, and the CSS
// delays had to be edited by hand every time a beat moved.
// ---------------------------------------------------------------------------
const brandBeat = Object.freeze({
  wireDone: 767,        // the lap closes the square (last side lands at 733)
  blackHold: 140,       // keep the black ground AFTER the square closes
  crossfadeStart: 907,  // = wireDone + blackHold
  crossfadeEnd: 1107,
  wordIn: 1400,
  wordPark: 1900,
  wordExitEnd: 2600,
  squareOut: 2200,
  squareGone: 2660,
  // ONE reveal beat: the site chrome and the page content come up together.
  // They were briefly two phases (chrome, a 90ms beat, then content); on
  // request they are now synchronised, so the whole page arrives at once.
  reveal: 2280,
  revealDur: 420,
  tail: 3200,
});

/**
 * The 1920x1080 reference frame, CENTRED in the viewport.
 *
 * Centring matters: `min(w/1920, h/1080)` only makes the frame fill the viewport
 * on exactly 16:9. On a wider window the frame is narrower than the viewport, so
 * drawing the square at 960*scale put its centre left of the real centre
 * (measured: 60px left at 1426x734). Every position goes through atX/atY, which
 * add the frame's origin; sizes stay plain *scale.
 */
function brandFrame() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  return {
    scale,
    originX: (innerWidth - 1920 * scale) / 2,
    originY: (innerHeight - 1080 * scale) / 2,
  };
}

// Word travel, sampled every 40ms from the same model the tuning tool uses:
// approach 1809.75px in 0.50s decaying 6894 -> 345 px/s (the slowest instant is
// exactly on the cell centre), then 3376.1px out over 0.65s accelerating to
// 10043 px/s. `dx` is the offset from the parked centre - negative while
// approaching, positive once the word leaves.
const WORD_FRAMES = Object.freeze([
  [0, -1809.75], [40, -1324.7], [80, -959.6], [120, -690.1], [160, -495],
  [200, -356.4], [240, -259.1], [280, -190.6], [320, -141.3], [360, -103.7],
  [400, -72.2], [440, -43.6], [480, -15.8], [520, 12], [560, 39.9],
  [600, 69.1], [640, 101.4], [680, 140.1], [720, 189], [760, 253.3],
  [800, 339], [840, 453.1], [880, 603.6], [920, 799.7], [960, 1051.5],
  [1000, 1369.9], [1040, 1767.1], [1080, 2256.2], [1120, 2851.2], [1150, 3376.1],
]);

const WORD_START = -1809.75;
const WORD_END = 3376.1;

/** the intro scene: ground, paper, wireframe, square and the two words */
function makeBrandScene(stage, frame) {
  const { scale, originX, originY } = frame;
  const size = (value) => value * scale;
  const atX = (value) => originX + value * scale;
  const atY = (value) => originY + value * scale;
  const layerOf = (className, tagName = 'div') => {
    const el = document.createElement(tagName);
    el.className = className;
    stage.append(el);
    return el;
  };

  const ground = layerOf('motion-brand-ground');
  const paper = layerOf('motion-brand-paper');

  const wire = layerOf('motion-brand-wire');
  wire.innerHTML = '<svg viewBox="0 0 232 232" preserveAspectRatio="none" aria-hidden="true">'
    + '<path d="M232,232 L232,0 L0,0 L0,232 Z" /></svg>';
  const wirePath = wire.querySelector('path');

  const square = layerOf('motion-brand-square');

  const wordWrap = (className, text, cell) => {
    const wrap = layerOf(className);
    const glyph = document.createElement('p');
    glyph.className = 'motion-brand-glyph';
    glyph.textContent = text;
    wrap.append(glyph);
    wrap.style.left = `${atX(cell.cx)}px`;
    wrap.style.top = `${atY(cell.cy)}px`;
    glyph.style.fontSize = `${size(155)}px`;
    return { wrap, glyph };
  };
  const dees = wordWrap('motion-brand-word is-dees', 'Dee\u2019s', { cx: 480, cy: 270 });
  const blog = wordWrap('motion-brand-word is-blog', 'Blog', { cx: 1440, cy: 810 });

  // The measured block is 232x218. Its top edge is placed so the block's CENTRE
  // lands exactly on the reference frame's centre (960, 540): the source clip
  // had it sharing the wireframe's top edge, which left it 7 reference px high,
  // and that reads as "not centred" on screen. The wireframe (232x232) is
  // concentric with it.
  setRect(square, { left: atX(960 - 116), top: atY(540 - 109), width: size(232), height: size(218) });
  setRect(wire, { left: atX(960 - 116), top: atY(540 - 116), width: size(232), height: size(232) });

  return { ground, paper, wire, wirePath, square, dees, blog };
}

/**
 * Build the whole intro on ONE clock: every animation below runs for
 * brandBeat.tail so a single currentTime drives the sequence, and the reveal
 * keyframes are expressed as fractions of that same duration.
 *
 * Every animation uses duration = tail. An animation with its own shorter
 * duration must NOT use `at()` for offsets: `at()` divides by tail, so feeding
 * it to a 967ms animation made the black ground start fading at 218ms instead
 * of 767ms - which is why the backdrop lightened while the square was still
 * being drawn.
 */
function playBrandTimeline(refs, scale) {
  const { ground, paper, wire, wirePath, square, dees, blog } = refs;
  const tail = brandBeat.tail;
  const at = (t) => Math.min(1, Math.max(0, t / tail));
  const animations = [];
  const animate = (element, frames, duration = tail) => {
    const animation = element.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
    animation.currentTime = 0;
    animations.push(animation);
    return animation;
  };

  // --- the wireframe lap: four cumulative quarter laps ---
  const wireLength = 232 * 4;
  wirePath.style.strokeDasharray = `${wireLength}`;
  wirePath.style.strokeDashoffset = `${wireLength}`;
  const lap = [[0, 0], [33, 16], [200, 232], [300, 464], [367, 656], [400, 696], [733, 928]];
  animate(wirePath, lap
    .map(([t, drawn]) => ({ strokeDashoffset: Math.max(0, wireLength - drawn), offset: t / brandBeat.crossfadeStart }))
    .concat([{ strokeDashoffset: 0, offset: 1 }]), brandBeat.crossfadeStart);
  // The outline becomes the filled square. Without this the wireframe stays on
  // screen: it is 232x232 while the square is 232x218, so it reads as a pale
  // cyan border around the block. It clears quickly (70ms) rather than fading
  // across the whole crossfade, so it never lingers as a visible outline.
  animate(wire, [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: at(brandBeat.crossfadeStart) },
    { opacity: 0, offset: at(brandBeat.crossfadeStart + 70) },
    { opacity: 0, offset: 1 },
  ]);

  // --- black -> paper, and the paper dissolves with the square ---
  // Black is held until crossfadeStart (= wireDone + blackHold), so the square
  // is already closed before the backdrop starts to lighten.
  animate(ground, [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: at(brandBeat.crossfadeStart) },
    { opacity: 0, offset: at(brandBeat.crossfadeEnd) },
    { opacity: 0, offset: 1 },
  ]);
  animate(paper, [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: at(brandBeat.crossfadeStart) },
    { opacity: 1, offset: at(brandBeat.crossfadeEnd) },
    { opacity: 1, offset: at(brandBeat.squareOut) },
    { opacity: 0, offset: at(brandBeat.squareGone) },
    { opacity: 0, offset: 1 },
  ]);
  // the square fills in, holds, then dissolves (with a slight recess)
  animate(square, [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: at(brandBeat.crossfadeStart) },
    { opacity: .45, offset: at(brandBeat.crossfadeStart + 33) },
    { opacity: .85, offset: at(brandBeat.crossfadeStart + 100) },
    { opacity: 1, offset: at(brandBeat.crossfadeEnd) },
    { opacity: 1, offset: at(brandBeat.squareOut) },
    { opacity: 0, offset: at(brandBeat.squareGone) },
    { opacity: 0, offset: 1 },
  ]);
  animate(square, [
    { transform: 'translateY(0) scale(1)', offset: 0 },
    { transform: 'translateY(0) scale(1)', offset: at(brandBeat.squareOut) },
    { transform: `translateY(${-16 * scale}px) scale(1.035)`, offset: at(brandBeat.squareGone) },
    { transform: `translateY(${-16 * scale}px) scale(1.035)`, offset: 1 },
  ]);

  // --- the words: in, settle on the cell centre, then out ---
  const wordFrames = (direction) => {
    const px = (dx) => `${(direction * dx * scale).toFixed(1)}px`;
    // Offsets must be monotonically non-decreasing. WORD_FRAMES[0] sits at
    // exactly offset at(wordIn), so it is folded into the fade-in frame below
    // instead of being emitted twice with a decreasing offset (which throws and
    // silently kills the whole intro).
    const frames = [
      { opacity: 0, transform: `translateX(${px(WORD_START)})`, offset: 0 },
      { opacity: 0, transform: `translateX(${px(WORD_START)})`, offset: at(brandBeat.wordIn) },
      { opacity: 1, transform: `translateX(${px(WORD_START)})`, offset: at(brandBeat.wordIn + 30) },
    ];
    for (const [t, dx] of WORD_FRAMES) {
      if (t === 0) continue;
      frames.push({ opacity: 1, transform: `translateX(${px(dx)})`, offset: at(brandBeat.wordIn + t) });
    }
    frames.push({ opacity: 1, transform: `translateX(${px(WORD_END)})`, offset: 1 });
    return frames;
  };
  animate(dees.glyph, wordFrames(1));
  animate(blog.glyph, wordFrames(-1));
  const wrapFrames = [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: at(brandBeat.wordIn) },
    { opacity: 1, offset: at(brandBeat.wordIn + 30) },
    { opacity: 1, offset: at(brandBeat.wordExitEnd) },
    { opacity: 0, offset: at(brandBeat.wordExitEnd + 40) },
    { opacity: 0, offset: 1 },
  ];
  animate(dees.wrap, wrapFrames);
  animate(blog.wrap, wrapFrames);

  return animations;
}

/**
 * Reveal the page. Everything - the site chrome and the page content - starts on
 * the SAME beat and runs for the same duration, so the page arrives in one
 * motion rather than in phases. The chrome is revealed as whole blocks so its
 * borders arrive with it, and the mascot is faded only: it has its own drag
 * transform, which a transform animation here would fight.
 *
 * Returns the animations so the caller can cancel them once the intro class is
 * gone and the page's own styles take over.
 */
function playRevealTimeline(scale) {
  const animations = [];
  const tail = brandBeat.tail;
  const at = (t) => Math.min(1, Math.max(0, t / tail));
  const rise = (element, { opacityOnly = false } = {}) => {
    const hidden = opacityOnly
      ? { opacity: 0 }
      : { opacity: 0, transform: `translateY(${18 * scale}px)` };
    const shown = opacityOnly
      ? { opacity: 1 }
      : { opacity: 1, transform: 'translateY(0px)' };
    const animation = element.animate([
      { ...hidden, offset: 0 },
      { ...hidden, offset: at(brandBeat.reveal) },
      { ...shown, offset: at(brandBeat.reveal + brandBeat.revealDur) },
      { ...shown, offset: 1 },
    ], { duration: tail, easing: 'linear', fill: 'forwards' });
    animation.currentTime = 0;
    animations.push(animation);
  };

  const chrome = [
    document.querySelector('.site-header'),
    document.querySelector('.course-rail'),
    document.querySelector('.bgm'),
    ...document.querySelectorAll('main > *'),
  ].filter(element => element instanceof HTMLElement);
  chrome.forEach(element => rise(element));

  const mascot = document.querySelector('.live2d-mascot');
  if (mascot instanceof HTMLElement) rise(mascot, { opacityOnly: true });

  return animations;
}

export async function playIntro(layer, runId) {
  const stage = activate(layer, 'intro', runId);
  if (!(stage instanceof HTMLElement)) return clearMotionLayer(layer, runId);
  document.documentElement.classList.add(INTRO_CLASS);

  const frame = brandFrame();
  const refs = makeBrandScene(stage, frame);
  const animations = playBrandTimeline(refs, frame.scale);
  const revealAnimations = playRevealTimeline(frame.scale);

  await wait(brandBeat.tail);
  if (!isCurrent(layer, runId)) return;

  // Drop the guard first (so the page's own styles apply), then the animations.
  // In this order there is no frame where the content is governed by neither.
  endIntroSession(layer, runId);
  revealAnimations.forEach(animation => animation.cancel());
}

function connect(stage, from, to, className = 'motion-link') {
  const x = from.left + from.width / 2;
  const y = from.top + from.height / 2;
  const tx = to.left + to.width / 2;
  const ty = to.top + to.height / 2;
  const dx = tx - x;
  const dy = ty - y;
  const line = make(stage, className);
  Object.assign(line.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${Math.hypot(dx, dy)}px`,
    transform: `rotate(${Math.atan2(dy, dx)}rad) scaleX(0)`,
  });
  return { line, angle: Math.atan2(dy, dx) };
}

function addHardVeil(stage, delay) {
  const veil = make(stage, 'motion-veil');
  tween(veil, [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: .78 },
    { opacity: 1, offset: .79 },
    { opacity: 1, offset: 1 },
  ], { duration: delay, easing: 'linear' });
  return veil;
}

function sectionOrigin(intent) {
  return intent.sourceRect ?? { left: innerWidth / 2 - 18, top: 32, width: 36, height: 18 };
}

function nearestViewportRect(selector) {
  const viewportCenter = { x: innerWidth / 2, y: innerHeight / 2 };
  const candidates = [...document.querySelectorAll(selector)]
    .map(element => element.getBoundingClientRect())
    .filter(rect => rect.width > 1 && rect.height > 1)
    .map(rect => {
      const overlapWidth = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
      const overlapHeight = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
      const visibleArea = overlapWidth * overlapHeight;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return {
        rect,
        visibleArea,
        distance: Math.hypot(centerX - viewportCenter.x, centerY - viewportCenter.y),
      };
    });
  candidates.sort((left, right) => right.visibleArea - left.visibleArea || left.distance - right.distance);
  return candidates[0]?.rect ?? null;
}

function sectionAnchorRects(page) {
  const selectors = page === 'projects'
    ? [
      '[data-motion-page-link="projects"]',
      '.project-context span',
      '.project-context small',
      '.project-visual',
      '.project-copy .eyebrow',
      '.project-copy .text-link',
    ]
    : page === 'about'
      ? [
        '[data-motion-page-link="about"]',
        '.about-intro header span',
        '.about-intro h1',
        '.about-mark i:nth-child(1)',
        '.about-mark i:nth-child(2)',
        '.about-mark i:nth-child(3)',
      ]
      : [
        '[data-motion-page-link="courses"]',
        '.discipline-heading span',
        '.discipline-heading h2',
        '.course-cover',
        '.course-meta .course-number',
        '.course-meta .text-link',
      ];
  const sizes = [6, 9, 13, 22, 8, 11];
  return selectors.map((selector, index) => {
    const rect = nearestViewportRect(selector);
    const size = sizes[index];
    if (!rect) {
      return {
        left: 42 + index * 28,
        top: 42 + (index % 2) * 26,
        width: size,
        height: size,
      };
    }
    const xFactor = index === 3 ? .1 : index % 2 ? .18 : .72;
    const yFactor = index === 3 ? .14 : index % 3 === 0 ? .6 : .28;
    const left = rect.left + Math.max(0, rect.width - size) * xFactor;
    const top = rect.top + Math.max(0, rect.height - size) * yFactor;
    return {
      left: Math.min(Math.max(12, left), Math.max(12, innerWidth - size - 12)),
      top: Math.min(Math.max(12, top), Math.max(12, innerHeight - size - 12)),
      width: size,
      height: size,
    };
  });
}

function flightClusterRects(direction) {
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  return [
    [-210, -48, 15], [-158, 54, 8], [-92, -72, 11],
    [4, 68, 7], [96, -52, 13], [186, 38, 9],
  ].map(([x, y, size]) => ({
    left: cx + x * direction,
    top: cy + y,
    width: size,
    height: size,
  }));
}

function createBirdFlight(stage, direction) {
  const width = Math.min(620, Math.max(390, innerWidth * .48));
  const height = width * .28;
  const flight = make(stage, 'motion-bird-flight');
  const content = make(flight, `motion-bird-content${direction > 0 ? ' is-rightbound' : ''}`);
  // The leader carries the brand gradient (see .motion-bird-leader in
  // site-motion.css) - the same block as the opening animation.
  make(content, 'motion-bird-leader motion-inked');
  const image = make(content, 'motion-bird-image', 'img');
  image.src = MOTION_ASSETS.birdFlight;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  const startLeft = direction > 0 ? -width - 40 : innerWidth + 40;
  const middleLeft = innerWidth / 2 - width / 2;
  setRect(flight, { left: startLeft, top: innerHeight / 2 - height / 2, width, height });
  return {
    flight,
    start: { left: startLeft, top: innerHeight / 2 - height / 2, width, height },
    middle: { left: middleLeft, top: innerHeight / 2 - height / 2, width, height },
    end: {
      left: direction > 0 ? innerWidth + 40 : -width - 40,
      top: innerHeight / 2 - height / 2 - 8,
      width,
      height,
    },
  };
}

// ---------------------------------------------------------------------------
// The bird's speed profile.
//
// Same check-mark model as the opening titles (see playBrandTimeline):
//   approach  v(tau) = vMin + (vPeak - vMin) * (1 - tau)^e1     tau = t / d1
//   exit      v(tau) = vMin + (vEnd  - vMin) * tau^e2           tau = (t-d1) / d2
//
// The slowest instant (vMin) lands on the SCREEN CENTRE, which is exactly where
// the page swaps, so the bird never stops dead in the middle the way the old
// cubic-bezier version did (measured: its per-frame travel fell 173 -> 0).
//
// d2 is shorter than d1 on purpose. Dee's two legs were 1809.75px in and
// 3376.1px out, so its exit stayed faster even with a LONGER duration (0.65s vs
// 0.50s). The bird's two legs are equal (1070px each at 1440 viewport), so the
// exit needs a shorter duration to keep the same lead: with d2 = 0.65s the exit
// ends up 0.65x the entry peak, i.e. an inverted check-mark.
// ---------------------------------------------------------------------------
const birdBeat = Object.freeze({
  d1: 0.50,   // approach, seconds (before timeScale)
  e1: 3.5,
  d2: 0.35,   // exit, seconds (before timeScale)
  e2: 3.0,
  r: 0.05,    // vMin / vPeak - the slowest instant is 5% of the peak
  // Duration multiplier for BOTH legs. The curve's shape depends only on
  // e1/e2/r and the d1:d2 ratio, so scaling both together makes the whole
  // flight proportionally faster while keeping the trend identical (every
  // speed scales by 1/timeScale). < 1 = faster.
  timeScale: 0.7,
  samples: 24,
});

const birdEntryMeanFactor = (e1, r) => 1 + (1 / r - 1) / (e1 + 1);

/**
 * Sample the two legs into offsets (px from the leg's start) so the motion can
 * be handed to element.animate() as keyframes. Positions are integrated from the
 * speed curve rather than approximated by an easing, so what the tool previews
 * is what ships.
 */
function birdLegs(L1, L2) {
  const { e1, e2, r, samples, timeScale } = birdBeat;
  const d1 = birdBeat.d1 * timeScale;
  const d2 = birdBeat.d2 * timeScale;
  const vMin = L1 / (d1 * birdEntryMeanFactor(e1, r));
  const vPeak = vMin / r;
  const vEnd = vMin + (L2 / d2 - vMin) * (e2 + 1);
  const velocityAt = t => (t <= d1
    ? vMin + (vPeak - vMin) * Math.pow(1 - t / d1, e1)
    : vMin + (vEnd - vMin) * Math.pow((t - d1) / d2, e2));

  const N = 2000;
  const tEnd = d1 + d2;
  const cum = new Float64Array(N + 1);
  let x = 0;
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * tEnd;
    x += velocityAt(t) * (tEnd / N);
    cum[i] = x;
  }
  const posAt = (t) => {
    const f = Math.max(0, Math.min(N, (t / tEnd) * N));
    const i = Math.floor(f), frac = f - i;
    return cum[i] + (cum[Math.min(N, i + 1)] - cum[i]) * frac;
  };

  const approach = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * d1;
    approach.push({ t, dx: posAt(t) });
  }
  const exit = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * d2;
    exit.push({ t, dx: posAt(d1 + t) - L1 });
  }
  return { vPeak, vMin, vEnd, approach, exit, d1, d2, L1, L2 };
}

/** keyframes moving an element from `from` to `to`, following one sampled leg */
function legKeyframes(from, to, leg, durationS) {
  const frames = leg.map((s) => ({
    left: `${from.left + s.dx}px`,
    top: `${from.top + (to.top - from.top) * (s.t / durationS)}px`,
    offset: s.t / durationS,
    easing: 'linear',
  }));
  const last = frames[frames.length - 1];
  last.left = `${to.left}px`;
  last.top = `${to.top}px`;
  return frames;
}

export async function playSectionExit(layer, intent, runId) {
  const stage = activate(layer, 'section-exit', runId);
  if (!(stage instanceof HTMLElement)) return clearMotionLayer(layer, runId);
  addHardVeil(stage, intent.crossSection ? 190 : 150);

  if (!intent.crossSection) {
    const token = make(stage, 'motion-return-token motion-inked');
    token.style.backgroundColor = colors[1];
    setRect(token, sectionOrigin(intent));
    await morphRect(token, {
      left: innerWidth / 2 - 18,
      top: innerHeight / 2 - 18,
      width: 36,
      height: 36,
    }, { duration: 210, easing: enterEase });
    if (!isCurrent(layer, runId)) return;
    layer.classList.add('is-opaque');
    return;
  }

  const direction = intent.travelDirection || 1;
  const sourceRects = sectionAnchorRects(intent.currentPage);
  const clusterRects = flightClusterRects(direction);
  const fragments = sourceRects.map((rect, index) => {
    const fragment = make(stage, `motion-flight-fragment tone-${index % colors.length}`);
    fragment.style.backgroundColor = colors[index % colors.length];
    setRect(fragment, rect);
    return fragment;
  });
  const flight = createBirdFlight(stage, direction);
  // The two legs are equal here (both ends sit the same distance off-screen), so
  // the exit needs its own faster profile - see birdBeat.
  const L1 = flight.middle.left - flight.start.left;
  const L2 = flight.end.left - flight.middle.left;
  const legs = birdLegs(L1, L2);
  await Promise.all([
    tween(flight.flight, legKeyframes(flight.start, flight.middle, legs.approach, legs.d1), {
      duration: legs.d1 * 1000,
      easing: 'linear',
    }),
    ...fragments.map((fragment, index) => morphRect(fragment, clusterRects[index], {
      duration: 300,
      delay: 20 + index * 18,
      easing: enterEase,
    })),
  ]);
  if (!isCurrent(layer, runId)) return;
  layer.classList.add('is-opaque');
  stage.dataset.flightEnd = JSON.stringify(flight.end);
  // Carry the exact leg distances into the enter phase. Recomputing them from
  // the viewport there would be a second source of truth, and any difference
  // would show up as a velocity jump at the hand-off.
  stage.dataset.flightLegs = JSON.stringify({ L1, L2 });
}

export async function playSectionEnter(layer, intent, runId) {
  const stage = getRunStage(layer, runId);
  if (!(stage instanceof HTMLElement)) return clearMotionLayer(layer, runId);
  layer.dataset.motionState = 'section-enter';

  const returnToken = stage.querySelector('.motion-return-token');
  if (returnToken instanceof HTMLElement) {
    const nav = document.querySelector(`[data-motion-page-link="${intent.targetPage}"]`)?.getBoundingClientRect();
    const target = nav
      ? { left: nav.left + nav.width / 2 - 3, top: nav.bottom - 5, width: 6, height: 6 }
      : { left: innerWidth / 2, top: 34, width: 6, height: 6 };
    await Promise.all([
      morphRect(returnToken, target, { duration: 190, easing: exitEase }),
      tween(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 90, delay: 120, easing: 'linear' }),
    ]);
    clearMotionLayer(layer, runId);
    return;
  }

  const flight = stage.querySelector('.motion-bird-flight');
  const fragments = [...stage.querySelectorAll('.motion-flight-fragment')];
  if (!(flight instanceof HTMLElement) || fragments.length === 0) {
    clearMotionLayer(layer, runId);
    return;
  }
  const end = JSON.parse(stage.dataset.flightEnd || '{}');
  const legData = JSON.parse(stage.dataset.flightLegs || '{}');
  const landings = sectionAnchorRects(intent.targetPage);
  // The exit leg continues the SAME curve the approach ended on: both come from
  // birdLegs with the same L1, so vMin - the speed at the hand-off - is
  // identical, and the bird does not visibly hitch while the page loads.
  const legs = birdLegs(legData.L1 ?? 0, legData.L2 ?? 0);
  await Promise.all([
    tween(flight, legKeyframes({
      left: flight.getBoundingClientRect().left,
      top: flight.getBoundingClientRect().top,
    }, end, legs.exit, legs.d2), { duration: legs.d2 * 1000, easing: 'linear' }),
    ...fragments.map((fragment, index) => morphRect(fragment, landings[index % landings.length], {
      duration: 330,
      delay: 24 + index * 17,
      easing: shiftEase,
    })),
    tween(layer, [{ opacity: 1 }, { opacity: 1, offset: .72 }, { opacity: 0 }], {
      duration: 390,
      easing: 'linear',
    }),
  ]);
  if (!isCurrent(layer, runId)) return;
  clearMotionLayer(layer, runId);
}

function createCourseCoverClone(stage, intent) {
  const clone = make(stage, 'motion-course-cover motion-inked');
  setRect(clone, intent.sourceRect);
  clone.style.backgroundColor = 'var(--paper)';
  if (intent.imageSrc) {
    clone.style.backgroundImage = `url("${intent.imageSrc.replaceAll('"', '%22')}")`;
  }
  return clone;
}

function courseHoldRect(source) {
  const ratio = Math.max(.8, source.width / source.height);
  let width = Math.min(620, Math.max(360, source.width * .82), innerWidth * .56);
  let height = width / ratio;
  if (height > innerHeight * .62) {
    height = innerHeight * .62;
    width = height * ratio;
  }
  return {
    left: innerWidth / 2 - width / 2,
    top: innerHeight / 2 - height / 2,
    width,
    height,
  };
}

function courseGuideTargets(rect) {
  return [
    { left: rect.left - 22, top: rect.top + rect.height * .22, width: 9, height: 9 },
    { left: rect.left + rect.width + 13, top: rect.top + rect.height * .58, width: 13, height: 13 },
    { left: rect.left + rect.width * .72, top: rect.top + rect.height + 14, width: 7, height: 7 },
  ];
}

export async function playCourseExit(layer, intent, runId) {
  const stage = activate(layer, 'course-exit', runId);
  if (!(stage instanceof HTMLElement)) return clearMotionLayer(layer, runId);
  addHardVeil(stage, 210);
  const clone = createCourseCoverClone(stage, intent);
  const hold = courseHoldRect(intent.sourceRect);
  const guideStarts = [
    { left: intent.sourceRect.left + 12, top: intent.sourceRect.top + 12, width: 7, height: 7 },
    { left: intent.sourceRect.left + intent.sourceRect.width - 18, top: intent.sourceRect.top + 20, width: 11, height: 11 },
    { left: intent.sourceRect.left + intent.sourceRect.width * .58, top: intent.sourceRect.top + intent.sourceRect.height - 16, width: 6, height: 6 },
  ];
  const guideTargets = courseGuideTargets(hold);
  const guides = guideStarts.map((rect, index) => {
    const guide = make(stage, `motion-course-guide tone-${index}`);
    guide.style.backgroundColor = colors[index];
    setRect(guide, rect);
    return guide;
  });
  await Promise.all([
    morphRect(clone, hold, { duration: courseTiming.exitCover, easing: enterEase }),
    ...guides.map((guide, index) => morphRect(guide, guideTargets[index], {
      duration: courseTiming.exitGuide,
      delay: courseTiming.exitGuideDelay + index * courseTiming.exitGuideStagger,
      easing: enterEase,
    })),
  ]);
  if (!isCurrent(layer, runId)) return;
  layer.classList.add('is-opaque');
}

export async function playCourseEnter(layer, _intent, runId) {
  const stage = getRunStage(layer, runId);
  const target = document.querySelector('[data-motion-target="course-detail"]');
  const clone = stage?.querySelector('.motion-course-cover');
  if (!(stage instanceof HTMLElement) || !(target instanceof HTMLElement) || !(clone instanceof HTMLElement)) {
    return playSectionEnter(layer, { targetPage: 'courses' }, runId);
  }
  layer.dataset.motionState = 'course-enter';
  const rect = target.getBoundingClientRect();
  const guides = [...stage.querySelectorAll('.motion-course-guide')];
  const detailAnchors = [
    document.querySelector('.detail-rail nav a.active')?.getBoundingClientRect(),
    document.querySelector('.hero-copy .eyebrow')?.getBoundingClientRect(),
    rect,
  ].map((anchor, index) => {
    if (!anchor) return courseGuideTargets(rect)[index];
    const size = [7, 10, 6][index];
    return {
      left: anchor.left + Math.min(18, anchor.width * .18),
      top: anchor.top + Math.min(16, anchor.height * .3),
      width: size,
      height: size,
    };
  });
  await Promise.all([
    morphRect(clone, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, {
      duration: courseTiming.enterCover,
      easing: shiftEase,
    }),
    ...guides.map((guide, index) => morphRect(guide, detailAnchors[index], {
      duration: courseTiming.enterGuide,
      delay: courseTiming.enterGuideDelay + index * courseTiming.enterGuideStagger,
      easing: shiftEase,
    })),
    tween(layer, [{ opacity: 1 }, { opacity: 1, offset: .74 }, { opacity: 0 }], {
      duration: courseTiming.enterFade,
      easing: 'linear',
    }),
  ]);
  if (!isCurrent(layer, runId)) return;
  const line = make(stage, 'motion-course-baseline');
  setRect(line, { left: rect.left, top: rect.bottom - 2, width: rect.width, height: 2 });
  await tween(line, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
    duration: courseTiming.baseline,
    easing: 'steps(4,end)',
  });
  clearMotionLayer(layer, runId);
}

function projectNetwork(stage, center) {
  const offsets = [[-142, -62], [-78, -118], [18, -96], [132, -52], [-126, 66], [-20, 110], [104, 72]];
  return offsets.map(([dx, dy], index) => {
    const size = 9 + index % 3 * 5;
    const nodeRect = { left: center.x + dx, top: center.y + dy, width: size, height: size };
    const node = make(stage, 'motion-project-node');
    node.style.backgroundColor = colors[index % colors.length];
    setRect(node, { left: center.x, top: center.y, width: 3, height: 3 });
    const connection = connect(stage, { left: center.x, top: center.y, width: 1, height: 1 }, nodeRect, 'motion-project-link');
    return { node, nodeRect, ...connection };
  });
}

export async function playProjectExit(layer, intent, runId) {
  const stage = activate(layer, 'project-exit', runId);
  if (!(stage instanceof HTMLElement)) return clearMotionLayer(layer, runId);
  addHardVeil(stage, 340);
  const clone = make(stage, 'motion-project-clone motion-inked');
  setRect(clone, intent.sourceRect);
  if (intent.imageSrc) clone.style.backgroundImage = `url("${intent.imageSrc.replaceAll('"', '%22')}")`;
  const compact = { left: innerWidth / 2 - 152, top: innerHeight / 2 - 88, width: 304, height: 176 };
  const network = projectNetwork(stage, { x: innerWidth / 2, y: innerHeight / 2 });
  await Promise.all([
    moveTo(clone, compact, { duration: projectTiming.exitClone, easing: enterEase }),
    ...network.map(({ node, nodeRect }, index) => moveTo(node, nodeRect, {
      duration: projectTiming.exitNode,
      delay: projectTiming.exitNodeDelay + index * projectTiming.exitNodeStagger,
      easing: enterEase,
    })),
    ...network.map(({ line, angle }, index) => tween(line, [
      { transform: `rotate(${angle}rad) scaleX(0)` },
      { transform: `rotate(${angle}rad) scaleX(1)` },
    ], {
      duration: projectTiming.exitLink,
      delay: projectTiming.exitLinkDelay + index * projectTiming.exitLinkStagger,
      easing: enterEase,
    })),
  ]);
  if (!isCurrent(layer, runId)) return;
  layer.classList.add('is-opaque');
}

export async function playProjectEnter(layer, _intent, runId) {
  const stage = getRunStage(layer, runId);
  const target = document.querySelector('[data-motion-target="project-detail"]');
  const clone = stage?.querySelector('.motion-project-clone');
  if (!(stage instanceof HTMLElement) || !(target instanceof HTMLElement) || !(clone instanceof HTMLElement)) {
    return playSectionEnter(layer, { targetPage: 'projects' }, runId);
  }
  layer.dataset.motionState = 'project-enter';
  const cloneRect = clone.getBoundingClientRect();
  const center = { left: cloneRect.left + cloneRect.width / 2, top: cloneRect.top + cloneRect.height / 2, width: 2, height: 2 };
  const nodes = [...stage.querySelectorAll('.motion-project-node')];
  const links = [...stage.querySelectorAll('.motion-project-link')];
  await Promise.all([
    ...nodes.map((node, index) => moveTo(node, center, {
      duration: projectTiming.collapseNode,
      delay: index * projectTiming.collapseStagger,
      easing: exitEase,
    })),
    ...links.map((line, index) => tween(line, [
      { opacity: 1 },
      { opacity: 0, transform: `${line.style.transform} scaleX(0)` },
    ], {
      duration: projectTiming.collapseLink,
      delay: index * projectTiming.collapseStagger,
      easing: exitEase,
    })),
  ]);
  if (!isCurrent(layer, runId)) return;
  const rect = target.getBoundingClientRect();
  await Promise.all([
    moveTo(clone, { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, {
      duration: projectTiming.enterClone,
      easing: enterEase,
    }),
    tween(layer, [{ opacity: 1 }, { opacity: 0 }], {
      duration: projectTiming.enterFade,
      delay: projectTiming.enterFadeDelay,
      easing: 'linear',
    }),
  ]);
  clearMotionLayer(layer, runId);
}
