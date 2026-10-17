import { normalizePreferences, stageBounds, bubblePosition, canAnimate, normalizeScale, DEFAULT_SCALE } from '../lib/whale-pet-policy.mjs';

const STORAGE_KEY = 'dee:whale-pet';
const ASSET_BASE = '/img/whale-pet/';
const DESKTOP_QUERY = '(min-width: 920px)';
const FRAME_MS = 1000 / 30;
const SINGING_SONG_ID = 'Let_Me_Go';
const FOLD_TIMING = { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)' };
const BADGE_FRAMES = [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }];
function setToggleMode(toggle, mode) {
  const collapsed = mode === 'hidden';
  toggle.querySelector('[data-mascot-toggle-label]').textContent = collapsed ? '' : mode === 'error' ? '重试桌宠' : '互动';
  toggle.querySelector('[data-mascot-toggle-icon]').hidden = !collapsed;
  toggle.classList.toggle('is-collapsed', collapsed);
  toggle.setAttribute('aria-label', collapsed ? '展开鲸鱼娘' : mode === 'error' ? '重试桌宠' : '打开鲸鱼娘互动');
  toggle.title = collapsed ? '点击展开鲸鱼娘' : '';
}
const BUBBLE_LINES = ['今天也要加油哦~', '戳、戳什么啦！', '我在这里陪你。', '再摸摸头嘛。', '一起休息一下吧。'];

function readPreferences() {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
  catch { return normalizePreferences({}); }
}

