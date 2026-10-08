'use strict';

/**
 * Convert a Markdown file to PDF by rendering to HTML and printing via
 * Microsoft Edge headless. No LaTeX, no Chromium download — uses the
 * Edge browser that ships with Windows.
 *
 * Usage:
 *   node tools/render-md-to-pdf.js <input.md> [<output.pdf>]
 *
 * If output is omitted, derives from input basename (foo.md -> foo.pdf) in
 * the same directory.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findEdge() {
  for (const p of EDGE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function escapeHtml(s) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/**
 * Minimal markdown -> HTML. We avoid an extra dep by implementing the
 * subset we need: headings, bold, italic, code (inline + block),
 * lists (ordered + unordered), links, paragraphs, blockquotes, hr.
 * Anything more elaborate will be passed through after escaping.
 */
function mdToHtml(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let listType = null;
  let blockquote = false;

  const flushList = () => { if (listType) { html.push(`</${listType}>`); listType = null; } };
  const flushBlockquote = () => { if (blockquote) { html.push('</blockquote>'); blockquote = false; } };

  const inline = (s) => s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${escapeHtml(u)}">${escapeHtml(t)}</a>`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flushList(); flushBlockquote();
      if (inCode) { html.push('</code></pre>'); inCode = false; }
      else { html.push('<pre><code>'); inCode = true; }
      continue;
    }
    if (inCode) { html.push(escapeHtml(line) + '\n'); continue; }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushList(); flushBlockquote();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }
    if (/^[-*_]{3,}$/.test(line.trim())) { flushList(); flushBlockquote(); html.push('<hr>'); continue; }
    if (line.startsWith('> ')) {
      flushList();
      if (!blockquote) { html.push('<blockquote>'); blockquote = true; }
      html.push(`<p>${inline(escapeHtml(line.slice(2)))}</p>`);
      continue;
    } else { flushBlockquote(); }
    const ul = line.match(/^[-*]\s+(.+)$/);
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ul) {
      if (listType !== 'ul') { flushList(); html.push('<ul>'); listType = 'ul'; }
      html.push(`<li>${inline(escapeHtml(ul[1]))}</li>`);
      continue;
    }
    if (ol) {
      if (listType !== 'ol') { flushList(); html.push('<ol>'); listType = 'ol'; }
      html.push(`<li>${inline(escapeHtml(ol[1]))}</li>`);
      continue;
    }
    flushList();
    if (line.trim() === '') { html.push(''); continue; }
    html.push(`<p>${inline(escapeHtml(line))}</p>`);
  }
  flushList();
  flushBlockquote();
  if (inCode) html.push('</code></pre>');
  return html.join('\n');
}

function wrapHtml(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  body { font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif; font-size: 12pt; line-height: 1.65; color: #1a1a1a; max-width: 100%; }
  h1, h2, h3, h4, h5, h6 { font-weight: 800; line-height: 1.25; margin: 1.4em 0 0.5em; }
  h1 { font-size: 22pt; border-bottom: 2px solid #1a1a1a; padding-bottom: 0.15em; }
  h2 { font-size: 17pt; border-bottom: 1px solid #d0d0d0; padding-bottom: 0.1em; }
  h3 { font-size: 14pt; }
  h4 { font-size: 12.5pt; }
  p { margin: 0.6em 0; }
  a { color: #1265f3; text-decoration: none; }
  code { font-family: "Consolas", "JetBrains Mono", "Courier New", monospace; background: #f3f4f6; padding: 0.08em 0.35em; border-radius: 3px; font-size: 0.92em; }
  pre { background: #f3f4f6; padding: 12px 14px; border-radius: 4px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; font-size: 10.5pt; }
  blockquote { border-left: 3px solid #cbd2dc; padding: 4px 14px; color: #555f6e; margin: 0.8em 0; background: #f7f9fc; }
  ul, ol { margin: 0.6em 0; padding-left: 1.5em; }
  li { margin: 0.18em 0; }
  hr { border: none; border-top: 1px solid #d0d0d0; margin: 1.4em 0; }
  table { border-collapse: collapse; margin: 0.8em 0; }
  th, td { border: 1px solid #cbd2dc; padding: 4px 8px; }
  th { background: #f0f3f8; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node tools/render-md-to-pdf.js <input.md> [<output.pdf>]');
    process.exit(2);
  }
  const inputMd = path.resolve(args[0]);
  if (!fs.existsSync(inputMd)) { console.error(`not found: ${inputMd}`); process.exit(1); }
  const outputPdf = path.resolve(args[1] || inputMd.replace(/\.md$/i, '.pdf'));
  const edge = findEdge();
  if (!edge) { console.error('Microsoft Edge not found in standard locations'); process.exit(1); }

  const md = fs.readFileSync(inputMd, 'utf8');
  const title = path.basename(inputMd).replace(/\.md$/i, '');
  const body = mdToHtml(md);
  const html = wrapHtml(title, body);

  const tmpHtml = path.join(require('node:os').tmpdir(), `render-md-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');
  const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/');

  console.log(`[render] ${inputMd} -> ${outputPdf}`);
  const r = spawnSync(edge, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--print-to-pdf=${outputPdf}`,
    '--no-pdf-header-footer',
    fileUrl,
  ], { stdio: ['ignore', 'inherit', 'pipe'] });
  // Filter libpng/QB warnings that always appear on stderr (cosmetic, not errors)
  const stderr = (r.stderr || Buffer.alloc(0)).toString();
  const realStderr = stderr.split('\n').filter((l) => !/(libpng|QQBrowser|fallback task provider)/i.test(l)).join('\n').trim();
  if (realStderr) process.stderr.write(realStderr + '\n');
  try { fs.unlinkSync(tmpHtml); } catch (_) {}
  if (r.status !== 0) { console.error(`Edge exited with ${r.status}`); process.exit(r.status || 1); }
  console.log(`[render] OK -> ${outputPdf}`);
}

main();
