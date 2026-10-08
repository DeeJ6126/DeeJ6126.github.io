'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractLocalImageReferences, normalizeRMarkdown, importCourseSources } = require('../lib/course-import');

test('extractLocalImageReferences ignores remote images and deduplicates local paths', () => {
  const markdown = '![a](img/a.png) ![b](https://example.com/b.png) ![space](<img/my plot.png>) <img src="html/c.png"> ![a](img/a.png)';
  assert.deepEqual(extractLocalImageReferences(markdown), ['img/a.png', 'img/my plot.png', 'html/c.png']);
});

test('normalizeRMarkdown removes source front matter and normalizes R fences', () => {
  const source = '---\ntitle: Demo\noutput: html_document\n---\n\n```{r echo=FALSE}\n1 + 1\n```';
  assert.equal(normalizeRMarkdown(source), '\n```r\n1 + 1\n```');
});

test('importCourseSources copies notes and referenced images idempotently', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'course-import-'));
  const sourceDir = path.join(temp, 'source');
  const destination = path.join(temp, 'notes');
  fs.mkdirSync(path.join(sourceDir, 'img'), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'img', 'figure.png'), 'image');
  fs.writeFileSync(path.join(sourceDir, 'note.md'), 'Text\n\n![figure](img/figure.png)');
  const config = path.join(temp, 'sources.yml');
  fs.writeFileSync(config, `courses:\n  - slug: demo\n    notes:\n      - source: "${path.join(sourceDir, 'note.md').replace(/\\/g, '/')}"\n        output: note.md\n        title: Demo\n        order: 1\n        shareUrl: "https://share.mubu.com/doc/example"\n`);

  importCourseSources(config, destination, { write: true });
  const imported = fs.readFileSync(path.join(destination, 'demo', 'note.md'), 'utf8');
  assert.match(imported, /source: "source\/note\.md"/);
  assert.match(imported, /shareUrl: "https:\/\/share\.mubu\.com\/doc\/example"/);
  const importedAsset = imported.match(/note-assets\/(figure\.png)/)[1];
  assert.equal(fs.readFileSync(path.join(destination, 'demo', 'note-assets', importedAsset), 'utf8'), 'image');
  assert.doesNotThrow(() => importCourseSources(config, destination, { write: false }));
  fs.writeFileSync(path.join(destination, 'demo', 'note-assets', importedAsset), 'changed');
  assert.throws(() => importCourseSources(config, destination, { write: false }), /out of date/);
});

test('importCourseSources keeps same-basename images distinct', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'course-import-collision-'));
  const sourceDir = path.join(temp, 'source');
  const destination = path.join(temp, 'notes');
  for (const folder of ['a', 'b']) fs.mkdirSync(path.join(sourceDir, folder), { recursive: true });
  fs.writeFileSync(path.join(sourceDir, 'a', 'plot.png'), 'first');
  fs.writeFileSync(path.join(sourceDir, 'b', 'plot.png'), 'second');
  fs.writeFileSync(path.join(sourceDir, 'note.md'), '![a](a/plot.png) ![b](b/plot.png)');
  const config = path.join(temp, 'sources.yml');
  fs.writeFileSync(config, `courses:\n  - slug: demo\n    notes:\n      - source: "${path.join(sourceDir, 'note.md').replace(/\\/g, '/')}"\n        output: note.md\n        title: Demo\n        order: 1\n`);
  importCourseSources(config, destination, { write: true });
  const assets = fs.readdirSync(path.join(destination, 'demo', 'note-assets'));
  assert.equal(assets.length, 2);
  assert.notEqual(assets[0], assets[1]);
});

test('importCourseSources warns (not throws) on a missing referenced image in write mode', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'course-import-missing-'));
  const source = path.join(temp, 'note.md');
  fs.writeFileSync(source, '![missing](img/nope.png)');
  const config = path.join(temp, 'sources.yml');
  fs.writeFileSync(config, `courses:\n  - slug: demo\n    notes:\n      - source: "${source.replace(/\\/g, '/')}"\n        output: note.md\n        title: Demo\n        order: 1\n`);
  // In write mode the missing image is a warning; the note is still imported.
  // Capture stderr to confirm the warning is emitted.
  const orig = console.warn;
  const captured = [];
  console.warn = (...args) => captured.push(args.join(' '));
  try {
    assert.doesNotThrow(() => importCourseSources(config, path.join(temp, 'out'), { write: true }));
  } finally {
    console.warn = orig;
  }
  assert.ok(captured.some((line) => /Missing image referenced/.test(line)), 'expected a "Missing image referenced" warning');
});

test('importCourseSources auto-removes a dangling source-file entry from the YAML in write mode', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'course-import-dangling-'));
  const config = path.join(temp, 'sources.yml');
  // Build the YAML programmatically to avoid quoting issues with backslashes
  // in template strings.
  const yaml = require('js-yaml');
  fs.writeFileSync(config, yaml.dump({
    courses: [{
      slug: 'demo',
      notes: [
        { source: `${temp}/does-not-exist.md`, output: 'gone.md', title: 'Gone', order: 1 },
        { source: `${temp}/also-missing.md`, output: 'gone-2.md', title: 'Gone2', order: 2 },
      ],
    }],
  }));
  const orig = console.warn;
  const captured = [];
  console.warn = (...args) => captured.push(args.join(' '));
  try {
    assert.doesNotThrow(() => importCourseSources(config, path.join(temp, 'out'), { write: true }));
  } finally {
    console.warn = orig;
  }
  // Both dangling entries should be reported, and the YAML on disk should
  // no longer carry them.
  assert.equal(captured.filter((l) => /Missing note source/.test(l)).length, 2);
  const after = yaml.load(fs.readFileSync(config, 'utf8'));
  assert.equal((after.courses[0].notes || []).length, 0);
});

test('importCourseSources still throws on a dangling source in verify mode (write: false)', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'course-import-dangling-verify-'));
  const config = path.join(temp, 'sources.yml');
  const yaml = require('js-yaml');
  fs.writeFileSync(config, yaml.dump({
    courses: [{
      slug: 'demo',
      notes: [
        { source: `${temp}/does-not-exist.md`, output: 'gone.md', title: 'Gone', order: 1 },
      ],
    }],
  }));
  assert.throws(() => importCourseSources(config, path.join(temp, 'out'), { write: false }), /Missing note source/);
});
