const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

const { validateContent } = require('../lib/content-quality')
const { scanResources } = require('../lib/resources')

const projectRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(projectRoot, 'source')
const metadataPath = path.join(sourceDir, '_data', 'resources.yml')
const metadata = fs.existsSync(metadataPath)
  ? yaml.load(fs.readFileSync(metadataPath, 'utf8')) || {}
  : {}
const filesDir = path.join(sourceDir, 'files')
const allowMissingFiles = !fs.existsSync(filesDir)
const resources = scanResources({
  filesDir,
  metadata
})
const result = validateContent({ sourceDir, resources, metadata, allowMissingFiles })

if (allowMissingFiles) console.warn('WARN  source/files 不在当前检出中，跳过本地 PDF 存在性检查。')

for (const warning of result.warnings) console.warn(`WARN  ${warning}`)
for (const error of result.errors) console.error(`ERROR ${error}`)

if (result.errors.length > 0) {
  console.error(`\n内容检查失败：${result.errors.length} 个错误。`)
  process.exitCode = 1
} else {
  console.log(`内容检查通过：${resources.length} 份资料，未发现错误。`)
}