async function initMascot(container, prefs, desktop, reduced, restoreFromBadge = false) {
  // Keep Electron, microphones, model services, chat and computer control out of the website.
  // Load only the browser rig and behaviour simulator, after the page has settled.
  const [{ createPet }, { createWhaleFigure }] = await Promise.all([
    import('./vendor/coopanion/kit/body.js'),
    import('./vendor/coopanion/whale/figure.js'),
  ]);
  const base = new URL(ASSET_BASE, location.origin);
  const figure = await createWhaleFigure(base, {
    scheme: prefs.scheme,
    closedMouth: () => (window.__bgmSongs || [])[window.__bgmIndex]?.id === SINGING_SONG_ID && !window.__bgmAudio?.paused && !window.__bgmAudio?.ended,
  });
  if (!container.isConnected) { figure.dispose(); throw new Error('Mascot container disconnected'); }
  const stage = container.querySelector('[data-mascot-stage]');
  stage.hidden = prefs.hidden;
  const hit = container.querySelector('[data-mascot-hit]');
  const bubble = container.querySelector('[data-mascot-bubble]');
  const toggle = container.querySelector('[data-mascot-toggle]');
  const menu = container.querySelector('[data-mascot-menu]');
  const status = container.querySelector('[data-mascot-status]');
  const roamInput = container.querySelector('[data-mascot-roam]');
  const expressionInput = container.querySelector('[data-mascot-expression]');
  const sizeInput = container.querySelector('[data-mascot-size]');
  const sizeLabel = container.querySelector('[data-mascot-size-label]');
  const singButton = container.querySelector('[data-mascot-sing]');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<ellipse class="whale-pet-shadow"/><g></g><g class="whale-pet-particles"></g>';
  stage.replaceChildren(svg);
  const [shadowEl, petG, fxG] = svg.children;
  let bounds, controller, navigating = false, pointerId = null, lastPointer = null;
  let frame = 0, lastTime = 0, bubbleUntil = 0, suppressClick = false;
  let refreshing = 0, navigationId = 0, navigationFallback = 0;
  let firstStroll = prefs.roam !== 'off';
  let collapsing = false, singing = false, collapseAnimation = null, recordAnimation = null, recordImage = null;
  let expanding = false, badgeAnimation = null;
  const singingNotes = new Set();
  let noteClock = 0, vocalizing = false;
  const introPlaying = () => document.documentElement.classList.contains('is-intro-playing') || document.documentElement.classList.contains('is-motion-running');
  const enabled = () => desktop.matches && !reduced.matches;
  const active = () => canAnimate({ hidden: prefs.hidden, documentHidden: document.hidden, introPlaying: introPlaying(), navigating, enabled: enabled() && !collapsing && !expanding });
  const persist = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* Storage may be unavailable. */ } };
  const say = (text) => { bubble.textContent = text; bubble.hidden = false; bubbleUntil = controller.time + 2.8; };

  function refreshBounds() {
    // Measure current DOM only on navigation/resize. The music controls have their own higher layer.
    let leftInset = 0;
    for (const el of document.querySelectorAll('.course-rail, .detail-rail, .bgm')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && getComputedStyle(el).display !== 'none' && r.left < 32 && r.right < innerWidth / 2) leftInset = Math.max(leftInset, r.right + 12);
    }
    const oldOrigin = bounds?.originX || 0;
    bounds = stageBounds(innerWidth, innerHeight, leftInset, prefs.scale);
    stage.style.left = `${bounds.originX}px`;
    if (controller) {
      // Retain screen position when entering/leaving a page with a left rail.
      controller.pet.x += oldOrigin - bounds.originX;
      controller.pet.target += oldOrigin - bounds.originX;
      controller.resize();
      controller.render();
      if (!menu.hidden) placeMenu();
    }
  }
  refreshBounds();
  controller = createPet({ petG, shadowEl, fxG }, {
    figure, bounds: () => bounds, startX: bounds.W - 172, roam: prefs.roam,
    clickHop: false, upwardThrowOnly: true, constrainDrag: true,
    sfx: { play() {} }, // Website BGM owns sound; footsteps never compete with it.
    dialogOpen: () => !menu.hidden,
    onEvent(kind, detail) {
      if (kind === 'touch') {
        if (detail.kind === 'poke') say(BUBBLE_LINES[Math.floor(Math.random() * 3)]);
        else if (detail.kind === 'pet') say(BUBBLE_LINES[3]);
        else if (detail.kind === 'grab') say('呜哇，被拎起来了！');
        else if (detail.kind === 'throw') say('飞起来啦——');
        else if (detail.kind === 'crash') say('晕乎乎……');
      }
    },
  });
  // The welcome wave is local animation only, with no background chat or network service.
  controller.act('wave');
  controller.holdRoam(3);
  controller.render();

  function updateUI() {
    const visible = enabled();
    container.hidden = !visible;
    stage.hidden = prefs.hidden;
    toggle.hidden = collapsing || (expanding && !prefs.hidden);
    hit.hidden = prefs.hidden || singing || !active();
    container.dataset.petState = prefs.hidden ? 'hidden' : 'ready';
    if (prefs.hidden) {
      setToggleMode(toggle, 'hidden');
      toggle.style.left = '';
      toggle.style.top = '';
      return;
    }
    setToggleMode(toggle, 'ready');
    const info = controller.layout();
    container.dataset.petMode = info.mode;
    hit.style.left = `${bounds.originX + info.box.x}px`;
    hit.style.top = `${info.box.y}px`;
    hit.style.width = `${Math.max(12, info.box.w)}px`;
    hit.style.height = `${Math.max(12, info.box.h)}px`;
    toggle.style.left = `${Math.max(bounds.originX + 8, Math.min(innerWidth - 68, bounds.originX + info.box.x + info.box.w - 10))}px`;
    toggle.style.top = `${Math.max(84, Math.min(innerHeight - 42, info.box.y + info.box.h * .48))}px`;
    if (!bubble.hidden) {
      if (controller.time >= bubbleUntil) bubble.hidden = true;
      else {
        const r = bubble.getBoundingClientRect();
        const spot = bubblePosition({ x: bounds.originX + info.bubble.x, y: info.box.y }, r.width, r.height, innerWidth, innerHeight);
        bubble.style.left = `${spot.left}px`;
        bubble.style.top = `${Math.max(78, spot.top)}px`;
      }
    }
  }

  function tick(now) {
    frame = 0;
    if (!active()) { lastTime = 0; updateUI(); return; }
    if (!lastTime || now - lastTime >= FRAME_MS - 1) {
      const dt = lastTime ? Math.min(.05, (now - lastTime) / 1000) : 1 / 30;
      lastTime = now;
      controller.step(dt);
      // Give first-time visitors a short hello and a visible first stroll before random idle choices.
      if (firstStroll && prefs.roam !== 'off' && menu.hidden && controller.time >= 2.6 && controller.pet.mode === 'idle') {
        controller.act('walk'); firstStroll = false;
      }
      controller.render();
      updateSingingNotes(dt);
      updateUI();
    }
    frame = requestAnimationFrame(tick);
  }
  function syncActivity() {
    if (!active()) {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      clearSingingNotes();
      endGesture(true);
      closeMenu(false);
      bubble.hidden = true;
    } else if (!frame) { lastTime = 0; frame = requestAnimationFrame(tick); }
    updateUI();
  }
  function closeMenu(restoreFocus = true) {
    const wasOpen = !menu.hidden;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (wasOpen && restoreFocus) toggle.focus({ preventScroll: true });
  }
  function placeMenu() {
    const box = controller.layout().box;
    const width = menu.getBoundingClientRect().width || 304;
    const leftOfPet = bounds.originX + box.x - width - 16;
    const nextToPet = leftOfPet >= bounds.originX + 8 ? leftOfPet : bounds.originX + box.x + box.w + 16;
    menu.style.left = Math.max(bounds.originX + 8, Math.min(innerWidth - width - 12, nextToPet)) + 'px';
    menu.style.right = 'auto';
  }
  function openMenu() {
    if (!active() || singing) return;
    controller.stopWalk(controller.pet.walkId);
    controller.holdRoam(1);
    menu.hidden = false;
    placeMenu();
    toggle.setAttribute('aria-expanded', 'true');
    menu.querySelector('button').focus({ preventScroll: true });
    bubble.hidden = true;
  }
  function point(event) {
    return { x: event.clientX - bounds.originX, y: event.clientY, t: performance.now() };
  }
  function endGesture(cancelled = false, event) {
    if (pointerId === null) return;
    const id = pointerId;
    if (cancelled) {
      controller.dropAt(lastPointer || { x: controller.pet.x, y: controller.pet.fy });
      // Also clear a short press which never entered the drag mode.
      controller.pointerUp({ ...(lastPointer || { x: controller.pet.x, y: controller.pet.fy }), t: performance.now() + 1000 });
    } else controller.pointerUp(point(event));
    pointerId = null;
    if (hit.hasPointerCapture(id)) hit.releasePointerCapture(id);
    document.documentElement.classList.remove('mascot-dragging');
    // A cancelled pointer produces no click. A completed drag may produce one at the release target.
    suppressClick = !cancelled;
    if (suppressClick) setTimeout(() => { suppressClick = false; }, 0);
  }

  hit.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || !active() || !menu.hidden) return;
    const p = point(event);
    if (!controller.pointerDown(p)) return;
    event.preventDefault();
    pointerId = event.pointerId;
    lastPointer = p;
    hit.setPointerCapture(pointerId);
    document.documentElement.classList.add('mascot-dragging');
    window.getSelection()?.removeAllRanges();
  });
  window.addEventListener('pointermove', event => {
    if (!active() || (pointerId !== null && event.pointerId !== pointerId)) return;
    if (!menu.hidden || event.target.closest?.('.whale-pet-menu, .bgm, .site-header')) { if (pointerId === null) controller.pointerLeave(); return; }
    // Classify movement in raw viewport coordinates before applying carry bounds.
    lastPointer = point(event);
    controller.pointerMove(lastPointer);
  }, { passive: true });
  window.addEventListener('pointerup', event => { if (event.pointerId === pointerId) endGesture(false, event); });
  window.addEventListener('pointercancel', event => { if (event.pointerId === pointerId) endGesture(true); });
  hit.addEventListener('lostpointercapture', () => endGesture(true));
  window.addEventListener('blur', () => endGesture(true));
  document.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; return; }
    if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) closeMenu(false);
  }, true);
  hit.addEventListener('click', event => {
    // Keyboard activation opens the accessible controls, pointer activation pokes the pet.
    if (event.detail === 0) openMenu();
  });
  hit.addEventListener('contextmenu', event => { if (active()) { event.preventDefault(); openMenu(); } });
  hit.addEventListener('pointerleave', () => { if (pointerId === null) controller.pointerLeave(); });
  toggle.addEventListener('click', () => {
    if (expanding || collapsing) return;
    if (prefs.hidden) restorePet();
    else if (menu.hidden) openMenu();
    else closeMenu();
  });
  container.querySelector('[data-mascot-close]').addEventListener('click', () => closeMenu());
  function foldFrames() {
    const box = controller.layout().box;
    const centerX = box.x + box.w / 2, centerY = box.y + box.h / 2;
    const small = .08;
    const dx = innerWidth - 44 - bounds.originX - centerX * small;
    const dy = innerHeight - 44 - centerY * small;
    return [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + small + ')', opacity: 0 },
    ];
  }
  async function restorePet() {
    if (!prefs.hidden || expanding || collapsing) return;
    expanding = true; toggle.disabled = true; syncActivity();
    badgeAnimation?.cancel();
    try {
      badgeAnimation = toggle.animate(BADGE_FRAMES, { duration: 180, direction: 'reverse', fill: 'forwards' });
      await badgeAnimation.finished;
      prefs.hidden = false; persist(); syncActivity();
      controller.render();
      stage.style.transformOrigin = '0 0';
      collapseAnimation = stage.animate(foldFrames(), { ...FOLD_TIMING, direction: 'reverse' });
      await collapseAnimation.finished;
    } catch { /* A resize or navigation finishes the requested restoration immediately. */ }
    finally {
      collapseAnimation = null; badgeAnimation?.cancel(); badgeAnimation = null;
      expanding = false; prefs.hidden = false; persist();
      toggle.disabled = false; syncActivity(); controller.act('wave'); controller.holdRoam(3);
    }
  }
  container.querySelector('[data-mascot-hide]').addEventListener('click', async () => {
    if (collapsing || expanding || singing) return;
    endGesture(true);
    const frames = foldFrames();
    collapsing = true;
    syncActivity();
    stage.style.transformOrigin = '0 0';
    collapseAnimation = stage.animate(frames, FOLD_TIMING);
    try { await collapseAnimation.finished; } catch { /* A navigation completes hiding without the animation. */ }
    finally {
      collapseAnimation = null; collapsing = false;
      prefs.hidden = true; persist(); syncActivity();
      toggle.focus({ preventScroll: true });
      badgeAnimation = toggle.animate(BADGE_FRAMES, { duration: 180 });
    }
  });
  sizeInput.value = String(Math.round(prefs.scale * 100));
  sizeLabel.value = sizeInput.value + '%';
  sizeInput.addEventListener('input', () => {
    prefs.scale = normalizeScale(Number(sizeInput.value) / 100);
    sizeLabel.value = Math.round(prefs.scale * 100) + '%';
    sizeInput.setAttribute('aria-valuetext', sizeLabel.value + ' · ' + Math.round(prefs.scale * 300) + 'px');
    endGesture(true); refreshBounds(); updateUI(); persist();
  });

  function cancelEffects() {
    collapseAnimation?.cancel();
    badgeAnimation?.cancel();
    recordAnimation?.cancel();
    recordImage?.remove();
    clearSingingNotes();
  }
  function clearSingingNotes() {
    for (const note of singingNotes) { note.getAnimations().forEach(animation => animation.cancel()); note.parentElement?.remove(); }
    singingNotes.clear();
    noteClock = 0;
    if (vocalizing) { delete container.dataset.petSinging; vocalizing = false; }
  }
  function positionSingingNote(note, anchor, box) {
    const scale = prefs.scale / DEFAULT_SCALE;
    const wrapper = note.parentElement;
    wrapper.style.left = Math.round(bounds.originX + anchor.x + Number(note.dataset.offsetX) * scale) + 'px';
    wrapper.style.top = Math.round(Math.max(88, box.y - 26 * scale)) + 'px';
    wrapper.style.transform = 'scale(' + scale + ')';
  }
  function updateSingingNotes(dt) {
    const song = (window.__bgmSongs || [])[window.__bgmIndex];
    const audio = window.__bgmAudio;
    if (song?.id !== SINGING_SONG_ID || !audio || audio.paused || audio.ended || prefs.hidden) {
      if (vocalizing) clearSingingNotes();
      return;
    }
    if (!vocalizing) { container.dataset.petSinging = 'true'; vocalizing = true; }
    const anchor = controller.anchor(), box = controller.layout().box;
    for (const note of singingNotes) {
      positionSingingNote(note, anchor, box);
    }
    noteClock -= dt;
    if (noteClock > 0) return;
    noteClock = .3 + Math.random() * .2;
    const hues = [120, 104, 84, 56, 38, 25, 15, 0, 345, 326, 310, 288, 270, 248, 226, 200, 184, 168, 148];
    const hue = hues[Math.floor(Math.random() * hues.length)];
    const note = document.createElementNS(ns, 'svg');
    note.setAttribute('viewBox', '0 0 12 16');
    note.setAttribute('aria-hidden', 'true');
    note.setAttribute('shape-rendering', 'crispEdges');
    note.classList.add('whale-pet-music-note');
    note.innerHTML = '<path fill="hsl(' + hue + ' 85% 42%)" d="M6 1h2v2h2v2h2v3h-2V6H8v6H6v2H2v-2H1v-2h5z"/><path fill="hsl(' + hue + ' 85% 28%)" d="M1 12h5v2H2v-1H1z"/><path fill="hsl(' + hue + ' 85% 62%)" d="M6 1h2v2H6z"/>';
    const pixelScale = Math.random() < .5 ? 2 : 3;
    note.style.width = 12 * pixelScale + 'px'; note.style.height = 16 * pixelScale + 'px';
    note.dataset.offsetX = String(Math.round((Math.random() - .5) * 64 - 6 * pixelScale));
    const wrapper = document.createElement('div');
    wrapper.className = 'whale-pet-note-anchor';
    wrapper.appendChild(note); container.appendChild(wrapper); singingNotes.add(note);
    positionSingingNote(note, anchor, box);
    const drift = Math.round((Math.random() - .5) * 50), rise = 64 + Math.round(Math.random() * 32);
    const animation = note.animate([
      { transform: 'translate(0,0)', opacity: 0, offset: 0 },
      { transform: 'translate(' + Math.round(drift * .15) + 'px,-12px)', opacity: 1, offset: .15 },
      { transform: 'translate(' + drift + 'px,-' + rise + 'px)', opacity: 0, offset: 1 },
    ], { duration: 1400 + Math.random() * 500, easing: 'linear' });
    animation.onfinish = () => { singingNotes.delete(note); wrapper.remove(); };
  }
  async function throwRecord(panel) {
    const box = controller.layout().box, anchor = controller.anchor();
    const from = { x: bounds.originX + anchor.x, y: Math.max(110, box.y - 18) };
    const target = panel.querySelector('[data-bgm-play]').getBoundingClientRect();
    const to = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
    const control = { x: (from.x + to.x) / 2, y: Math.max(96, Math.min(from.y, to.y) - 220) };
    recordImage = new Image(); recordImage.src = '/img/whale-pet/singing-record.png'; recordImage.alt = ''; recordImage.className = 'whale-pet-record';
    container.appendChild(recordImage);
    const frames = [{ offset: 0, transform: 'translate(' + (from.x - 48) + 'px,' + (from.y - 48) + 'px) scale(.4) rotate(-20deg)', opacity: 0 }];
    for (let i = 0; i <= 48; i++) {
      const u = i / 48, offset = .12 + .88 * u;
      const x = (1-u)*(1-u)*from.x + 2*(1-u)*u*control.x + u*u*to.x;
      const y = (1-u)*(1-u)*(from.y-48) + 2*(1-u)*u*control.y + u*u*to.y;
      const scale = u < .85 ? 1 : 1 - (u - .85) / .15 * .8;
      frames.push({ offset, transform: 'translate(' + (x-48) + 'px,' + (y-48) + 'px) scale(' + scale + ') rotate(' + (u*480) + 'deg)', opacity: u > .95 ? (1-u)/.05 : 1 });
    }
    recordAnimation = recordImage.animate(frames, { duration: 1250, easing: 'linear' });
    await recordAnimation.finished;
  }
  singButton.addEventListener('click', async () => {
    if (singing || collapsing || !active()) return;
    if (controller.busy()) { status.textContent = '等我站稳了再唱。'; return; }
    if (!window.__bgmPlaySong || !(window.__bgmSongs || []).some(song => song.id === SINGING_SONG_ID)) {
      status.textContent = '歌曲还没准备好，再试一下。'; return;
    }
    singing = true; singButton.disabled = true;
    controller.stopWalk(controller.pet.walkId); controller.act('stand'); controller.act('wave'); controller.holdRoam(4);
    closeMenu(false);
    const panel = document.querySelector('[data-bgm-panel]');
    const panelRect = panel?.getBoundingClientRect();
    const hasPlayer = Boolean(panelRect?.width && panelRect.height && getComputedStyle(panel).visibility !== 'hidden');
    try {
      if (hasPlayer) await throwRecord(panel);
      if (navigating || document.hidden) return;
      await window.__bgmPlaySong(SINGING_SONG_ID, { restart: true });
      if (window.__bgmAudio?.paused) say('点一下播放器，就能听我唱啦。');
      else { controller.act('dance'); say('Let me go～'); }
      if (hasPlayer) panel.animate([{ boxShadow: 'inset 0 0 0 2px var(--blue)' }, { boxShadow: 'inset 0 0 0 0px transparent' }], { duration: 500 });
    } catch (error) {
      if (error.name !== 'AbortError') { console.warn('[mascot] Singing failed:', error); say('歌曲没加载好，再试一下吧。'); }
    } finally {
      recordImage?.remove(); recordImage = null; recordAnimation = null;
      singing = false; singButton.disabled = false; updateUI();
    }
  });
  roamInput.value = prefs.roam;
  roamInput.addEventListener('change', () => {
    prefs.roam = normalizePreferences({ ...prefs, roam: roamInput.value }).roam;
    firstStroll = false;
    controller.setRoam(prefs.roam);
    if (prefs.roam === 'off') controller.stopWalk(controller.pet.walkId);
    persist(); status.textContent = prefs.roam === 'off' ? '我就乖乖待在这里。' : '好呀，去溜达一会儿。';
  });
  function doWord(word) {
    const done = controller.doWord(word);
    status.textContent = done ? '' : '等我站稳了再试一下。';
    if (done) controller.holdRoam(4);
  }
  expressionInput.addEventListener('change', () => {
    if (controller.pet.mode === 'sleep' || controller.pet.mode === 'sit') controller.act('stand');
    doWord(expressionInput.value);
  });
  menu.addEventListener('click', event => {
    const button = event.target.closest('[data-mascot-action]');
    if (button) doWord(button.dataset.mascotAction);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); closeMenu(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelEffects(); syncActivity(); });
  desktop.addEventListener('change', syncActivity);
  reduced.addEventListener('change', syncActivity);
  document.addEventListener('astro:before-preparation', event => {
    const id = ++navigationId;
    navigating = true; cancelEffects(); syncActivity();
    clearTimeout(navigationFallback);
    const recover = () => {
      if (id !== navigationId) return;
      navigating = false; refreshBounds(); syncActivity();
    };
    event.signal?.addEventListener('abort', recover, { once: true });
    const loader = event.loader;
    if (loader) event.loader = async () => {
      try { await loader(); }
      catch (error) { recover(); throw error; }
    };
    // Loader failures leave the old page in place without emitting page-load.
    navigationFallback = setTimeout(recover, 5000);
  });
  document.addEventListener('astro:page-load', () => {
    ++navigationId; clearTimeout(navigationFallback);
    navigating = false; refreshBounds(); syncActivity();
  });
  window.addEventListener('resize', () => {
    cancelEffects(); endGesture(true);
    if (!refreshing) refreshing = requestAnimationFrame(() => { refreshing = 0; refreshBounds(); syncActivity(); });
  });
  new MutationObserver(syncActivity).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  // Useful for browser verification; no network/agent surface is exposed.
  const instance = { controller, figure, refreshBounds, get preferences() { return { ...prefs }; }, get originX() { return bounds.originX; }, get running() { return !!frame; } };
  toggle.disabled = false;
  syncActivity();
  if (restoreFromBadge) await restorePet();
  return instance;
}

