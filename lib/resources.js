const fs = require('node:fs')
const path = require('node:path')

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function humanize(value) {
  return path.basename(value, path.extname(value)).replace(/[_-]+/g, ' ').trim()
}

function numberOrDefault(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .flatMap(entry => {
      const absolutePath = path.join(directory, entry.name)
      return entry.isDirectory() ? walkFiles(absolutePath) : [absolutePath]
    })
}

function scanResources({ filesDir, metadata = {} }) {
  const categories = metadata.categories || {}
  const files = metadata.files || {}

  return walkFiles(filesDir)
    .map(absolutePath => {
      const relativePath = toPosix(path.relative(filesDir, absolutePath))
      const category = relativePath.includes('/') ? relativePath.split('/')[0] : 'other'
      const categoryMeta = categories[category] || {}
      const fileMeta = files[relativePath] || {}
      const stat = fs.statSync(absolutePath)

      return {
        absolutePath,
        category,
        categoryOrder: numberOrDefault(categoryMeta.order, 9999),
        categoryTitle: categoryMeta.title || humanize(category),
        extension: path.extname(relativePath).toLowerCase(),
        order: numberOrDefault(fileMeta.order, 9999),
        relativePath,
        shareUrl: fileMeta.shareUrl || undefined,
        size: stat.size,
        title: fileMeta.title || humanize(relativePath),
        url: `/files/${relativePath.split('/').map(encodeURIComponent).join('/')}`
      }
    })
    .sort((left, right) =>
      left.categoryOrder - right.categoryOrder ||
      left.categoryTitle.localeCompare(right.categoryTitle, 'zh-CN') ||
      left.order - right.order ||
      left.title.localeCompare(right.title, 'zh-CN')
    )
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function renderResourceCatalog(resources) {
  if (resources.length === 0) return '<p>暂无资料。</p>'

  const groups = new Map()
  for (const resource of resources) {
    if (!groups.has(resource.category)) {
      groups.set(resource.category, {
        title: resource.categoryTitle,
        resources: []
      })
    }
    groups.get(resource.category).resources.push(resource)
  }

  const sections = Array.from(groups.values()).map(group => {
    const items = group.resources.map(resource =>
      `<li><a href="${escapeHtml(resource.url)}">${escapeHtml(resource.title)}</a> <small>${escapeHtml(resource.extension.slice(1).toUpperCase())} · ${formatBytes(resource.size)}</small></li>`
    ).join('')

    return `<section class="resource-group"><h2>${escapeHtml(group.title)}</h2><ul>${items}</ul></section>`
  }).join('')

  return `<p>共 ${resources.length} 份资料，目录随站点构建自动更新。</p>${sections}`
}

module.exports = {
  renderResourceCatalog,
  scanResources
}
