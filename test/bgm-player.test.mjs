import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Static invariants for the BGM player. The runtime behaviour was verified
// with Playwright against the dev server; these assertions exist so the two
// load-bearing decisions cannot be silently undone:
//
//   1. The <audio> node must be created outside the ClientRouter's swap
//      area (in <head>, via the inline bootstrap script). A declarative
//      <audio> in the body gets re-created from every incoming document —
//      verified: element identity changed and currentTime rewound.
//   2. The ClientRouter replaces the whole <head>, which detaches that
//      element. A detached media element keeps playing but is unreachable
//      through the document, so astro:page-load must re-attach it.

const layout = readFileSync(new URL('../src/layouts/SiteLayout.astro', import.meta.url), 'utf8');
// Strip HTML comments so prose that mentions the audio tag cannot trip the
// markup assertions below.
const layoutMarkup = layout.replace(/<!--[\s\S]*?-->/g, '');
const bgm = readFileSync(new URL('../src/scripts/bgm.js', import.meta.url), 'utf8');
const player = readFileSync(new URL('../src/components/MusicPlayer.astro', import.meta.url), 'utf8');
const bgmCss = readFileSync(new URL('../src/styles/bgm.css', import.meta.url), 'utf8');

test('bgm audio is bootstrapped in <head> and never declared in the swapped body', () => {
  assert.match(layout, /window\[key\] = audio/);
  assert.match(layout, /document\.head\.appendChild\(audio\)/);
  assert.match(layout, /audio\.preload = 'metadata'/);
  // No declarative audio tag may live in the body/layout markup. The
  // bootstrap script creates it with createElement, so a real opening tag
  // here means someone went back to the markup approach. Match only an
  // actual tag (attributes or self-closing) so prose comments that merely
  // mention <audio> do not trip this.
  const audioTag = /<audio(?:\s+[a-zA-Z-]+\s*=|\s+\/?>)/;
  assert.doesNotMatch(layoutMarkup, audioTag);
  assert.doesNotMatch(player, audioTag);
});

