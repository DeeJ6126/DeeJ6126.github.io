/**
 * Parse a v2 course structure:
 *   src/content/courses/<slug>/
 *     _meta.md
 *     sections.yml
 *     <id>.md             (text section, body = section content)
 *     <id>/_section.md    (files section, front matter: title, type, order, files: [...])
 *     <id>/files/         (optional, for image uploads in v2)
 *
 * Used by both [slug].astro (build) and admin/storage/sections.mjs (admin).
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import frontMatter from 'hexo-front-matter';

/**
 * @typedef {Object} CourseSection
 * @property {string} id
 * @property {string} title
 * @property {number} [order]
 * @property {'text' | 'files'} [type]
 * @property {Record<string, any>} [front]
 * @property {string} [body]
 * @property {any[]} [files]
 */

/**
 * @typedef {Object} TextSectionData
 * @property {Record<string, any>} front
 * @property {string} body
 */

/**
 * @typedef {Object} FilesSectionData
 * @property {Record<string, any>} front
 */

/**
 * @typedef {Object} ResolvedItem
 * @property {'pdf' | 'markdown' | 'image' | 'link'} kind
 * @property {string} title
 * @property {string} url
 * @property {string | null} [shareUrl]
 * @property {number} [size]
 * @property {any} [entry]
 */

/**
 * @typedef {Object} CompanionFile
 * @property {string} url
 * @property {string} diskPath
 */

function normalize(s) { return String(s || '').replace(/\r\n/g, '\n'); }

function readCourseDir(courseDir) {
  if (!fs.existsSync(courseDir)) return null;
  const metaPath = path.join(courseDir, '_meta.md');
  if (!fs.existsSync(metaPath)) return null;
  const metaRaw = normalize(fs.readFileSync(metaPath, 'utf8'));
  const meta = frontMatter.parse(metaRaw);
  const manifestPath = path.join(courseDir, 'sections.yml');
  const manifestRaw = fs.existsSync(manifestPath) ? normalize(fs.readFileSync(manifestPath, 'utf8')) : '';
  const manifest = yaml.load(manifestRaw) || [];
  return { courseDir, meta, manifest };
}

/**
 * @param {string} courseDir
 * @param {string} id
 * @returns {TextSectionData | null}
 */
