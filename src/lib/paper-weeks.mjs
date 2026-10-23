export const PAPER_SEASONS = ['秋', '冬', '寒', '春', '夏', '暑'];

export function parsePaperWeek(value) {
  const match = typeof value === 'string' && /^([秋冬寒春夏暑])([1-9]\d*)周$/.exec(value);
  if (!match) return null;
  const season = match[1];
  const week = Number(match[2]);
  if (!Number.isSafeInteger(week) || (!['寒', '暑'].includes(season) && week > 8)) return null;
  return { season, week };
}

export function comparePaperWeeks(a, b) {
  const first = parsePaperWeek(a);
  const second = parsePaperWeek(b);
  if (!first || !second) return 0;
  return PAPER_SEASONS.indexOf(second.season) - PAPER_SEASONS.indexOf(first.season) || second.week - first.week;
}
