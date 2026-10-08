const assert = require('node:assert/strict')
const test = require('node:test')

const {
  parseCourseBody,
  insertSection,
  deleteSection,
  reorderSection,
  appendFileItem,
  removeFileItem,
  formatFileItem,
} = require('../src/lib/parse-course-body')

test('parseCourseBody splits intro, single section, and detects type marker', () => {
  const body = [
    'Intro paragraph line 1.',
    'Intro paragraph line 2.',
    '',
    '## 课程感想 <!-- type:files -->',
    '',
    '- [A](/files/x.pdf)',
    '- [B](/files/y.pdf)',
  ].join('\n')

  const parsed = parseCourseBody(body)
  assert.equal(parsed.intro, 'Intro paragraph line 1.\nIntro paragraph line 2.')
  assert.equal(parsed.sections.length, 1)
  const s = parsed.sections[0]
  assert.equal(s.title, '课程感想')
  assert.equal(s.type, 'files')
  assert.equal(s.id, '课程感想')
  assert.equal(s.items.length, 2)
  assert.equal(s.items[0].title, 'A')
  assert.equal(s.items[0].url, '/files/x.pdf')
  assert.equal(s.items[1].title, 'B')
  assert.equal(s.items[1].url, '/files/y.pdf')
})

test('parseCourseBody defaults section type to text when no marker', () => {
  const parsed = parseCourseBody('intro\n\n## 课程感想\n\n正文段落。')
  assert.equal(parsed.sections[0].type, 'text')
  assert.equal(parsed.sections[0].body, '正文段落。')
  assert.equal(parsed.sections[0].items.length, 0)
})

test('parseCourseBody handles multiple sections and preserves order', () => {
  const body = [
    'intro',
    '',
    '## 第一节',
    'text 1',
    '## 第二节',
    'text 2',
    '## 第三节',
    'text 3',
  ].join('\n')
  const parsed = parseCourseBody(body)
  assert.equal(parsed.sections.length, 3)
  assert.deepEqual(parsed.sections.map(s => s.title), ['第一节', '第二节', '第三节'])
  assert.deepEqual(parsed.sections.map(s => s.body), ['text 1', 'text 2', 'text 3'])
})

test('parseCourseBody extracts shareUrl from HTML comment annotation', () => {
  const body = [
    '## 课程笔记 <!-- type:files -->',
    '',
    '- [第一章](/files/zoology/Ch1.pdf) <!-- share:https://share.mubu.com/doc/abc -->',
    '- [第二章](/files/zoology/Ch2.pdf)',
  ].join('\n')
  const parsed = parseCourseBody(body)
  assert.equal(parsed.sections[0].items[0].shareUrl, 'https://share.mubu.com/doc/abc')
  assert.equal(parsed.sections[0].items[1].shareUrl, null)
})

test('parseCourseBody returns empty intro when no preamble exists', () => {
  const parsed = parseCourseBody('## 课程感想\n\n正文')
  assert.equal(parsed.intro, '')
  assert.equal(parsed.sections.length, 1)
})

test('parseCourseBody handles empty body', () => {
  const parsed = parseCourseBody('')
  assert.equal(parsed.intro, '')
  assert.equal(parsed.sections.length, 0)
})

test('parseCourseBody normalizes CRLF line endings', () => {
  const body = 'intro\r\n\r\n## 课程感想\r\n\r\n正文'
  const parsed = parseCourseBody(body)
  assert.equal(parsed.intro, 'intro')
  assert.equal(parsed.sections[0].body, '正文')
})

test('insertSection appends to end when no `after`', () => {
  const before = '## A\n\na body'
  const after = insertSection(before, { title: 'B', type: 'text' })
  const parsed = parseCourseBody(after)
  assert.deepEqual(parsed.sections.map(s => s.title), ['A', 'B'])
  assert.equal(parsed.sections[1].body, '')
})