test('bgm re-attaches the audio element on astro:page-load', () => {
  // The ClientRouter swaps <head>, detaching the node we created.
  assert.match(bgm, /document\.addEventListener\('astro:page-load'/);
  assert.match(bgm, /if \(!audio\.isConnected\) document\.head\.appendChild\(audio\)/);
  // Stray duplicates must be dropped so exactly one audio node survives.
  assert.match(bgm, /querySelectorAll\('audio\[data-bgm-audio\]'\)/);
});

test('bgm audio listeners are bound once per document, not per navigation', () => {
  assert.match(bgm, /const AUDIO_WIRED = '__bgmAudioWired'/);
  assert.match(bgm, /if \(!window\[AUDIO_WIRED\]\)/);
  // The once-bound handlers must read live nodes instead of closing over
  // the panel that happened to exist when they were attached.
  assert.match(bgm, /window\.__bgmUi = \{/);
  assert.match(bgm, /const ui = window\.__bgmUi \|\| \{\}/);
});

test('bgm never pauses on navigation', () => {
  assert.doesNotMatch(bgm, /astro:before-swap[\s\S]{0,200}?audio\.pause\(\)/);
  assert.doesNotMatch(bgm, /addEventListener\('astro:before-swap'/);
});

test('the queue plays in order and wraps back to the first song', () => {
  // Sequential queue: advancing by one from the last index must wrap.
  assert.match(bgm, /function select\(newIndex, autoplay = true\)/);
  assert.match(bgm, /const n = \(\(newIndex % list\.length\) \+ list\.length\) % list\.length/);
  assert.match(bgm, /audio\.addEventListener\('ended'/);
  // A single track restarts itself rather than going silent.
  assert.match(bgm, /list\.length === 1/);
  assert.match(bgm, /window\.__bgmSelect\(0, true\)/);
});

test('the queue and current index live on window, not in a closure', () => {
  // Regression: the panel's buttons are bound once, so a closure-captured
  // songs/index kept driving the player with the first page's queue after a
  // navigation, and the ended-handler (which used window.__bgmSelect) could
  // disagree with the buttons about which track was current.
  assert.match(bgm, /window\.__bgmSongs = songs/);
  assert.match(bgm, /window\.__bgmIndex = index/);
  assert.match(bgm, /const list = window\.__bgmSongs \|\| \[\]/);
  assert.match(bgm, /window\.__bgmIndex = n/);
  assert.match(bgm, /select\(\(window\.__bgmIndex \|\| 0\) [+-] 1\)/);
});

test('panel visibility is never left stuck at not-ready', () => {
  // Every path through init must end with the panel revealed, otherwise the
  // persisted data-bgm-ready="false" would hide the controls forever.
  const initBody = bgm.slice(bgm.indexOf('async function init()'), bgm.indexOf('function clampVolume'));
  const readyWrites = initBody.match(/panel\.dataset\.bgmReady = 'true'/g) || [];
  assert.ok(readyWrites.length >= 2, 'expected the empty-queue path and the normal path to both reveal the panel');
  assert.match(bgmCss, /\.bgm-panel\[data-bgm-ready="false"\]\s*\{\s*display:\s*none/);
});

test('the control panel stays hidden outside course pages', () => {
  // Deliberate product decision: the audio keeps playing on /projects and
  // /about, but there is no place for the controls there.
  assert.match(bgmCss, /body\[data-motion-page="projects"\] \.bgm-panel/);
  assert.match(bgmCss, /body\[data-motion-page="about"\] \.bgm-panel/);
});

test('panel positioning is declared inline so a ClientRouter swap cannot drop it', () => {
  // Regression: bgm.css imported by MusicPlayer's inline <script> is
  // page-scoped in dev, and the ClientRouter drops its <style> on
  // navigation. The panel then lost position:fixed and fell into the
  // document flow at the bottom of the page (live repro: y=7195 instead of
  // y=797 after visiting a course). The load-bearing rules therefore have
  // to live in an inline <style> in the layout, which every incoming
  // document carries.
  const inlineStyles = [...layout.matchAll(/<style is:inline>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  assert.match(inlineStyles, /\.bgm\s*\{[^}]*position:\s*fixed/);
  assert.match(inlineStyles, /\.bgm\s*\{[^}]*z-index:\s*80/);
  assert.match(inlineStyles, /body\[data-motion-page="courses"\]\s*\.bgm\s*\{[^}]*width:\s*210px/);
  // The stylesheet stays layout-imported as the single source for the rest
  // of the panel chrome.
  assert.match(layout, /import '\.\.\/styles\/bgm\.css'/);
  assert.doesNotMatch(player, /import '\.\.\/styles\/bgm\.css'/);
});

test('the play/pause glyph is driven by the element bgm.css actually matches', () => {
  // Regression: the flag used to be written to .bgm-panel while bgm.css
  // keys the glyph off .bgm[data-playing="true"], so the icon stayed on ▶
  // (and the button stayed blue) even while the status text said 正在播放.
  assert.match(bgmCss, /\.bgm\[data-playing="true"\]\s*\.btn-play-icon::before\s*\{\s*content:\s*"⏸"/);
  assert.match(bgmCss, /\.bgm:not\(\[data-playing="true"\]\)\s*\.btn-play-icon::before\s*\{\s*content:\s*"▶"/);
  assert.doesNotMatch(bgm, /panel\.dataset\.playing\s*=/);
  assert.match(bgm, /root\.dataset\.playing = isPlaying \? 'true' : 'false'/);
  // The root must be published for the once-bound handlers.
  assert.match(bgm, /root:\s*panel\.closest\('\.bgm'\)/);
});

test('seeking commits on release instead of on every drag frame', () => {
  // Continuous currentTime writes during a drag make the audio stutter.
  assert.match(bgm, /seek\.addEventListener\('change'/);
  const commit = bgm.slice(bgm.indexOf("seek.addEventListener('change'"));
  assert.match(commit, /audio\.currentTime = \(Number\(seek\.value\) \/ 1000\) \* audio\.duration/);
});

test('timeupdate keeps its hands off the seek slider while the user drags it', () => {
  // Regression: timeupdate wrote the playback position back to the slider
  // and the readout on every tick, so the thumb and the time bounced for
  // the whole drag and only settled on release.
  const timeupdate = bgm.slice(bgm.indexOf("audio.addEventListener('timeupdate'"));
  assert.match(timeupdate, /if \(scrubbing\) return/);
  assert.match(bgm, /function beginScrub\(\)/);
  assert.match(bgm, /function endScrub\(\)/);
  assert.match(bgm, /seek\.addEventListener\('pointerdown', beginScrub\)/);
  assert.match(bgm, /seek\.addEventListener\('change', \(\) => \{\s*\n\s*endScrub\(\)/);
  // A lost pointerup must not leave the slider permanently frozen.
  assert.match(bgm, /setTimeout\(\(\) => \{ scrubbing = false; \}, 4000\)/);
});

test('the stored playback position is tagged with its song', () => {
  // Regression, reported from a real listen: switching songs carried the old
  // position into the new one. bgm:time was a single bare number, so the
  // incoming track's loadedmetadata read the OUTGOING track's seconds and
  // seeked there whenever the value fitted the new duration (measured: song 2
  // started at 41.4s because song 1 had reached 40s). The id tag makes a
  // cross-song restore impossible while a reload of the same song still
  // resumes. Every write must go through persistTime, and the reader must
  // reject an untagged value rather than guess whose it is.
  assert.match(bgm, /function persistTime\(audio\)/);
  assert.match(bgm, /localStorage\.setItem\(LS_TIME, `\$\{song\.id\}:\$\{audio\.currentTime \|\| 0\}`\)/);
  assert.match(bgm, /function storedTimeFor\(songId\)/);
  assert.match(bgm, /if \(raw\.slice\(0, sep\) !== songId\) return 0/);
  // No bare-number writer may survive anywhere in the file.
  assert.doesNotMatch(bgm, /setItem\(LS_TIME, String\(/);
  assert.doesNotMatch(bgm, /setItem\(LS_TIME, audio\.currentTime\)/);
  // The restore must be gated on the song that is actually loaded.
  assert.match(bgm, /const savedT = song \? storedTimeFor\(song\.id\) : 0/);
});
