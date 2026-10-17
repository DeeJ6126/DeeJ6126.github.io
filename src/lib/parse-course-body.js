'use strict';

/**
 * Resolve parsed file items to display-ready data using the notes collection
 * and the `loadPdfResources()` output. This is a display-time concern; the
 * admin path does not need it.
 *
 * @param {Array<{ title: string, url: string, shareUrl: string | null }>} items
 * @param {Array<{ id: string, data: { shareUrl?: string } }>} notes
 * @param {Array<{ relativePath: string, size: number, shareUrl?: string }>} pdfResources
 * @returns {Array<{ kind: 'pdf' | 'markdown', title: string, url: string, shareUrl: string | null, size?: number, entry?: unknown }>}
 */
function resolveFileItems(items, notes = [], pdfResources = []) {
  const noteById = new Map();
  for (const note of notes) noteById.set(note.id, note);

  return items.map((item) => {
    const isPdf = /\.pdf(\?|#|$)/i.test(item.url);
    if (isPdf) {
      const ref = item.url.replace(/^\/files\//, '').split(/[?#]/)[0];
      const decoded = decodeURIComponent(ref);
      const resource = pdfResources.find((r) => r.relativePath === decoded || r.relativePath === ref);
      return {
        kind: 'pdf',
        title: item.title,
        url: item.url,
        shareUrl: item.shareUrl || resource?.shareUrl || null,
        size: resource?.size || 0,
      };
    }
    const m = item.url.match(/^\/downloads\/notes\/(.+)\.md$/);
    const id = m ? m[1] : null;
    const note = id ? noteById.get(id) : null;
    return {
      kind: 'markdown',
      title: item.title,
      url: item.url,
      shareUrl: item.shareUrl || note?.data?.shareUrl || null,
      entry: note,
    };
  });
}

/**
 * Parse a course .md body into intro + ordered sections.
 *
 * Sections are delimited by second-level headings (`## `).
 * Section type is marked by an HTML comment on the same line as the heading:
 *   ## 课程笔记 <!-- type:files -->
 * If no marker is present, the section defaults to 'text'.
 *
 * For 'files' sections, file items are extracted from leading `- [text](url)` lines,
 * with optional `<!-- share:URL -->` annotations appended on the same line.
 *
 * @param {string} body
 * @returns {{
 *   intro: string,
 *   sections: Array<{
 *     title: string,
 *     id: string,
 *     type: 'text' | 'files',
 *     body: string,
 *     items: Array<{ title: string, url: string, shareUrl: string | null, lineText: string }>,
 *   }>,
 * }}
 */
function parseCourseBody(body) {
  const source = String(body || '').replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const sections = [];
  let current = null;
  const introLines = [];

  const headingPattern = /^##\s+(.+?)\s*(?:<!--\s*type:(text|files)\s*-->)?\s*$/;

  for (const line of lines) {
    const match = line.match(headingPattern);
    if (match) {
      if (current) sections.push(current);
      current = {
        title: match[1].trim(),
        id: slugifySectionId(match[1].trim(), sections),
        type: match[2] || 'text',
        body: '',
        items: [],
      };
      continue;
    }
    if (current) current.body += (current.body ? '\n' : '') + line;
    else introLines.push(line);
  }
  if (current) sections.push(current);

  for (const section of sections) {
    section.body = section.body.replace(/^\n+|\n+$/g, '');
    if (section.type === 'files') {
      section.items = parseFileItems(section.body);
    }
  }

  return { intro: introLines.join('\n').replace(/^\n+|\n+$/g, ''), sections };
}

/**
 * Extract ordered file items from a files-section body.
 * Items are lines matching `^- [text](url)( <!-- share:URL -->)?$`.
 * Non-matching leading content (intro text) is preserved in the section body.
 */
function parseFileItems(body) {
  const items = [];
  const lines = String(body || '').split('\n');
  const itemPattern = /^-\s+\[([^\]]+)\]\(([^)]+)\)(?:\s*<!--\s*share:(\S+?)\s*-->)?\s*$/;
  for (const line of lines) {
    const match = line.match(itemPattern);
    if (!match) continue;
    items.push({
      title: match[1].trim(),
      url: match[2].trim(),
      shareUrl: match[3] || null,
      lineText: line,
    });
  }
  return items;
}

function slugifySectionId(title, existing) {
  const base = String(title || 'section').trim();
  const ascii = base
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const candidate = ascii || 'section';
  const taken = new Set(existing.map(s => s.id));
  if (!taken.has(candidate)) return candidate;
  let i = 2;
  while (taken.has(`${candidate}-${i}`)) i += 1;
  return `${candidate}-${i}`;
}

/**
 * Insert a new section into a body string.
 * If `after` is provided and matches an existing section title, insert after that section.
 * Otherwise append at end.
 */
