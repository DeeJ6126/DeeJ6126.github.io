import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { CollectionEntry } from 'astro:content';

export type PdfResource = {
  category: string;
  extension: string;
  order: number;
  relativePath: string;
  size: number;
  shareUrl?: string;
  title: string;
  url: string;
};

export const disciplineOrder = ['biology', 'bioinformatics', 'ai'] as const;

export const disciplineLabels = {
  biology: { title: '生物科学', english: 'BIOLOGICAL SCIENCE' },
  bioinformatics: { title: '生物信息', english: 'BIOINFORMATICS' },
  ai: { title: '人工智能', english: 'ARTIFICIAL INTELLIGENCE' },
} as const;

export function sortCourses(courses: CollectionEntry<'courses'>[]) {
  return [...courses].sort((left, right) => {
    const discipline = disciplineOrder.indexOf(left.data.discipline) - disciplineOrder.indexOf(right.data.discipline);
    return discipline || left.data.order - right.data.order || left.data.title.localeCompare(right.data.title, 'zh-CN');
  });
}

export function loadPdfResources(root = process.cwd()): PdfResource[] {
  const metadataPath = path.join(root, 'source/_data/resources.yml');
  const metadata = fs.existsSync(metadataPath)
    ? yaml.load(fs.readFileSync(metadataPath, 'utf8')) as { files?: Record<string, { order?: number; shareUrl?: string; title?: string }> }
    : {};
  const filesDir = path.join(root, 'source/files');
  if (!fs.existsSync(filesDir)) return [];

  return fs.readdirSync(filesDir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const absolutePath = path.join(entry.parentPath, entry.name);
      const relativePath = path.relative(filesDir, absolutePath).split(path.sep).join('/');
      const configured = metadata.files?.[relativePath] ?? {};
      return {
        category: relativePath.includes('/') ? relativePath.split('/')[0] : 'other',
        extension: path.extname(relativePath).toLowerCase(),
        order: Number(configured.order ?? 9999),
        relativePath,
        shareUrl: configured.shareUrl,
        size: fs.statSync(absolutePath).size,
        title: configured.title ?? path.basename(relativePath, path.extname(relativePath)).replace(/[_-]+/g, ' '),
        url: `/files/${relativePath.split('/').map(encodeURIComponent).join('/')}`,
      };
    })
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title, 'zh-CN'));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
