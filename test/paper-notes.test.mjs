import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkPaperMarkdown, { rehypePaperTables } from '../lib/paper-markdown.mjs';
import { importPaperNote, listPaperNotes, readPaperNote, savePaperNote } from '../lib/paper-notes.mjs';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-notes-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'site');
  const source = path.join(directory, 'example');
  fs.mkdirSync(path.join(source, 'imgs'), { recursive: true });
  return { root, source, directory };
}
const front = { title: 'Example', summary: 'Reading note', readWeek: '秋6周', tags: ['VAE'] };

test('imports Obsidian embeds and ordinary images with spaces, preserving formulas and the original files', (t) => {
  const { root, source } = fixture(t);
  const body = '# Notes\n\n![[figure 1.png|368]]\n\n![Plot](<imgs/figure 1.png>)\n\n$$\nz = f(x)\n$$\n\n```md\n![[literal.png]]\n```';
  fs.writeFileSync(path.join(source, 'example.md'), body);
  fs.writeFileSync(path.join(source, 'imgs/figure 1.png'), 'fixture-image');
  const note = importPaperNote(root, { sourcePath: source, slug: 'example', front });
  assert.match(note.body, /\/papers\/example\/images\/figure%201\.png/);
  assert.match(note.body, /figure%201\.png "width=368"/);
  assert.match(note.body, /!\[Plot\]\(\/papers\/example\/images\/figure%201\.png\)/);
  assert.ok(note.body.includes('$$\nz = f(x)\n$$'));
  assert.ok(note.body.includes('```md\n![[literal.png]]\n```'));
  assert.equal(fs.readFileSync(path.join(source, 'example.md'), 'utf8'), body);
  assert.equal(fs.readFileSync(path.join(root, 'source/papers/example/images/figure 1.png'), 'utf8'), 'fixture-image');
});

test('fails before creating a note when a referenced picture is missing or outside the import folder', (t) => {
  const { root, source, directory } = fixture(t);
  const file = path.join(source, 'example.md');
  fs.writeFileSync(file, '![[missing.png]]');
  assert.throws(() => importPaperNote(root, { sourcePath: source, slug: 'missing', front }), /图片缺失/);
  assert.equal(readPaperNote(root, 'missing'), null);
  fs.writeFileSync(path.join(directory, 'outside.png'), 'private-image');
  fs.writeFileSync(file, '![[../outside.png]]');
  assert.throws(() => importPaperNote(root, { sourcePath: source, slug: 'outside', front }), /必须位于导入目录/);
  assert.equal(readPaperNote(root, 'outside'), null);
});

test('rejects duplicate import and invalid slugs without overwriting an existing note', (t) => {
  const { root, source } = fixture(t);
  fs.writeFileSync(path.join(source, 'example.md'), '# imported');
  savePaperNote(root, 'existing', { front, body: '# authored' });
  assert.throws(() => importPaperNote(root, { sourcePath: source, slug: 'existing', front }), /已存在/);
  assert.equal(readPaperNote(root, 'existing').body.trim(), '# authored');
  assert.throws(() => savePaperNote(root, '../escape', { front, body: 'no' }), /笔记标识/);
});

test('validates reading weeks and lists later seasons and weeks first', (t) => {
  const { root } = fixture(t);
  savePaperNote(root, 'first', { front: { ...front, readWeek: '秋5周' }, body: 'first' });
  savePaperNote(root, 'second', { front, body: 'second' });
  assert.deepEqual(listPaperNotes(root).map((note) => note.slug), ['second', 'first']);
  savePaperNote(root, 'winter', { front: { ...front, readWeek: '冬1周' }, body: 'winter' });
  assert.deepEqual(listPaperNotes(root).map((note) => note.slug), ['winter', 'second', 'first']);
  for (const season of ['秋', '冬', '春', '夏']) {
    assert.throws(() => savePaperNote(root, 'invalid', { front: { ...front, readWeek: `${season}9周` }, body: '' }), /阅读周次/);
  }
  for (const readWeek of ['寒20周', '暑30周']) {
    const note = savePaperNote(root, 'vacation', { front: { ...front, readWeek, readDate: '2026-10-20' }, body: '' });
    assert.equal(note.front.readWeek, readWeek);
    assert.equal(note.front.readDate, undefined);
  }
  for (const readWeek of ['秋0周', '寒0周', '暑1.5周', '夏01周', '秋', '']) {
    assert.throws(() => savePaperNote(root, 'invalid', { front: { ...front, readWeek }, body: '' }), /阅读周次/);
  }
});

