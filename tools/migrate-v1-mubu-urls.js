'use strict';

/**
 * One-shot script: read shareUrl entries from the legacy v1
 * source/_data/resources.yml and copy them into the v2 per-section
 * file entries under src/content/courses/<slug>/课程笔记/_section.md.
 *
 * Match rule: v1 key "category/basename.pdf" -> v2 file ref
 * "/files/category/basename.pdf" within the course whose
 * resourceCategory == category.
 *
 * Existing shareUrl values are overwritten with the v1 value.
 *
 * Usage:
 *   node tools/migrate-v1-mubu-urls.js
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const V1_RESOURCES = path.join(ROOT, 'source', '_data', 'resources.yml');
const COURSES_DIR = path.join(ROOT, 'src', 'content', 'courses');

function detectEol(file) {
  return fs.readFileSync(file, 'utf8').includes('\r\n') ? '\r\n' : '\n';
}

function loadV1() {
  const raw = fs.readFileSync(V1_RESOURCES, 'utf8');
  const cfg = yaml.load(raw) || {};
  const files = cfg.files || {};
  return Object.entries(files)
    .filter(([, v]) => v && v.shareUrl)
    .map(([k, v]) => ({ key: k, shareUrl: String(v.shareUrl) }));
}

function buildCategoryToSlug() {
  const out = new Map();
  for (const slugDir of fs.readdirSync(COURSES_DIR, { withFileTypes: true })) {
    if (!slugDir.isDirectory()) continue;
    const meta = path.join(COURSES_DIR, slugDir.name, '_meta.md');
    if (!fs.existsSync(meta)) continue;
    const m = fs.readFileSync(meta, 'utf8').match(/^resourceCategory:\s*(\S+)/m);
    if (m) out.set(m[1], slugDir.name);
  }
  return out;
}

function updateSectionFile(slug, ref, shareUrl) {
  const file = path.join(COURSES_DIR, slug, '课程笔记', '_section.md');
  if (!fs.existsSync(file)) {
    return { ok: false, reason: 'no _section.md' };
  }
  const eol = detectEol(file);
  const raw = fs.readFileSync(file, 'utf8');
  const fmMatch = raw.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!fmMatch) return { ok: false, reason: 'no front matter' };
  const front = yaml.load(fmMatch[1]) || {};
  const files = Array.isArray(front.files) ? front.files : [];
  const idx = files.findIndex((f) => f && (f.ref === ref || f.url === ref));
  if (idx < 0) return { ok: false, reason: 'ref not in files' };
  const before = files[idx].shareUrl || null;
  files[idx].shareUrl = shareUrl;
  front.files = files;
  const dumped = yaml.dump(front, { lineWidth: -1, noRefs: true }).trimEnd();
  const newContent = `---${eol}${dumped}${eol}---${eol}`;
  fs.writeFileSync(file, newContent, 'utf8');
  return { ok: true, before };
}

function main() {
  const v1 = loadV1();
  const cat2slug = buildCategoryToSlug();

  console.log(`V1 shareUrl entries: ${v1.length}`);

  const stats = { updated: 0, skipped: 0, missing: [] };
  for (const { key, shareUrl } of v1) {
    const slash = key.indexOf('/');
    if (slash < 0) { stats.skipped += 1; continue; }
    const category = key.slice(0, slash);
    const basename = key.slice(slash + 1);
    const slug = cat2slug.get(category);
    if (!slug) { stats.missing.push(`${key} (no slug for category "${category}")`); stats.skipped += 1; continue; }
    const ref = `/files/${category}/${basename}`;
    const r = updateSectionFile(slug, ref, shareUrl);
    if (r.ok) {
      const verb = r.before ? `updated (was ${r.before})` : 'added';
      console.log(`  [${verb}] ${slug}  ${ref}`);
      stats.updated += 1;
    } else {
      console.log(`  [skip] ${slug}  ${ref}  (${r.reason})`);
      stats.missing.push(`${key} (${r.reason})`);
      stats.skipped += 1;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`updated: ${stats.updated}`);
  console.log(`skipped: ${stats.skipped}`);
  if (stats.missing.length) {
    console.log(`missing entries:`);
    stats.missing.forEach((m) => console.log(`  - ${m}`));
  }
  console.log(`\nNext: hit 4321 to verify "复制幕布链接" buttons appear on the affected pages.`);
}

main();
