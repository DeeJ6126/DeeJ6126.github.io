'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
fs.rmSync(publicRoot, { recursive: true, force: true });
const pairs = [
  ['source/files', 'public/files'],
  ['source/img', 'public/img'],
  ['source/music', 'public/music'],
];

for (const [from, to] of pairs) {
  const source = path.join(root, from);
  const target = path.join(root, to);
  if (fs.existsSync(source)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
  }
}

const notesRoot = path.join(root, 'src/content/notes');
const notesDownloadRoot = path.join(publicRoot, 'downloads/notes');

function copyMarkdownDownloads(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      copyMarkdownDownloads(source);
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.md') continue;

    const relativePath = path.relative(notesRoot, source);
    const target = path.join(notesDownloadRoot, relativePath);
    const markdown = fs.readFileSync(source, 'utf8')
      .replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, markdown, 'utf8');
  }
}

if (fs.existsSync(notesRoot)) copyMarkdownDownloads(notesRoot);

// Generate /public/music/index.json from source/_data/music.yml + source/music/ files
const yaml = require('js-yaml');
const musicSrcDir = path.join(root, 'source/music');
const musicMetaFile = path.join(root, 'source/_data/music.yml');
const musicOutDir = path.join(publicRoot, 'music');
if (fs.existsSync(musicSrcDir)) {
  const meta = fs.existsSync(musicMetaFile)
    ? (yaml.load(fs.readFileSync(musicMetaFile, 'utf8')) || {})
    : {};
  const metaSongs = Array.isArray(meta.songs) ? meta.songs : [];
  const byId = new Map(metaSongs.map((s) => [s.id, s]));
  const ALLOWED = new Set(['.mp3', '.ogg', '.wav', '.m4a']);
  const list = [];
  for (const f of fs.readdirSync(musicSrcDir)) {
    const ext = path.extname(f).toLowerCase();
    if (!ALLOWED.has(ext)) continue;
    const id = f.slice(0, -ext.length);
    const m = byId.get(id) || {};
    list.push({
      id,
      file: f,
      url: `/music/${f}`,
      title: m.title || id,
      order: typeof m.order === 'number' ? m.order : 9999,
    });
  }
  list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  fs.mkdirSync(musicOutDir, { recursive: true });
  fs.writeFileSync(
    path.join(musicOutDir, 'index.json'),
    JSON.stringify({ songs: list }, null, 2),
    'utf8',
  );
}

console.log('Static course assets synchronized.');
