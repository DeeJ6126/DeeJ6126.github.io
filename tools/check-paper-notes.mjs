import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPaperNotes } from '../lib/paper-notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const notes = listPaperNotes(root);
const errors = [];
let images = 0;
for (const note of notes) {
  if (note.front.cover?.startsWith('/papers/')) {
    const file = path.resolve(root, 'source', decodeURIComponent(note.front.cover).slice(1));
    if (!file.startsWith(path.resolve(root, 'source/papers') + path.sep) || !fs.existsSync(file)) errors.push(`${note.slug}: 封面缺失 ${note.front.cover}`);
  }
  for (const match of note.body.matchAll(/!\[[^\]]*\]\((\/papers\/[^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const relative = decodeURIComponent(match[1]).slice(1);
    const file = path.resolve(root, 'source', relative);
    const base = path.resolve(root, 'source/papers') + path.sep;
    if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) errors.push(`${note.slug}: 图片缺失 ${match[1]}`);
    images++;
  }
  if (/!\[\[/.test(note.body)) errors.push(`${note.slug}: 仍含 Obsidian 图片嵌入，请导入后发布。`);
}
if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
} else console.log(`论文笔记检查通过：${notes.length} 篇笔记，${images} 张引用图片。`);
