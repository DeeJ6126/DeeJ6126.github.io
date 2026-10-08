// Direct markdown → HTML compiler for course text sections.
//
// Why this exists: the v2 course layout stores text sections as plain
// `<id>.md` files inside `src/content/courses/<slug>/`, not as entries of
// the `courses` content collection. The previous code wrapped them in a
// fake `CollectionEntry` and called `render()` from `astro:content`, which
// in Astro 7 fails schema validation against the strict `courses` schema
// (the fake entry is missing `discipline` / `summary` etc.), silently
// returning an empty Content component.
//
// This module compiles the raw markdown body through the same plugin
// chain that astro.config.mjs wires into the build pipeline, so math
// blocks, GFM, smartypants, and Katex rendering all work the same way
// they do for regular content-collection markdown.

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkSmartypants)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeStringify)
  .freeze();

export async function compileMarkdown(body: string): Promise<string> {
  if (!body || !body.trim()) return '';
  const file = await processor.process(body);
  return String(file);
}
