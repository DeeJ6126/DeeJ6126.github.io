import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  INTRO_STORAGE_KEY,
  MOTION_ASSETS,
  MOTION_DURATIONS,
  classifyMotionIntent,
  shouldPlayIntro,
} from '../src/scripts/motion-timelines.mjs';

const courseCoverCss = readFileSync(new URL('../src/styles/course-cover.css', import.meta.url), 'utf8');
const motionCss = readFileSync(new URL('../src/styles/site-motion.css', import.meta.url), 'utf8');

test('classifyMotionIntent honors explicit course and project detail intents', () => {
  assert.equal(classifyMotionIntent({ explicit: 'course-detail' }), 'course-detail');
  assert.equal(classifyMotionIntent({ explicit: 'project-detail' }), 'project-detail');
});

test('classifyMotionIntent uses the standard section transition for navigation and history', () => {
  assert.equal(classifyMotionIntent({ explicit: 'section' }), 'section');
  assert.equal(classifyMotionIntent({ direction: 'back' }), 'section');
  assert.equal(classifyMotionIntent({ direction: 'forward' }), 'section');
  assert.equal(classifyMotionIntent({}), 'section');
});

test('shouldPlayIntro only allows the first motion-enabled page load in a tab', () => {
  assert.equal(shouldPlayIntro({ seen: false, reduceMotion: false }), true);
  assert.equal(shouldPlayIntro({ seen: true, reduceMotion: false }), false);
  assert.equal(shouldPlayIntro({ seen: false, reduceMotion: true }), false);
  assert.equal(INTRO_STORAGE_KEY, 'dee:motion-intro-seen');
});

test('motion durations stay inside the approved timing budget', () => {
  // The intro budget moved from 2.6s to 3.4s when the opening became the full
  // brand intro (wireframe + two titles + square dissolve + two-phase reveal).
  assert.ok(MOTION_DURATIONS.intro >= 3000 && MOTION_DURATIONS.intro <= 3600);
  assert.ok(MOTION_DURATIONS.section >= 700 && MOTION_DURATIONS.section <= 850);
  assert.ok(MOTION_DURATIONS.courseDetail >= 680 && MOTION_DURATIONS.courseDetail <= 820);
  assert.ok(MOTION_DURATIONS.projectDetail >= 820 && MOTION_DURATIONS.projectDetail <= 960);
});

test('intro is the brand sequence that dissolves into the page', () => {
  const timelines = readFileSync(new URL('../src/scripts/motion-timelines.mjs', import.meta.url), 'utf8');
  assert.match(motionCss, /html\.is-intro-playing/);
  assert.match(motionCss, /\.motion-brand-square/);
  assert.match(motionCss, /\.motion-brand-wire/);
  assert.match(motionCss, /\.motion-brand-word/);
  assert.match(timelines, /INTRO_CLASS = 'is-intro-playing'/);
  assert.match(timelines, /function brandFrame\(\)/);
  assert.match(timelines, /function playRevealTimeline/);
  assert.match(timelines, /WORD_FRAMES/);
  // the page reveal is JS-driven on the same clock; no CSS animation delays
  assert.doesNotMatch(motionCss, /html\.is-intro-playing main > \*:nth-child\(1\)/);
  assert.doesNotMatch(timelines, /hardPaperCut/);
  assert.doesNotMatch(timelines, /#05070c/);
  assert.doesNotMatch(motionCss, /motion-intro-frame/);
  assert.doesNotMatch(motionCss, /#05070c/);
});

test('intro guard is applied before first paint with a fallback release', () => {
  const layout = readFileSync(new URL('../src/layouts/SiteLayout.astro', import.meta.url), 'utf8');
  assert.match(layout, /<script is:inline>/);
  assert.match(layout, /is-intro-playing/);
  assert.match(layout, /__deeMotionIntroDone/);
  const timelines = readFileSync(new URL('../src/scripts/motion-timelines.mjs', import.meta.url), 'utf8');
  assert.match(timelines, /__deeMotionIntroDone = true/);
});

test('web whale keeps the persistent motion shell and confines input to its own controls', () => {
  const mascot = readFileSync(new URL('../src/scripts/live2d-mascot.js', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../src/components/Live2DMascot.astro', import.meta.url), 'utf8');
  const mascotCss = readFileSync(new URL('../src/styles/live2d-mascot.css', import.meta.url), 'utf8');
  assert.match(component, /transition:persist="live2d-mascot"/);
  assert.match(component, /class="live2d-mascot"/);
  assert.match(mascot, /hit\.addEventListener\('pointerdown'/);
  assert.doesNotMatch(mascot, /window\.addEventListener\('pointerdown'/);
  assert.match(mascot, /setPointerCapture/);
  assert.match(mascot, /event\.preventDefault\(\)/);
  assert.match(mascot, /mascot-dragging/);
  assert.match(mascotCss, /user-select: none/);
  assert.match(mascot, /visibilitychange/);
  assert.match(mascot, /astro:page-load/);
  assert.doesNotMatch(mascot, /getUserMedia|SpeechRecognition|apiKey|electron|LIBRARY_SCRIPTS/);
});

test('section motion uses the repository-owned bird flight asset', () => {
  assert.equal(MOTION_ASSETS.birdFlight, '/img/motion/bird-flight.png');
});

test('course covers preserve full artwork on the paper background', () => {
  assert.match(courseCoverCss, /background:\s*var\(--paper\)/);
  assert.match(courseCoverCss, /object-fit:\s*contain/);
  assert.match(motionCss, /\.motion-course-cover\s*\{[^}]*background-color:\s*var\(--paper\)[^}]*background-size:\s*contain/s);
});
