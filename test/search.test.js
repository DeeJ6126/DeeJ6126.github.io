const assert = require('node:assert/strict')
const test = require('node:test')

const { buildSearchIndex } = require('../lib/search')
const { filterCourseTitles } = require('../lib/course-filter')

test('buildSearchIndex flattens resources into searchable records', () => {
  const index = buildSearchIndex([
    {
      category: 'ecology',
      categoryTitle: '生态学',
      relativePath: 'ecology/field.pdf',
      title: '野外实验',
      url: '/files/ecology/field.pdf',
    },
  ])

  assert.deepEqual(index, [
    {
      categories: ['生态学'],
      excerpt: 'ecology/field.pdf',
      tags: ['资料'],
      title: '野外实验',
      type: 'resource',
      url: '/files/ecology/field.pdf',
    },
  ])
})

test('buildSearchIndex returns an empty list when no resources are provided', () => {
  assert.deepEqual(buildSearchIndex([]), [])
  assert.deepEqual(buildSearchIndex(undefined), [])
})

test('filterCourseTitles matches course names only and ignores case', () => {
  const entries = [
    { title: 'AnnData', summary: '单细胞数据结构' },
    { title: '生态学', summary: 'AnnData 不应匹配摘要' },
  ]

  assert.deepEqual(filterCourseTitles(entries, 'ANNDATA').map(entry => entry.title), ['AnnData'])
  assert.deepEqual(filterCourseTitles(entries, '生态').map(entry => entry.title), ['生态学'])
  assert.deepEqual(filterCourseTitles(entries, ''), entries)
})
