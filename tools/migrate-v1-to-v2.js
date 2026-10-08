'use strict';

/**
 * One-shot migration: convert v1 single-file courses (## delimited sections)
 * to v2 per-section file/directory structure.
 *
 * Usage:
 *   node tools/migrate-v1-to-v2.js --dry-run
 *   node tools/migrate-v1-to-v2.js --write
 */

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const frontMatter = require('hexo-front-matter');

const root = path.resolve(__dirname, '..');
const coursesDir = path.join(root, 'src', 'content', 'courses');
const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');

function normalize(s) { return String(s || '').replace(/\r\n/g, '\n'); }

function parseFront(text) {
  const normalized = normalize(text);
  const parsed = frontMatter.parse(normalized);
  return {
    front: { ...parsed },
    body: String(parsed._content || '').replace(/^\n+|\n+$/g, ''),
  };
}

function yamlDump(value) {
  return yaml.dump(value, { lineWidth: -1, noRefs: true, forceQuotes: false }).trimEnd();
}

function listCourses() {
  return fs.readdirSync(coursesDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => ({ slug: f.replace(/\.md$/, ''), file: path.join(coursesDir, f) }));
}

function isAlreadyV2(slug) {
  return fs.existsSync(path.join(coursesDir, slug, '_meta.md'));
}

function slugifyId(title, taken) {
  const base = String(title || '').trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|]/g, '');
  let id = base || 'section';
  let i = 2;
  while (taken.has(id)) {
    id = `${base}-${i}`;
    i += 1;
  }
  return id;
}

function buildSectionsFromBody(body) {
  // Parse body by ## headings; identify files sections by HTML comment marker
  const lines = normalize(body).split('\n');
  const headingPattern = /^##\s+(.+?)\s*(?:<!--\s*type:(text|files)\s*-->)?\s*$/;
  const itemPattern = /^-\s+\[([^\]]+)\]\(([^)]+)\)(?:\s*<!--\s*share:(\S+?)\s*-->)?\s*$/;

  const sections = [];
  let current = null;
  const introLines = [];

  for (const line of lines) {
    const m = line.match(headingPattern);
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), type: m[2] || 'text', bodyLines: [], items: [] };
      continue;
    }
    if (current) current.bodyLines.push(line);
    else introLines.push(line);
  }
  if (current) sections.push(current);

  // For files sections, extract items; remaining bodyLines become the section's intro text
  for (const section of sections) {
    if (section.type === 'files') {
      const items = [];
      const remaining = [];
      for (const line of section.bodyLines) {
        const m = line.match(itemPattern);
        if (m) {
          items.push({
            ref: m[2].trim(),
            title: m[1].trim(),
            shareUrl: m[3] || null,
          });
        } else {
          remaining.push(line);
        }
      }
      section.items = items;
      section.introBody = remaining.join('\n').replace(/^\n+|\n+$/g, '');
    } else {
      section.introBody = section.bodyLines.join('\n').replace(/^\n+|\n+$/g, '');
    }
    delete section.bodyLines;
  }

  return { intro: introLines.join('\n').replace(/^\n+|\n+$/g, ''), sections };
}

function deriveFileId(title, type, taken) {
  // Use title as the directory/file name. Sanitize filesystem-unsafe chars.
  const safe = String(title).trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ');
  // Keep readable; slugify only if conflicts
  if (!taken.has(safe)) return safe;
  let i = 2;
  while (taken.has(`${safe}-${i}`)) i += 1;
  return `${safe}-${i}`;
}

