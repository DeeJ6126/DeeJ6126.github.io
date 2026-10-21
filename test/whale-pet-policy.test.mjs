import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SCALE,
  PET_HEIGHT,
  normalizePreferences,
  stageBounds,
  bubblePosition,
  canAnimate,
} from '../src/lib/whale-pet-policy.mjs';

const defaults = { roam: 'free', scheme: 'deepseek', hidden: false, scale: DEFAULT_SCALE };

test('invalid persisted preferences return independent safe defaults', () => {
  for (const raw of [null, undefined, false, 42, 'bad JSON', [], { roam: 'fast', scheme: '../tex', hidden: 'true' }]) {
    assert.deepEqual(normalizePreferences(raw), defaults);
  }
  const first = normalizePreferences(null);
  first.roam = 'off';
  assert.deepEqual(normalizePreferences(null), defaults);
});

test('valid preferences survive while unrelated storage fields are discarded', () => {
  for (const scheme of ['deepseek', 'harness', 'chatgpt', 'claude', 'gemini', 'qwen', 'kimi', 'minimax']) {
    assert.deepEqual(normalizePreferences({ roam: 'calm', scheme, hidden: true, agentToken: 'ignored' }), {
      roam: 'calm', scheme: 'deepseek', hidden: true, scale: DEFAULT_SCALE,
    });
  }
  assert.deepEqual(normalizePreferences({ roam: 'off', hidden: false }), { ...defaults, roam: 'off' });
});

test('the default smaller character and stage offset reserve sidebar and music space', () => {
  assert.equal(DEFAULT_SCALE, 0.6);
  assert.equal(PET_HEIGHT, 180);
  assert.deepEqual(stageBounds(1920, 1080, 226), {
    W: 1694, H: 1080, floorY: 1078, S: 180 / 256, originX: 226,
  });
});

test('stage bounds limit the inset and keep a usable stage in narrow viewports', () => {
  assert.deepEqual(stageBounds(400, 600, 500), {
    W: 260, H: 600, floorY: 598, S: 180 / 256, originX: 140,
  });
  assert.deepEqual(stageBounds(200, 120, 226), {
    W: 260, H: 120, floorY: 118, S: 180 / 256, originX: 0,
  });
  assert.equal(stageBounds(800, 600, -10).originX, 0);
});

test('invalid viewport inputs never produce NaN or a negative floor', () => {
  for (const width of [NaN, Infinity, -10, undefined]) {
    assert.deepEqual(stageBounds(width, -2, Infinity), {
      W: 260, H: 0, floorY: 0, S: 180 / 256, originX: 0,
    });
  }
  assert.equal(stageBounds(800, 1).floorY, 0);
});

test('bubbles center above the character and accept a measured character rectangle', () => {
  assert.deepEqual(bubblePosition({ x: 400, y: 500 }, 200, 60, 800, 600), { left: 300, top: 428 });
  assert.deepEqual(bubblePosition({ left: 350, top: 500, width: 100, height: 80 }, 200, 60, 800, 600), {
    left: 300, top: 428,
  });
});

test('bubbles stay inside the viewport near either horizontal edge', () => {
  assert.deepEqual(bubblePosition({ x: 0, y: 590 }, 200, 60, 800, 600), { left: 8, top: 518 });
  assert.deepEqual(bubblePosition({ x: 900, y: 700 }, 200, 60, 800, 600), { left: 592, top: 532 });
});

test('bubbles move below a top-edge anchor and clamp when neither side fits', () => {
  assert.deepEqual(bubblePosition({ x: 400, y: 20 }, 200, 60, 800, 600), { left: 300, top: 32 });
  assert.deepEqual(bubblePosition({ left: 350, top: 20, width: 100, height: 80 }, 200, 60, 800, 600), {
    left: 300, top: 112,
  });
  assert.deepEqual(bubblePosition({ x: 20, y: 10 }, 200, 80, 100, 60), { left: 0, top: 0 });
  assert.deepEqual(bubblePosition(null, NaN, Infinity, NaN, -20), { left: 0, top: 0 });
});

test('animation pauses for page lifecycle blockers while menus keep idle motion alive', () => {
  assert.equal(canAnimate(), true);
  assert.equal(canAnimate({ menuOpen: true }), true);
  for (const blocker of ['hidden', 'documentHidden', 'introPlaying', 'navigating']) {
    assert.equal(canAnimate({ [blocker]: true }), false);
  }
  assert.equal(canAnimate({ enabled: false }), false);
  assert.equal(canAnimate({ enabled: true, hidden: true }), false);
});


test('stored sizes are bounded and the stage uses the requested size', () => {
  assert.equal(normalizePreferences({scale: .8}).scale, .8);
  assert.equal(normalizePreferences({scale: 5}).scale, 1);
  assert.equal(normalizePreferences({scale: -1}).scale, .4);
  assert.equal(normalizePreferences({scale: 'large'}).scale, DEFAULT_SCALE);
  assert.equal(stageBounds(1440, 900, 222, 1).S, 300 / 256);
  assert.equal(stageBounds(1440, 900, 222, .4).S, 120 / 256);
});
