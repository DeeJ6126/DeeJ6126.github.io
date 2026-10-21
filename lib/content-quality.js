const fs = require('node:fs')
const path = require('node:path')
const frontMatter = require('hexo-front-matter')

const REQUIRED_POST_FIELDS = ['title', 'date', 'description', 'categories', 'tags']

function walkMarkdown(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name)
    return entry.isDirectory()
      ? walkMarkdown(absolutePath)
      : entry.name.toLowerCase().endsWith('.md') ? [absolutePath] : []
  })
}

function extractLocalAssets(content, attributes = {}) {
  const references = []
  const markdownPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g
  const htmlPattern = /(?:src|href)=["']([^"']+)["']/g

  for (const pattern of [markdownPattern, htmlPattern]) {
    for (const match of content.matchAll(pattern)) references.push(match[1])
  }
  if (attributes.cover) references.push(String(attributes.cover))

  return references.filter(reference => reference.startsWith('/files/') || reference.startsWith('/img/'))
}

function sourcePathForUrl(sourceDir, url) {
  const cleanUrl = url.split(/[?#]/, 1)[0]
  try {
    return path.join(sourceDir, ...decodeURIComponent(cleanUrl).replace(/^\/+/, '').split('/'))
  } catch {
    return null
  }
}

function validateContent({ sourceDir, resources, metadata = {}, allowMissingFiles = false }) {
  const errors = []
  const warnings = []
  const postsDir = path.join(sourceDir, '_posts')

  for (const postPath of walkMarkdown(postsDir)) {
    const relativePost = path.relative(sourceDir, postPath).split(path.sep).join('/')
    const raw = fs.readFileSync(postPath, 'utf8')
    let attributes

    try {
      attributes = frontMatter.parse(raw.replaceAll('\r\n', '\n'))
    } catch (error) {
      errors.push(`${relativePost}: Front Matter 无法解析（${error.message}）`)
      continue
    }

    for (const field of REQUIRED_POST_FIELDS) {
      const value = attributes[field]
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        errors.push(`${relativePost}: 缺少必填 Front Matter 字段 ${field}`)
      }
    }

    for (const url of extractLocalAssets(attributes._content || '', attributes)) {
      const assetPath = sourcePathForUrl(sourceDir, url)
      if ((!assetPath || !fs.existsSync(assetPath)) && !(allowMissingFiles && url.startsWith('/files/'))) {
        errors.push(`${relativePost}: 本地资源不存在 ${url}`)
      }
    }
  }

  const resourcePaths = new Set(resources.map(resource => resource.relativePath.toLowerCase()))
  for (const configuredPath of allowMissingFiles ? [] : Object.keys(metadata.files || {})) {
    if (!resourcePaths.has(configuredPath.toLowerCase())) {
      errors.push(`source/_data/resources.yml: 配置指向不存在的文件 ${configuredPath}`)
    }
  }

  const seen = new Set()
  for (const resource of resources) {
    const normalized = resource.relativePath.toLowerCase()
    if (seen.has(normalized)) errors.push(`资料路径仅大小写不同，可能导致部署冲突：${resource.relativePath}`)
    seen.add(normalized)
  }

  return { errors, warnings }
}

module.exports = {
  extractLocalAssets,
  validateContent
}
