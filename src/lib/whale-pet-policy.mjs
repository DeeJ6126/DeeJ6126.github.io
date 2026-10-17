export const DEFAULT_SCALE = 0.6;
export const PET_HEIGHT = 300 * DEFAULT_SCALE;
export function normalizeScale(value) {
  return Number.isFinite(value) ? Math.max(.4, Math.min(1, value)) : DEFAULT_SCALE;
}

const ROAM_MODES = new Set(['free', 'calm', 'off']);
const MIN_STAGE_WIDTH = 260;
const BUBBLE_MARGIN = 8;
const BUBBLE_GAP = 12;

const dimension = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;
const coordinate = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

/** Keep corrupt or outdated storage from changing the pet's safe defaults. */
export function normalizePreferences(raw) {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    roam: ROAM_MODES.has(value.roam) ? value.roam : 'free',
    scheme: 'deepseek',
    hidden: value.hidden === true,
    scale: normalizeScale(value.scale),
  };
}

/** The renderer uses a local stage; originX moves it past fixed page controls. */
export function stageBounds(width, height, leftInset = 0, scale = DEFAULT_SCALE) {
  const viewportWidth = dimension(width);
  const H = dimension(height);
  const originX = clamp(dimension(leftInset), 0, Math.max(0, viewportWidth - MIN_STAGE_WIDTH));
  return {
    W: Math.max(MIN_STAGE_WIDTH, viewportWidth - originX),
    H,
    floorY: Math.max(0, H - 2),
    S: 300 * normalizeScale(scale) / 256,
    originX,
  };
}

/**
 * Position a bubble above a point {x, y}, or a rectangle {left, top, width, height}.
 * When the top edge leaves no room, use the space below the anchor if it fits.
 */
export function bubblePosition(anchor, width, height, viewportWidth, viewportHeight) {
  const bubbleWidth = dimension(width);
  const bubbleHeight = dimension(height);
  const vw = dimension(viewportWidth);
  const vh = dimension(viewportHeight);
  const value = anchor && typeof anchor === 'object' ? anchor : {};
  const anchorX = coordinate(value.x, coordinate(value.left) + dimension(value.width) / 2);
  const anchorTop = coordinate(value.y, coordinate(value.top));
  const anchorBottom = anchorTop + dimension(value.height);
  const minLeft = Math.min(BUBBLE_MARGIN, Math.max(0, vw - bubbleWidth));
  const minTop = Math.min(BUBBLE_MARGIN, Math.max(0, vh - bubbleHeight));
  const maxLeft = Math.max(minLeft, vw - bubbleWidth - BUBBLE_MARGIN);
  const maxTop = Math.max(minTop, vh - bubbleHeight - BUBBLE_MARGIN);
  const above = anchorTop - bubbleHeight - BUBBLE_GAP;
  const below = anchorBottom + BUBBLE_GAP;
  const preferredTop = above < minTop && below <= maxTop ? below : above;
  return {
    left: clamp(anchorX - bubbleWidth / 2, minLeft, maxLeft),
    top: clamp(preferredTop, minTop, maxTop),
  };
}

/** A menu stops roaming in the host controller, but the character keeps breathing. */
export function canAnimate({ hidden, documentHidden, introPlaying, navigating, enabled = true } = {}) {
  return Boolean(enabled && !hidden && !documentHidden && !introPlaying && !navigating);
}