function readTextSection(courseDir, id) {
  const file = path.join(courseDir, `${id}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = normalize(fs.readFileSync(file, 'utf8'));
  const parsed = frontMatter.parse(raw);
  return {
    front: { ...parsed },
    body: String(parsed._content || '').replace(/^\n+|\n+$/g, ''),
  };
}

/**
 * @param {string} courseDir
 * @param {string} id
 * @returns {FilesSectionData | null}
 */
function readFilesSection(courseDir, id) {
  const file = path.join(courseDir, id, '_section.md');
  if (!fs.existsSync(file)) return null;
  const raw = normalize(fs.readFileSync(file, 'utf8'));
  const parsed = frontMatter.parse(raw);
  return { front: { ...parsed } };
}

function readSection(courseDir, id, type) {
  if (type === 'text') return readTextSection(courseDir, id);
  if (type === 'files') return readFilesSection(courseDir, id);
  return null;
}

/**
 * @param {string} courseDir
 * @returns {CourseSection[]}
 */
function listAllSections(courseDir) {
  const course = readCourseDir(courseDir);
  if (!course) return [];
  return course.manifest.map((entry) => {
    if (entry.type === 'files') {
      const data = readFilesSection(courseDir, entry.id);
      return { ...entry, front: data?.front || {}, files: data?.front?.files || [] };
    }
    const data = readTextSection(courseDir, entry.id);
    return { ...entry, front: data?.front || {}, body: data?.body || '' };
  });
}

function listFilesSectionEntries(courseDir, sectionId) {
  const section = readFilesSection(courseDir, sectionId);
  return section?.front?.files || [];
}

/**
 * Resolve a files section entry to a renderable item.
 *   { kind: 'pdf' | 'markdown' | 'image', title, url, shareUrl, ... }
 * @param {any} entry
 * @param {any[]} notes
 * @param {Array<{ relativePath: string, shareUrl?: string, size?: number }>} pdfResources
 * @returns {ResolvedItem}
 */
function resolveFileItem(entry, notes, pdfResources) {
  const url = entry.ref || entry.url;
  if (!url) return null;
  const isPdf = /\.pdf(\?|#|$)/i.test(url);
  if (isPdf) {
    const ref = url.replace(/^\/files\//, '').split(/[?#]/)[0];
    const decoded = decodeURIComponent(ref);
    const resource = pdfResources.find((r) => r.relativePath === decoded || r.relativePath === ref);
    return {
      kind: 'pdf',
      title: entry.title,
      url,
      shareUrl: entry.shareUrl || resource?.shareUrl || null,
      size: resource?.size || 0,
    };
  }
  const m = url.match(/^\/downloads\/notes\/(.+)\.md$/);
  if (m) {
    const id = m[1];
    const note = notes.find((n) => n.id === id);
    return {
      kind: 'markdown',
      title: entry.title,
      url,
      shareUrl: entry.shareUrl || note?.data?.shareUrl || null,
      entry: note,
    };
  }
  if (/^\/img\//.test(url)) {
    return { kind: 'image', title: entry.title, url, shareUrl: entry.shareUrl || null };
  }
  return { kind: 'link', title: entry.title, url, shareUrl: entry.shareUrl || null };
}

/**
 * @param {string} courseDir
 * @param {string} sectionId
 * @param {any[]} notes
 * @param {Array<{ relativePath: string, shareUrl?: string, size?: number }>} pdfResources
 * @returns {ResolvedItem[]}
 */
function resolveAllFileItems(courseDir, sectionId, notes, pdfResources) {
  const entries = listFilesSectionEntries(courseDir, sectionId);
  return entries.map((e) => resolveFileItem(e, notes, pdfResources)).filter(Boolean);
}

/**
 * Given a /files/<category>/<basename>.pdf URL, return the URL of the
 * optional .tex companion if it exists on disk.
 * Returns null if the input is not a PDF or the tex file is missing.
 */
/**
 * @param {string} url
 * @returns {CompanionFile | null}
 */
function getTexCompanion(url) {
  if (!url) return null;
  if (!/\.pdf(\?|#|$)/i.test(url)) return null;
  const ref = url.replace(/^\/files\//, '').split(/[?#]/)[0];
  const decoded = decodeURIComponent(ref);
  const diskPath = path.join(process.cwd(), 'source', 'files', decoded.replace(/\.pdf$/i, '.tex'));
  if (!fs.existsSync(diskPath)) return null;
  return { url: `/files/${decoded.replace(/\.pdf$/i, '.tex')}`, diskPath };
}

/**
 * Given a /files/<category>/<basename>.pdf URL, return the URL of the
 * optional .md companion if it exists on disk. Same shape as getTexCompanion.
 */
/**
 * @param {string} url
 * @returns {CompanionFile | null}
 */
function getMdCompanion(url) {
  if (!url) return null;
  if (!/\.pdf(\?|#|$)/i.test(url)) return null;
  const ref = url.replace(/^\/files\//, '').split(/[?#]/)[0];
  const decoded = decodeURIComponent(ref);
  const diskPath = path.join(process.cwd(), 'source', 'files', decoded.replace(/\.pdf$/i, '.md'));
  if (!fs.existsSync(diskPath)) return null;
  return { url: `/files/${decoded.replace(/\.pdf$/i, '.md')}`, diskPath };
}

/**
 * Given a /files/<category>/<basename>.pdf URL, return the disk path where
 * a .tex companion would be stored. No existence check.
 */
function getTexCompanionDiskPath(url) {
  if (!url) return null;
  if (!/\.pdf(\?|#|$)/i.test(url)) return null;
  const ref = url.replace(/^\/files\//, '').split(/[?#]/)[0];
  const decoded = decodeURIComponent(ref);
  return path.join(process.cwd(), 'source', 'files', decoded.replace(/\.pdf$/i, '.tex'));
}

function sectionIdForTitle(title, taken) {
  const safe = String(title || '').trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ');
  if (!safe) return 'section';
  if (!taken.has(safe)) return safe;
  let i = 2;
  while (taken.has(`${safe}-${i}`)) i += 1;
  return `${safe}-${i}`;
}

export {
  readCourseDir,
  readTextSection,
  readFilesSection,
  readSection,
  listAllSections,
  listFilesSectionEntries,
  resolveFileItem,
  resolveAllFileItems,
  getTexCompanion,
  getMdCompanion,
  getTexCompanionDiskPath,
  sectionIdForTitle,
};
