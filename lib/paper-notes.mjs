import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { comparePaperWeeks, parsePaperWeek } from '../src/lib/paper-weeks.mjs';

export function validatePaperSlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error('笔记标识仅支持小写字母、数字和连字符，最多 80 个字符。');
  }
  return slug;
}

function notePath(root, slug) {
  validatePaperSlug(slug);
  const base = path.resolve(root, 'src/content/papers');
  const directory = path.join(base, slug);
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error('笔记目录不能是符号链接。');
  return path.join(directory, 'index.md');
}

function parse(source) {
  const match = source.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  return match ? { front: yaml.load(match[1]) || {}, body: match[2] } : { front: {}, body: source };
}

function normalizeFront(front) {
  const clean = {};
  for (const field of ['title', 'summary', 'readWeek', 'paperTitle', 'authors', 'venue', 'url', 'cover']) {
    const value = front[field];
    if (value !== undefined && value !== null && String(value).trim()) {
      clean[field] = String(value).trim();
    }
  }
  if (!clean.title || !clean.summary) throw new Error('请填写标题和摘要。');
  if (!parsePaperWeek(clean.readWeek)) throw new Error('阅读周次请填写为“秋6周”等格式；秋、冬、春、夏限 1～8 周，寒、暑为正整数周。');
  if (clean.url && !/^https?:\/\//i.test(clean.url)) throw new Error('论文链接应以 https:// 或 http:// 开头。');
  if (clean.cover && !/^(?:\/papers\/|https?:\/\/)/i.test(clean.cover)) throw new Error('封面应为笔记图片地址或 http(s) 图片链接。');
  if (front.year !== undefined && front.year !== '') {
    const year = Number(front.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error('论文年份无效。');
    clean.year = year;
  }
  clean.tags = Array.isArray(front.tags) ? [...new Set(front.tags.map(String).map((tag) => tag.trim()).filter(Boolean))] : [];
  return clean;
}

export function readPaperNote(root, slug) {
  const file = notePath(root, slug);
  if (!fs.existsSync(file)) return null;
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('笔记文件不能是符号链接。');
  return { slug, ...parse(fs.readFileSync(file, 'utf8')) };
}

export function listPaperNotes(root) {
  const directory = path.resolve(root, 'src/content/papers');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name))
    .map((entry) => readPaperNote(root, entry.name)).filter(Boolean)
    .sort((a, b) => comparePaperWeeks(a.front.readWeek, b.front.readWeek) || a.slug.localeCompare(b.slug));
}

export function savePaperNote(root, slug, { front, body }) {
  const file = notePath(root, slug);
  const metadata = normalizeFront(front);
  if (typeof body !== 'string') throw new Error('笔记正文应为 Markdown 文本。');
  if (Buffer.byteLength(body) > 10 * 1024 * 1024) throw new Error('笔记正文不能超过 10 MB。');
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('笔记文件不能是符号链接。');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.saving';
  fs.writeFileSync(temporary, `---\n${yaml.dump(metadata, { lineWidth: -1, noRefs: true })}---\n\n${body.trim()}\n`, 'utf8');
  fs.renameSync(temporary, file);
  return readPaperNote(root, slug);
}

const imageTypes = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

// Only rewrite Markdown prose; code examples keep their literal image syntax.
function mapProse(markdown, transform) {
  let fence = null;
  return markdown.split(/(\r?\n)/).map((line) => {
    const start = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (start) {
      if (!fence) fence = start[1];
      else if (start[1][0] === fence[0] && start[1].length >= fence.length) fence = null;
      return line;
    }
    return fence ? line : transform(line);
  }).join('');
}