test('imports a local cover and keeps the selected cover when updating the note', (t) => {
  const { root, source } = fixture(t);
  fs.writeFileSync(path.join(source, 'example.md'), '---\ncover: imgs/cover.png\n---\n# Original note');
  fs.writeFileSync(path.join(source, 'imgs/cover.png'), 'cover-image');
  const note = importPaperNote(root, { sourcePath: source, slug: 'example', front });
  assert.equal(note.front.cover, '/papers/example/images/cover.png');
  assert.equal(fs.readFileSync(path.join(root, 'source/papers/example/images/cover.png'), 'utf8'), 'cover-image');
  savePaperNote(root, 'example', { front: { ...note.front, title: 'Updated title' }, body: note.body });
  assert.equal(readPaperNote(root, 'example').front.cover, note.front.cover);
  savePaperNote(root, 'example', { front: { ...note.front, cover: '' }, body: note.body });
  assert.equal(readPaperNote(root, 'example').front.cover, undefined);
});

test('paper Markdown preserves soft line breaks and adjacent image widths in the rendered HTML', async () => {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkPaperMarkdown] });
  const result = await processor.render('First line\nSecond line\n\n![A](/papers/example/a.png "width=331")![B](/papers/example/b.png "width=330")', {
    fileURL: new URL('../src/content/papers/example/index.md', import.meta.url),
  });
  assert.match(result.code, /First line<br>\n?Second line/);
  assert.match(result.code, /width="331"/);
  assert.match(result.code, /width="330"/);
  assert.doesNotMatch(result.code, /title="width=/);
  assert.equal((result.code.match(/<p>/g) || []).length, 2);
});

test('paper formatting preserves code blocks and does not change course Markdown', async () => {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkPaperMarkdown], syntaxHighlight: false });
  const code = await processor.render('```text\nfirst\nsecond\n```', {
    fileURL: new URL('../src/content/papers/example/index.md', import.meta.url),
  });
  assert.doesNotMatch(code.code, /<br>/);
  const course = await processor.render('First\nSecond', {
    fileURL: new URL('../src/content/notes/example.md', import.meta.url),
  });
  assert.doesNotMatch(course.code, /<br>/);
});

test('a paper table stops before following prose and images even without a blank line', async () => {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkPaperMarkdown], rehypePlugins: [rehypePaperTables] });
  const source = '| Dataset | Cells | Test |\n| --- | --- | --- |\n| CORTEX | 3,005 | Structure |\n| HEMATO | 4,016 | Continuous |\n| RETINA | 27,499 | Batch |\nFollowing explanation\n![Diagram](/papers/example/diagram.png)';
  const result = await processor.render(source, { fileURL: new URL('../src/content/papers/example/index.md', import.meta.url) });
  const table = result.code.match(/<table>[\s\S]*?<\/table>/)?.[0];
  assert.equal((table.match(/<tr>/g) || []).length, 4);
  assert.doesNotMatch(table, /Following explanation|<img/);
  assert.match(result.code, /<\/table><\/div>\s*<p>Following explanation/);
  assert.match(result.code, /<div class="paper-table-scroll">/);
});

test('table rows with separators and escaped literal pipes keep their contents', async () => {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkPaperMarkdown] });
  const result = await processor.render('| A | B |\n| --- | --- |\nfirst | second\nText with \\| a literal pipe', {
    fileURL: new URL('../src/content/papers/example/index.md', import.meta.url),
  });
  const table = result.code.match(/<table>[\s\S]*?<\/table>/)?.[0];
  assert.match(table, /first/);
  assert.doesNotMatch(table, /literal pipe/);
  assert.match(result.code, /<p>Text with \| a literal pipe<\/p>/);
});

test('standalone single-line double-dollar formulas render as display math between paragraphs', async () => {
  const processor = await createMarkdownProcessor({ remarkPlugins: [remarkMath, remarkPaperMarkdown], rehypePlugins: [rehypeKatex] });
  const result = await processor.render('Before\n$$\\boxed{x=1}$$\nAfter\n\nAn inline $z$ stays inline.', {
    fileURL: new URL('../src/content/papers/example/index.md', import.meta.url),
  });
  assert.match(result.code, /<p>Before<\/p>/);
  assert.match(result.code, /class="katex-display"/);
  assert.match(result.code, /<p>After<\/p>/);
  assert.equal((result.code.match(/class="katex-display"/g) || []).length, 1);
  assert.match(result.code, /An inline/);
});