function insertSection(body, { title, type = 'text', after = null }) {
  const safeTitle = String(title || '').trim();
  if (!safeTitle) throw new Error('Section title is required');
  if (type !== 'text' && type !== 'files') throw new Error(`Invalid section type: ${type}`);
  const lines = String(body || '').split('\n');
  const heading = makeHeading(safeTitle, type);
  const block = `${heading}\n\n`;
  if (after) {
    let i = lines.length;
    for (let idx = 0; idx < lines.length; idx += 1) {
      if (lines[idx].match(new RegExp(`^##\\s+${escapeRegExp(after)}\\b`))) {
        // find end of this section (next ## or EOF)
        let end = lines.length;
        for (let j = idx + 1; j < lines.length; j += 1) {
          if (/^##\s+/.test(lines[j])) { end = j; break; }
        }
        i = end;
        break;
      }
    }
    return lines.slice(0, i).join('\n') + (i > 0 ? '\n\n' : '') + block + lines.slice(i).join('\n');
  }
  return lines.join('\n') + (lines.length && lines[lines.length - 1] !== '' ? '\n\n' : '\n') + block;
}

/**
 * Delete a section by title. Returns the new body and the removed body content.
 */
function deleteSection(body, title) {
  const lines = String(body || '').split('\n');
  const startIdx = lines.findIndex(line => line.match(new RegExp(`^##\\s+${escapeRegExp(title)}\\b`)));
  if (startIdx < 0) return { body, removed: null };
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) { endIdx = i; break; }
  }
  const removed = lines.slice(startIdx, endIdx).join('\n').trim();
  // also remove leading blank line if present
  let trimStart = endIdx;
  while (trimStart < lines.length && lines[trimStart] === '') trimStart += 1;
  const before = lines.slice(0, startIdx);
  const after = lines.slice(trimStart);
  // also drop trailing blank lines from before
  while (before.length && before[before.length - 1] === '') before.pop();
  return {
    body: [...before, ...after].join('\n').replace(/^\n+|\n+$/g, '') + (after.length ? '\n' : ''),
    removed,
  };
}

/**
 * Reorder a section by title. direction is 'up' or 'down'.
 * Swaps the section with the adjacent section in body order.
 */
function reorderSection(body, title, direction) {
  const parsed = parseCourseBody(body);
  const idx = parsed.sections.findIndex(s => s.title === title);
  if (idx < 0) return { body, error: `Section not found: ${title}` };
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= parsed.sections.length) return { body, error: 'Already at boundary' };
  const ordered = [...parsed.sections];
  [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
  return { body: serializeBody({ intro: parsed.intro, sections: ordered }), error: null };
}

/**
 * Append a file item to a files-type section.
 */
function appendFileItem(body, sectionTitle, { title, url, shareUrl = null }) {
  const parsed = parseCourseBody(body);
  const section = parsed.sections.find(s => s.title === sectionTitle);
  if (!section) return { body, error: `Section not found: ${sectionTitle}` };
  if (section.type !== 'files') return { body, error: `Section is not type=files: ${sectionTitle}` };
  const line = formatFileItem({ title, url, shareUrl });
  if (section.body && section.body.trim()) {
    section.body = section.body.replace(/\n+$/, '') + '\n' + line;
  } else {
    section.body = line;
  }
  return { body: serializeBody({ intro: parsed.intro, sections: parsed.sections }), error: null };
}

/**
 * Remove a file item by URL from a section.
 */
function removeFileItem(body, sectionTitle, url) {
  const parsed = parseCourseBody(body);
  const section = parsed.sections.find(s => s.title === sectionTitle);
  if (!section) return { body, error: `Section not found: ${sectionTitle}` };
  if (section.type !== 'files') return { body, error: `Section is not type=files: ${sectionTitle}` };
  const lines = section.body.split('\n').filter(line => !line.match(new RegExp(`^-\\s+\\[[^\\]]+\\]\\(${escapeRegExp(url)}\\)`)));
  section.body = lines.join('\n').replace(/^\n+|\n+$/g, '');
  return { body: serializeBody({ intro: parsed.intro, sections: parsed.sections }), error: null };
}

function formatFileItem({ title, url, shareUrl }) {
  const safeTitle = String(title || '').replace(/[\[\]]/g, '');
  const safeUrl = String(url || '').trim();
  if (!safeUrl) throw new Error('File URL is required');
  const share = shareUrl ? ` <!-- share:${shareUrl} -->` : '';
  return `- [${safeTitle}](${safeUrl})${share}`;
}

function makeHeading(title, type) {
  return type === 'files' ? `## ${title} <!-- type:files -->` : `## ${title}`;
}

function serializeBody({ intro, sections }) {
  const parts = [];
  if (intro && intro.trim()) parts.push(intro.trim());
  for (const section of sections) {
    const heading = makeHeading(section.title, section.type);
    const body = section.body && section.body.trim() ? '\n\n' + section.body.trim() : '';
    parts.push(heading + body);
  }
  return parts.join('\n\n') + (parts.length ? '\n' : '');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  parseCourseBody,
  parseFileItems,
  resolveFileItems,
  insertSection,
  deleteSection,
  reorderSection,
  appendFileItem,
  removeFileItem,
  formatFileItem,
  slugifySectionId,
  serializeBody,
};