export function importPaperNote(root, { sourcePath, slug, front = {} }) {
  validatePaperSlug(slug);
  if (readPaperNote(root, slug)) throw new Error('这个笔记标识已存在，请换一个标识，或直接编辑现有笔记。');
  if (!sourcePath || !path.isAbsolute(sourcePath)) throw new Error('请填写本机笔记目录或 Markdown 文件的绝对路径。');
  const source = fs.realpathSync(sourcePath);
  const stat = fs.statSync(source);
  const directory = stat.isDirectory() ? source : path.dirname(source);
  let markdownFile = source;
  if (stat.isDirectory()) {
    const files = fs.readdirSync(source).filter((name) => /\.md$/i.test(name));
    const preferred = files.find((name) => name.toLowerCase() === path.basename(source).toLowerCase() + '.md');
    if (!preferred && files.length !== 1) throw new Error('目录含多个 Markdown 文件，请填写要导入文件的完整路径。');
    markdownFile = path.join(source, preferred || files[0]);
  }
  if (!/\.md$/i.test(markdownFile)) throw new Error('只支持导入 Markdown 笔记。');
  const parsed = parse(fs.readFileSync(markdownFile, 'utf8'));
  const originals = new Map();
  function collect(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && imageTypes.has(path.extname(file).toLowerCase())) {
        const matches = originals.get(entry.name) || [];
        originals.set(entry.name, [...matches, file]);
      }
    }
  }
  collect(directory);
  const copies = new Map();
  const destinations = new Map();
  function imageUrl(raw) {
    if (/^(?:https?:|data:)/i.test(raw)) return raw;
    let name;
    try { name = decodeURIComponent(raw.replace(/^<|>$/g, '')); } catch { name = raw; }
    const resolved = path.resolve(directory, name);
    let file;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) file = fs.realpathSync(resolved);
    else {
      const matches = originals.get(path.basename(name)) || [];
      if (matches.length !== 1) throw new Error(`图片缺失或重名：${name}`);
      file = matches[0];
    }
    const relative = path.relative(directory, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`图片必须位于导入目录内：${name}`);
    if (!imageTypes.has(path.extname(file).toLowerCase())) throw new Error(`不支持的图片格式：${name}`);
    const target = path.basename(file);
    if (destinations.has(target) && destinations.get(target) !== file) throw new Error(`图片文件名重复：${target}`);
    destinations.set(target, file);
    copies.set(file, target);
    return `/papers/${slug}/images/${encodeURIComponent(target)}`;
  }
  const body = mapProse(parsed.body, (line) => line
    .replace(/!\[\[([^\]\n]+)\]\]/g, (_match, content) => {
      const [file, ...options] = content.split('|');
      const width = options.find((option) => /^\d{1,4}$/.test(option.trim()))?.trim();
      const label = path.basename(file).replace(/[\[\]]/g, '');
      return `![${label}](${imageUrl(file.trim())}${width && Number(width) > 0 ? ` "width=${Number(width)}"` : ''})`;
    })
    .replace(/!\[([^\]]*)\]\((<[^>]+>|[^\s)]+)(\s+"[^"]*")?\)/g, (match, alt, url, title = '') => {
      if (url.startsWith(`/papers/${slug}/images/`)) return match;
      return `![${alt}](${imageUrl(url)}${title})`;
    }));
  const defaults = {
    title: path.basename(markdownFile, path.extname(markdownFile)),
    summary: '论文精读与学习笔记。',
    readWeek: '秋1周',
    tags: [],
  };
  const metadataInput = { ...defaults, ...parsed.front, ...front };
  if (metadataInput.cover && !/^(?:\/papers\/|https?:\/\/)/i.test(metadataInput.cover)) metadataInput.cover = imageUrl(metadataInput.cover);
  const metadata = normalizeFront(metadataInput);
  const assetDir = path.resolve(root, 'source/papers', slug, 'images');
  // Resolve all references before writing anything, so a missing image cannot leave a partial note.
  fs.mkdirSync(assetDir, { recursive: true });
  for (const [file, name] of copies) fs.copyFileSync(file, path.join(assetDir, name));
  return savePaperNote(root, slug, { front: metadata, body });
}
