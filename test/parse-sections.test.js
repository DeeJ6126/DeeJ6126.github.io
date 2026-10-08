const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const url = require('node:url')
const test = require('node:test')
const { execFileSync } = require('node:child_process')

const mjsFileUrl = url.pathToFileURL(path.resolve(__dirname, '..', 'src', 'lib', 'parse-sections.mjs')).href

function withFixture(body) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parse-sections-'))
  try { body(tmp) } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
}

function tmpDirUrl(p) { return url.pathToFileURL(p).href }

function evalMjs(script) {
  const tmpFile = path.join(os.tmpdir(), `parse-sections-eval-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
  fs.writeFileSync(tmpFile, script, 'utf8')
  try {
    return execFileSync(process.execPath, [tmpFile], { encoding: 'utf8' })
  } finally {
    try { fs.unlinkSync(tmpFile) } catch (_) {}
  }
}

test('readCourseDir reads _meta.md and returns front + manifest', () => {
  withFixture((dir) => {
    fs.writeFileSync(path.join(dir, '_meta.md'), '---\ntitle: 动物学\ndiscipline: biology\norder: 3\n---\n')
    fs.writeFileSync(path.join(dir, 'sections.yml'), '- id: 课程感想\n  type: text\n  title: 课程感想\n')
    const out = evalMjs(`
      import { readCourseDir } from ${JSON.stringify(mjsFileUrl)};
      const c = readCourseDir(${JSON.stringify(dir)});
      process.stdout.write(JSON.stringify({ meta: c.meta, manifest: c.manifest }));
    `)
    const result = JSON.parse(out)
    assert.equal(result.meta.title, '动物学')
    assert.equal(result.manifest.length, 1)
    assert.equal(result.manifest[0].id, '课程感想')
  })
})

test('listAllSections returns text body and files front', () => {
  withFixture((dir) => {
    fs.writeFileSync(path.join(dir, '_meta.md'), '---\ntitle: X\ndiscipline: biology\norder: 1\n---\n')
    fs.writeFileSync(path.join(dir, 'sections.yml'), [
      '- id: 感想',
      '  type: text',
      '  title: 感想',
      '- id: 笔记',
      '  type: files',
      '  title: 笔记',
    ].join('\n'))
    fs.writeFileSync(path.join(dir, '感想.md'), '---\ntitle: 感想\ntype: text\n---\n\n感想内容\n')
    fs.mkdirSync(path.join(dir, '笔记'), { recursive: true })
    fs.writeFileSync(path.join(dir, '笔记', '_section.md'), '---\ntitle: 笔记\ntype: files\nfiles:\n  - ref: /files/x.pdf\n    title: X\n---\n')
    const out = evalMjs(`
      import { listAllSections } from ${JSON.stringify(mjsFileUrl)};
      const s = listAllSections(${JSON.stringify(dir)});
      process.stdout.write(JSON.stringify(s));
    `)
    const sections = JSON.parse(out)
    assert.equal(sections.length, 2)
    assert.equal(sections[0].type, 'text')
    assert.equal(sections[0].body, '感想内容')
    assert.equal(sections[1].type, 'files')
    assert.equal(sections[1].files.length, 1)
    assert.equal(sections[1].files[0].ref, '/files/x.pdf')
  })
})

test('resolveFileItem returns pdf with size from resources', () => {
  withFixture((_dir) => {
    const out = evalMjs(`
      import { resolveFileItem } from ${JSON.stringify(mjsFileUrl)};
      const r = resolveFileItem(
        { ref: '/files/zoology/Ch1.pdf', title: 'Ch1' },
        [],
        [{ relativePath: 'zoology/Ch1.pdf', size: 1234, shareUrl: 'https://x' }]
      );
      process.stdout.write(JSON.stringify(r));
    `)
    const item = JSON.parse(out)
    assert.equal(item.kind, 'pdf')
    assert.equal(item.size, 1234)
    assert.equal(item.shareUrl, 'https://x')
  })
})

test('resolveFileItem returns image kind for /img/ ref', () => {
  withFixture((_dir) => {
    const out = evalMjs(`
      import { resolveFileItem } from ${JSON.stringify(mjsFileUrl)};
      const r = resolveFileItem({ ref: '/img/courses/zoology/课程笔记/fig1.png', title: 'fig1' }, [], []);
      process.stdout.write(JSON.stringify(r));
    `)
    const item = JSON.parse(out)
    assert.equal(item.kind, 'image')
    assert.equal(item.url, '/img/courses/zoology/课程笔记/fig1.png')
  })
})

test('sectionIdForTitle produces unique slugs', () => {
  withFixture((_dir) => {
    const out = evalMjs(`
      import { sectionIdForTitle } from ${JSON.stringify(mjsFileUrl)};
      const a = sectionIdForTitle('课程笔记', new Set());
      const b = sectionIdForTitle('课程笔记', new Set([a]));
      process.stdout.write(JSON.stringify({ a, b }));
    `)
    const r = JSON.parse(out)
    assert.equal(r.a, '课程笔记')
    assert.equal(r.b, '课程笔记-2')
  })
})
