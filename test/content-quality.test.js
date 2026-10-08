const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { validateContent } = require('../lib/content-quality')
const { scanResources } = require('../lib/resources')

function write(root, relativePath, content = '') {
  const target = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

test('validateContent reports incomplete posts, missing assets, and stale metadata', t => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-quality-invalid-'))
  t.after(() => fs.rmSync(sourceDir, { recursive: true, force: true }))

  write(sourceDir, '_posts/broken.md', `---
title: Broken
date: 2026-01-01
cover: /img/missing.png
---
[Missing PDF](/files/course/missing.pdf)
`)
  write(sourceDir, 'files/course/present.pdf', 'pdf')

  const metadata = {
    files: {
      'course/removed.pdf': { title: 'Removed' }
    }
  }
  const resources = scanResources({ filesDir: path.join(sourceDir, 'files'), metadata })
  const result = validateContent({ sourceDir, resources, metadata })

  assert.ok(result.errors.some(error => error.includes('description')))
  assert.ok(result.errors.some(error => error.includes('categories')))
  assert.ok(result.errors.some(error => error.includes('tags')))
  assert.ok(result.errors.some(error => error.includes('/img/missing.png')))
  assert.ok(result.errors.some(error => error.includes('/files/course/missing.pdf')))
  assert.ok(result.errors.some(error => error.includes('course/removed.pdf')))
})

test('validateContent accepts complete posts and existing local assets', t => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-quality-valid-'))
  t.after(() => fs.rmSync(sourceDir, { recursive: true, force: true }))

  write(sourceDir, '_posts/valid.md', `---
title: Valid
date: 2026-01-01
description: Complete post
cover: /img/cover.png
categories:
  - Notes
tags:
  - Test
---
[PDF](/files/course/notes.pdf)
`)
  write(sourceDir, 'img/cover.png', 'image')
  write(sourceDir, 'files/course/notes.pdf', 'pdf')

  const metadata = {
    files: {
      'course/notes.pdf': { title: 'Notes' }
    }
  }
  const resources = scanResources({ filesDir: path.join(sourceDir, 'files'), metadata })
  const result = validateContent({ sourceDir, resources, metadata })

  assert.deepEqual(result.errors, [])
})

test('validateContent parses posts that use Windows line endings', t => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-quality-crlf-'))
  t.after(() => fs.rmSync(sourceDir, { recursive: true, force: true }))

  const post = `---
title: Windows post
date: 2026-01-01
description: Complete post
categories:
  - Notes
tags:
  - Test
---
Content
`.replaceAll('\n', '\r\n')
  write(sourceDir, '_posts/windows.md', post)

  const result = validateContent({ sourceDir, resources: [], metadata: {} })

  assert.deepEqual(result.errors, [])
})

test('validateContent can validate a clean clone without ignored PDF files', t => {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-quality-no-pdfs-'))
  t.after(() => fs.rmSync(sourceDir, { recursive: true, force: true }))
  write(sourceDir, '_posts/valid.md', `---
title: Valid
date: 2026-01-01
description: Complete post
categories: [Notes]
tags: [Test]
---
[PDF](/files/course/notes.pdf)
`)
  const metadata = { files: { 'course/notes.pdf': { title: 'Notes' } } }
  const result = validateContent({ sourceDir, resources: [], metadata, allowMissingFiles: true })
  assert.deepEqual(result.errors, [])
})
