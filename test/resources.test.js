const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { renderResourceCatalog, scanResources } = require('../lib/resources')

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-resources-'))
  fs.mkdirSync(path.join(root, 'biology'), { recursive: true })
  fs.mkdirSync(path.join(root, 'ecology'), { recursive: true })
  fs.writeFileSync(path.join(root, 'biology', 'chapter_two.pdf'), 'biology')
  fs.writeFileSync(path.join(root, 'ecology', 'field notes.pdf'), 'ecology')
  return root
}

test('scanResources discovers nested files and applies metadata with stable ordering', t => {
  const filesDir = makeFixture()
  t.after(() => fs.rmSync(filesDir, { recursive: true, force: true }))

  const resources = scanResources({
    filesDir,
    metadata: {
      categories: {
        ecology: { title: '生态学', order: 1 },
        biology: { title: '生物学', order: 2 }
      },
      files: {
        'biology/chapter_two.pdf': { title: '第二章', order: 3, shareUrl: 'https://share.mubu.com/doc/example' }
      }
    }
  })

  assert.deepEqual(
    resources.map(({ category, categoryTitle, relativePath, shareUrl, title, url }) => ({
      category,
      categoryTitle,
      relativePath,
      shareUrl,
      title,
      url
    })),
    [
      {
        category: 'ecology',
        categoryTitle: '生态学',
        relativePath: 'ecology/field notes.pdf',
        shareUrl: undefined,
        title: 'field notes',
        url: '/files/ecology/field%20notes.pdf'
      },
      {
        category: 'biology',
        categoryTitle: '生物学',
        relativePath: 'biology/chapter_two.pdf',
        shareUrl: 'https://share.mubu.com/doc/example',
        title: '第二章',
        url: '/files/biology/chapter_two.pdf'
      }
    ]
  )
})

test('renderResourceCatalog groups resources and escapes metadata text', () => {
  const html = renderResourceCatalog([
    {
      category: 'biology',
      categoryTitle: '生物学 <资料>',
      extension: '.pdf',
      relativePath: 'biology/chapter.pdf',
      size: 1536,
      title: '章节 <一>',
      url: '/files/biology/chapter.pdf'
    }
  ])

  assert.match(html, /生物学 &lt;资料&gt;/)
  assert.match(html, /章节 &lt;一&gt;/)
  assert.match(html, /1\.5 KB/)
  assert.doesNotMatch(html, /<资料>/)
})
