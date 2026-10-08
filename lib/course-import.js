'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)/g;
const HTML_IMAGE_PATTERN = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

function extractLocalImageReferences(markdown) {
  const references = [];
  for (const match of markdown.matchAll(MARKDOWN_IMAGE_PATTERN)) references.push(match[1] || match[2]);
  for (const match of markdown.matchAll(HTML_IMAGE_PATTERN)) references.push(match[1]);
  const local = references.filter(reference => !/^(?:https?:|data:|\/)/i.test(reference));
  return [...new Set(local)];
}

function normalizeRMarkdown(markdown) {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^```\{([A-Za-z0-9_+-]+)(?:[^}]*)\}/gm, '```$1');
}

function sanitizeFrontMatter(value) {
  return String(value).replace(/"/g, '\\"');
}

function normalizeLineEndings(value) {
  return value.replaceAll('\r\n', '\n');
}

function importedFileMatches(write) {
  if (!fs.existsSync(write.target)) return false;
  if (!write.binary) {
    return normalizeLineEndings(fs.readFileSync(write.target, 'utf8')) === normalizeLineEndings(write.content);
  }
  if (path.extname(write.target).toLowerCase() === '.svg') {
    return normalizeLineEndings(fs.readFileSync(write.target, 'utf8')) === normalizeLineEndings(fs.readFileSync(write.source, 'utf8'));
  }
  return fs.readFileSync(write.target).equals(fs.readFileSync(write.source));
}

function importCourseSources(configPath, destinationRoot, options = {}) {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const configRoot = path.dirname(path.resolve(configPath));
  const writes = [];
  const errors = [];
  const warnings = [];
  // Dangling note entries (source file missing) we want to drop from the
  // config in write mode. Keyed by course slug -> list of note indices to
  // splice out in reverse order so the remaining indices stay valid.
  const danglingByCourse = new Map();

  for (const course of config.courses || []) {
    for (let i = 0; i < (course.notes || []).length; i++) {
      const note = course.notes[i];
      const sourceFile = path.resolve(configRoot, note.source);
      if (!fs.existsSync(sourceFile)) {
        const reason = `Missing note source: ${sourceFile}`;
        if (options.write) {
          // In write mode, warn and queue the entry for removal. Never block
          // the import just because an old .md was cleaned up by hand.
          warnings.push(reason);
          if (!danglingByCourse.has(course.slug)) danglingByCourse.set(course.slug, []);
          danglingByCourse.get(course.slug).push(i);
        } else {
          // Verify mode stays strict: dangling refs must be fixed.
          errors.push(reason);
        }
        continue;
      }

      let body = fs.readFileSync(sourceFile, 'utf8');
      if (path.extname(sourceFile).toLowerCase() === '.rmd') body = normalizeRMarkdown(body);
      body = body.replace(/<img\b(?![^>]*\bloading\s*=)/gi, '<img loading="lazy" decoding="async"');
      const references = extractLocalImageReferences(body);
      const noteStem = path.basename(note.output, path.extname(note.output));
      const assetDirectory = `${noteStem}-assets`;
      const basenameCounts = references.reduce((counts, reference) => {
        let decoded = reference;
        try { decoded = decodeURIComponent(reference); } catch {}
        const basename = path.basename(decoded).toLocaleLowerCase('en-US');
        counts.set(basename, (counts.get(basename) || 0) + 1);
        return counts;
      }, new Map());

      for (const reference of references) {
        let decodedReference = reference;
        try { decodedReference = decodeURIComponent(reference); } catch {}
        const assetSource = path.resolve(path.dirname(sourceFile), decodedReference);
        if (!fs.existsSync(assetSource)) {
          // Missing sub-asset: warn but keep the note. User can fix the image
          // later; we shouldn't drop a whole note over a broken <img>.
          warnings.push(`Missing image referenced by ${sourceFile}: ${assetSource}`);
          continue;
        }
        const referenceHash = crypto.createHash('sha1').update(reference.replace(/\\/g, '/')).digest('hex').slice(0, 8);
        const basename = path.basename(assetSource);
        const assetName = basenameCounts.get(basename.toLocaleLowerCase('en-US')) > 1
          ? `${referenceHash}-${basename}`
          : basename;
        const assetTarget = path.join(destinationRoot, course.slug, assetDirectory, assetName);
        writes.push({ source: assetSource, target: assetTarget, binary: true });
        body = body.split(reference).join(`${assetDirectory}/${assetName}`);
      }

      const frontMatter = [
        '---',
        `title: "${sanitizeFrontMatter(note.title)}"`,
        `course: "${sanitizeFrontMatter(course.slug)}"`,
        `order: ${Number(note.order)}`,
        `source: "${sanitizeFrontMatter(path.relative(configRoot, sourceFile).replace(/\\/g, '/'))}"`,
        ...(note.shareUrl ? [`shareUrl: "${sanitizeFrontMatter(note.shareUrl)}"`] : []),
        '---',
        '',
      ].join('\n');
      writes.push({
        target: path.join(destinationRoot, course.slug, note.output),
        content: frontMatter + body.trimStart(),
        binary: false,
      });
    }
  }

  if (errors.length) throw new Error(errors.join('\n'));

  if (options.write) {
    // Persist cleaned config: splice out dangling note entries.
    if (danglingByCourse.size) {
      for (const course of config.courses || []) {
        const indices = danglingByCourse.get(course.slug);
        if (!indices || !indices.length) continue;
        indices.sort((a, b) => b - a);
        for (const idx of indices) course.notes.splice(idx, 1);
      }
      const eol = fs.readFileSync(configPath, 'utf8').includes('\r\n') ? '\r\n' : '\n';
      const dumped = yaml.dump(config, { lineWidth: -1, noRefs: true, forceQuotes: false }).trimEnd();
      const text = eol === '\r\n' ? dumped.replace(/\n/g, '\r\n') : dumped;
      fs.writeFileSync(configPath, text + eol, 'utf8');
    }

    fs.rmSync(destinationRoot, { recursive: true, force: true });
    for (const write of writes) {
      fs.mkdirSync(path.dirname(write.target), { recursive: true });
      if (write.binary) fs.copyFileSync(write.source, write.target);
      else fs.writeFileSync(write.target, write.content, 'utf8');
    }
  } else {
    for (const write of writes) {
      if (!importedFileMatches(write)) {
        errors.push(`Imported note is out of date: ${write.target}`);
      }
    }
    if (errors.length) throw new Error(errors.join('\n'));
  }

  if (warnings.length) {
    console.warn(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }

  return writes;
}

function verifyImportedCourseNotes(configPath, destinationRoot) {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const errors = [];
  let count = 0;
  for (const course of config.courses || []) {
    for (const note of course.notes || []) {
      count += 1;
      const target = path.join(destinationRoot, course.slug, note.output);
      if (!fs.existsSync(target)) {
        errors.push(`Missing imported note: ${target}`);
        continue;
      }
      const body = fs.readFileSync(target, 'utf8');
      for (const reference of extractLocalImageReferences(body)) {
        let decoded = reference;
        try { decoded = decodeURIComponent(reference); } catch {}
        const asset = path.resolve(path.dirname(target), decoded);
        if (!asset.startsWith(path.resolve(destinationRoot) + path.sep) || !fs.existsSync(asset)) {
          errors.push(`Missing imported image referenced by ${target}: ${asset}`);
        }
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return count;
}

module.exports = { extractLocalImageReferences, normalizeRMarkdown, importCourseSources, verifyImportedCourseNotes };
