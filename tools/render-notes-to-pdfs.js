'use strict';

/**
 * One-shot script: render every .md in source/course-notes/ to a PDF, place
 * the PDF in source/files/<resourceCategory>/, drop a copy of the .md next
 * to it (as companion), and rewrite the course's 课程笔记/_section.md
 * to point at the new PDFs (replacing the old /downloads/notes/ entries).
 *
 * Skips .Rmd files (no R Markdown renderer in scope).
 *
 * Usage:
 *   node tools/render-notes-to-pdfs.js
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCES_YML = path.join(ROOT, 'course-sources.yml');
const COURSES_DIR = path.join(ROOT, 'src/content/courses');
const FILES_SRC = path.join(ROOT, 'source/files');
const RENDERER = path.join(ROOT, 'tools', 'render-md-to-pdf.js');

function loadCourseSources() {
  const cfg = yaml.load(fs.readFileSync(SOURCES_YML, 'utf8')) || { courses: [] };
  return cfg.courses || [];
}

function getResourceCategory(slug) {
  const meta = path.join(COURSES_DIR, slug, '_meta.md');
  if (!fs.existsSync(meta)) return null;
  const raw = fs.readFileSync(meta, 'utf8');
  const m = raw.match(/^resourceCategory:\s*(\S+)/m);
  return m ? m[1] : null;
}

function renderOne(input, output) {
  execFileSync(process.execPath, [RENDERER, input, output], { stdio: 'inherit' });
}

function detectEol(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return raw.includes('\r\n') ? '\r\n' : '\n';
}

function updateSectionFiles(slug, newEntries) {
  const file = path.join(COURSES_DIR, slug, '课程笔记', '_section.md');
  if (!fs.existsSync(file)) {
    console.log(`[section] ${slug}: no _section.md, skipping update`);
    return;
  }
  const eol = detectEol(file);
  const raw = fs.readFileSync(file, 'utf8');
  const fmMatch = raw.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!fmMatch) return;
  const front = yaml.load(fmMatch[1]) || {};
  const existing = Array.isArray(front.files) ? front.files : [];
  // Drop old /downloads/notes/ entries (we're replacing them with PDF refs)
  const kept = existing.filter((f) => f && f.ref && !String(f.ref).startsWith('/downloads/notes/'));
  // Prepend new PDF entries (rendered-from-MD take visual priority)
  front.files = [...newEntries, ...kept];
  const dumped = yaml.dump(front, { lineWidth: -1, noRefs: true }).trimEnd();
  const sep = eol;
  const newContent = `---${sep}${dumped}${sep}---${sep}`;
  fs.writeFileSync(file, newContent, 'utf8');
  console.log(`[section] ${slug}: wrote ${newEntries.length} new PDF entries (kept ${kept.length} pre-existing)`);
}

function main() {
  const courses = loadCourseSources();
  const affected = {}; // slug -> array of new PDF entries
  let rendered = 0;
  let skipped = 0;

  for (const course of courses) {
    const { slug, notes = [] } = course;
    const category = getResourceCategory(slug);
    if (!category) {
      console.log(`[skip] ${slug}: no resourceCategory in _meta.md`);
      continue;
    }
    for (const note of notes) {
      const src = note.source;
      if (!src || !src.endsWith('.md')) { skipped += 1; continue; } // skip .Rmd and others
      const absSrc = path.join(ROOT, src.split('/').join(path.sep));
      if (!fs.existsSync(absSrc)) {
        console.log(`[warn] missing: ${src}`);
        skipped += 1;
        continue;
      }
      const base = path.basename(absSrc, '.md');
      const categoryDir = path.join(FILES_SRC, category);
      const pdfOut = path.join(categoryDir, `${base}.pdf`);
      const mdOut = path.join(categoryDir, `${base}.md`);
      fs.mkdirSync(categoryDir, { recursive: true });
      console.log(`[render] ${src} -> ${path.relative(ROOT, pdfOut)}`);
      try {
        renderOne(absSrc, pdfOut);
        // Copy .md next to the PDF for companion detection
        fs.copyFileSync(absSrc, mdOut);
        rendered += 1;
      } catch (err) {
        console.error(`[fail] ${src}: ${err.message}`);
        skipped += 1;
        continue;
      }
      if (!affected[slug]) affected[slug] = [];
      affected[slug].push({
        ref: `/files/${category}/${base}.pdf`,
        title: String(note.title || base),
        order: 1,
      });
    }
  }

  for (const [slug, entries] of Object.entries(affected)) {
    updateSectionFiles(slug, entries);
  }

  console.log(`\n=== Summary ===`);
  console.log(`rendered: ${rendered}`);
  console.log(`skipped:  ${skipped}`);
  console.log(`courses affected: ${Object.keys(affected).length}`);
  console.log(`\nNext: run sync (admin "同步文件" button) to copy to public/.`);
}

main();