function buildMigrationPlan(slug, file) {
  const raw = fs.readFileSync(file, 'utf8');
  const { front, body } = parseFront(raw);
  const { intro, sections } = buildSectionsFromBody(body);

  if (sections.length === 0) {
    // No ## sections: just promote to _meta.md and a single empty text section
    return null;
  }

  const taken = new Set();
  // Use the title (sanitized) for id; if there are multiple with the same id, suffix
  for (const s of sections) {
    s.id = deriveFileId(s.title, s.type, taken);
    taken.add(s.id);
  }

  // The intro is preserved as a top-level _intro.md? No — we just put it at the
  // top of the first text section's body. If the first section is files, prepend
  // an "intro" text section.
  const firstText = sections.find(s => s.type === 'text');
  if (intro) {
    if (firstText) firstText.introBody = intro + (firstText.introBody ? '\n\n' + firstText.introBody : '');
    else {
      // Insert a synthetic intro text section at the beginning
      sections.unshift({ id: '_intro', type: 'text', title: '简介', introBody: intro, items: [] });
    }
  }

  // Build sections.yml
  const manifest = sections.map(s => ({
    id: s.id,
    type: s.type,
    title: s.title,
  }));

  // Build per-section files
  const plan = {
    slug,
    _meta: front,
    sectionsYml: manifest,
    files: [],
    deleteOriginal: true,
  };

  for (const s of sections) {
    if (s.type === 'text') {
      plan.files.push({
        kind: 'text',
        path: `${slug}/${s.id}.md`,
        content: `---\ntitle: ${yamlDump(s.title)}\ntype: text\norder: ${sections.indexOf(s) + 1}\n---\n\n${s.introBody || ''}\n`,
      });
    } else {
      // files section: write _section.md + create files/ directory
      const fm = {
        title: s.title,
        type: 'files',
        order: sections.indexOf(s) + 1,
        files: s.items.map(it => {
          const entry = { ref: it.ref, title: it.title };
          if (it.shareUrl) entry.shareUrl = it.shareUrl;
          return entry;
        }),
      };
      plan.files.push({
        kind: 'files-section',
        path: `${slug}/${s.id}/_section.md`,
        content: `---\n${yamlDump(fm)}\n---\n`,
      });
      plan.files.push({ kind: 'dir', path: `${slug}/${s.id}/files/` });
    }
  }

  return plan;
}

function execute(plan) {
  const { slug } = plan;
  const courseDir = path.join(coursesDir, slug);
  fs.mkdirSync(courseDir, { recursive: true });

  // _meta.md
  const meta = { ...plan._meta };
  delete meta._content;
  const metaContent = `---\n${yamlDump(meta)}\n---\n`;
  fs.writeFileSync(path.join(courseDir, '_meta.md'), metaContent.replace(/\n/g, fs.readFileSync(path.join(coursesDir, `${slug}.md`), 'utf8').includes('\r\n') ? '\r\n' : '\n'), 'utf8');

  for (const f of plan.files) {
    if (f.kind === 'dir') {
      fs.mkdirSync(path.join(coursesDir, f.path), { recursive: true });
    } else {
      const target = path.join(coursesDir, f.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const original = fs.readFileSync(path.join(coursesDir, `${slug}.md`), 'utf8');
      const eol = original.includes('\r\n') ? '\r\n' : '\n';
      fs.writeFileSync(target, f.content.replace(/\n/g, eol), 'utf8');
    }
  }

  // sections.yml
  const ymlContent = plan.sectionsYml.map(s => {
    const parts = [`  - id: ${s.id}`, `    type: ${s.type}`, `    title: ${s.title}`];
    return parts.join('\n');
  }).join('\n') + '\n';
  const original = fs.readFileSync(path.join(coursesDir, `${slug}.md`), 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(path.join(courseDir, 'sections.yml'), ymlContent.replace(/\n/g, eol), 'utf8');

  // Delete original
  if (plan.deleteOriginal) {
    fs.unlinkSync(path.join(coursesDir, `${slug}.md`));
  }
}

function main() {
  if (!writeMode) console.log('DRY RUN — pass --write to actually write files\n');
  const courses = listCourses();
  let migrated = 0;
  let skipped = 0;
  for (const { slug, file } of courses) {
    if (isAlreadyV2(slug)) {
      console.log(`SKIP  ${slug} (already v2)`);
      skipped += 1;
      continue;
    }
    try {
      const plan = buildMigrationPlan(slug, file);
      if (!plan) {
        console.log(`SKIP  ${slug} (no ## sections in body)`);
        skipped += 1;
        continue;
      }
      console.log(`${writeMode ? 'WROTE' : 'PLAN '} ${slug}: ${plan.files.length} file(s), ${plan.sectionsYml.length} section(s)`);
      for (const s of plan.sectionsYml) {
        console.log(`       - [${s.type}] ${s.id}: ${s.title}`);
      }
      if (writeMode) execute(plan);
      migrated += 1;
    } catch (err) {
      console.error(`FAIL  ${slug}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`\nSummary: ${migrated} ${writeMode ? 'migrated' : 'planned'}, ${skipped} skipped.`);
}

main();