function setup() {
  const container = document.querySelector('[data-live2d-mascot]');
  if (!container || window.__whaleMascot || window.__whaleMascotLoading) return;
  const desktop = matchMedia(DESKTOP_QUERY), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!desktop.matches || reduced.matches) {
    container.hidden = true;
    const retry = () => { if (desktop.matches && !reduced.matches) { desktop.removeEventListener('change', retry); reduced.removeEventListener('change', retry); setup(); } };
    desktop.addEventListener('change', retry); reduced.addEventListener('change', retry);
    return;
  }
  container.hidden = false;
  const prefs = readPreferences();
  const toggle = container.querySelector('[data-mascot-toggle]');
  if (prefs.hidden) {
    container.dataset.petState = 'hidden'; toggle.disabled = false; setToggleMode(toggle, 'hidden');
    toggle.onclick = () => { toggle.onclick = null; launch(true); };
    return;
  }
  launch();
  function launch(restoreFromBadge = false) {
    if (window.__whaleMascotLoading) return;
    if (!restoreFromBadge) prefs.hidden = false;
    toggle.disabled = true;
    window.__whaleMascotLoading = true;
    const schedule = window.requestIdleCallback || (cb => setTimeout(cb, 200));
    schedule(async () => {
      try { window.__whaleMascot = await initMascot(container, prefs, desktop, reduced, restoreFromBadge); }
      catch (error) {
        console.warn('[mascot] Whale failed to start:', error);
        container.dataset.petState = 'error'; setToggleMode(toggle, 'error'); toggle.disabled = false;
        toggle.onclick = () => { toggle.onclick = null; launch(); };
      } finally { window.__whaleMascotLoading = false; }
    }, { timeout: 1800 });
  }
}

if (document.readyState === 'complete') setup();
else window.addEventListener('load', setup, { once: true });