test('insertSection inserts after the named section', () => {
  const before = '## A\n\na body\n\n## C\n\nc body'
  const after = insertSection(before, { title: 'B', type: 'files', after: 'A' })
  const parsed = parseCourseBody(after)
  assert.deepEqual(parsed.sections.map(s => s.title), ['A', 'B', 'C'])
  assert.equal(parsed.sections[1].type, 'files')
})

test('insertSection rejects empty title and invalid type', () => {
  assert.throws(() => insertSection('body', { title: '' }), /title is required/)
  assert.throws(() => insertSection('body', { title: 'X', type: 'mixed' }), /Invalid section type/)
})

test('deleteSection removes the named section and trims surrounding blank lines', () => {
  const before = 'intro\n\n## A\n\na body\n\n## B\n\nb body'
  const { body, removed } = deleteSection(before, 'A')
  assert.match(removed, /## A/)
  const parsed = parseCourseBody(body)
  assert.deepEqual(parsed.sections.map(s => s.title), ['B'])
  assert.equal(parsed.intro, 'intro')
})

test('deleteSection returns unchanged body when title not found', () => {
  const { body, removed } = deleteSection('## A\n\nbody', 'Z')
  assert.equal(removed, null)
  assert.equal(body, '## A\n\nbody')
})

test('reorderSection swaps a section with its neighbor', () => {
  const before = '## A\n\n## B\n\n## C'
  const down = reorderSection(before, 'A', 'down')
  assert.equal(down.error, null)
  const parsedDown = parseCourseBody(down.body)
  assert.deepEqual(parsedDown.sections.map(s => s.title), ['B', 'A', 'C'])

  const up = reorderSection(before, 'C', 'up')
  assert.equal(up.error, null)
  const parsedUp = parseCourseBody(up.body)
  assert.deepEqual(parsedUp.sections.map(s => s.title), ['A', 'C', 'B'])
})

test('reorderSection reports boundary at first/last position', () => {
  const before = '## A\n\n## B'
  const result = reorderSection(before, 'A', 'up')
  assert.match(result.error, /boundary/)
})

test('appendFileItem adds a line to a files section', () => {
  const before = '## 课程笔记 <!-- type:files -->\n\n- [old](/files/old.pdf)'
  const { body, error } = appendFileItem(before, '课程笔记', { title: 'new', url: '/files/new.pdf', shareUrl: 'https://x' })
  assert.equal(error, null)
  const parsed = parseCourseBody(body)
  assert.equal(parsed.sections[0].items.length, 2)
  assert.equal(parsed.sections[0].items[1].url, '/files/new.pdf')
  assert.equal(parsed.sections[0].items[1].shareUrl, 'https://x')
})

test('appendFileItem rejects a non-files section', () => {
  const before = '## 课程感想\n\n文本'
  const { error } = appendFileItem(before, '课程感想', { title: 'x', url: '/y' })
  assert.match(error, /not type=files/)
})

test('removeFileItem removes a matching line by URL', () => {
  const before = [
    '## 课程笔记 <!-- type:files -->',
    '',
    '- [A](/files/a.pdf)',
    '- [B](/files/b.pdf) <!-- share:https://x -->',
  ].join('\n')
  const { body, error } = removeFileItem(before, '课程笔记', '/files/b.pdf')
  assert.equal(error, null)
  const parsed = parseCourseBody(body)
  assert.equal(parsed.sections[0].items.length, 1)
  assert.equal(parsed.sections[0].items[0].url, '/files/a.pdf')
})

test('formatFileItem escapes brackets in title', () => {
  const item = formatFileItem({ title: 'A [B] C', url: '/x.pdf' })
  assert.equal(item, '- [A B C](/x.pdf)')
})

test('formatFileItem requires URL', () => {
  assert.throws(() => formatFileItem({ title: 'x', url: '' }), /URL is required/)
})

test('parseCourseBody preserves intro text with embedded blank lines', () => {
  const body = 'line 1\n\nline 2\n\n## S\n\nbody'
  const parsed = parseCourseBody(body)
  assert.equal(parsed.intro, 'line 1\n\nline 2')
})
