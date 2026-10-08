import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const courses = defineCollection({
  loader: glob({
    pattern: '*/_meta.md',
    base: './src/content/courses',
    generateId: ({ entry }) => entry.replace(/\/_meta\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    discipline: z.enum(['biology', 'bioinformatics', 'ai']),
    order: z.number().int().positive(),
    summary: z.string(),
    cover: z.string().optional(),
    coverStyle: z.enum(['image', 'zoology', 'botany', 'molecular', 'microbiology', 'anndata', 'r', 'scanpy', 'd2l', 'generative']).default('image'),
    resourceCategory: z.string().optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    course: z.string(),
    order: z.number().int().positive(),
    source: z.string(),
    shareUrl: z.string().url().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    order: z.number().int().positive(),
    year: z.number().int(),
    status: z.string(),
    summary: z.string(),
    cover: z.string(),
    background: z.string(),
    process: z.array(z.object({ title: z.string(), description: z.string() })).min(1),
    outcomes: z.array(z.object({ title: z.string(), caption: z.string(), image: z.string() })).min(1),
    technologies: z.array(z.string()).min(1),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
    accent: z.enum(['blue', 'cyan', 'lime']).default('blue'),
  }),
});

export const collections = { courses, notes, projects };
