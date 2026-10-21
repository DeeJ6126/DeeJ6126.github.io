function buildSearchIndex(resources) {
  const list = Array.isArray(resources) ? resources : []
  return list.map(resource => ({
    categories: [resource.categoryTitle],
    excerpt: resource.relativePath,
    tags: ['资料'],
    title: resource.title,
    type: 'resource',
    url: resource.url,
  }))
}

module.exports = { buildSearchIndex }
