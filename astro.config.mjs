import { defineConfig } from 'astro/config';
import { createRequire } from 'node:module';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkPaperMarkdown, { rehypePaperTables } from './lib/paper-markdown.mjs';

// Resolve the stylesheet beside the renderer's own KaTeX dependency.
// The direct KaTeX package can use a different DOM/CSS class vocabulary.
const require = createRequire(import.meta.url);
const requireFromMathRenderer = createRequire(require.resolve('rehype-katex'));
const mathStylesheet = requireFromMathRenderer.resolve('katex/dist/katex.min.css');

const listingsTheme = {
  name: 'latex-listings',
  type: 'light',
  colors: {
    'editor.background': '#fbfcfe',
    'editor.foreground': '#172e61',
  },
  tokenColors: [
    {
      scope: ['keyword', 'storage', 'storage.type', 'support.type'],
      settings: { foreground: '#1d4f91', fontStyle: 'bold' },
    },
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: '#7b8493', fontStyle: 'italic' },
    },
    {
      scope: ['string', 'constant.other.symbol'],
      settings: { foreground: '#176b4d', fontStyle: 'bold' },
    },
    {
      scope: ['variable.language', 'variable.language.this', 'variable.language.self'],
      settings: { foreground: '#bd3b79', fontStyle: 'bold' },
    },
    {
      scope: ['constant.numeric', 'constant.language'],
      settings: { foreground: '#7b3fa1' },
    },
  ],
};

export default defineConfig({
  site: 'https://DeeJ6126.github.io',
  output: 'static',
  server: { host: '::' },
  vite: { resolve: { alias: { 'katex/dist/katex.min.css': mathStylesheet } } },
  markdown: {
    remarkPlugins: [remarkMath, remarkPaperMarkdown],
    rehypePlugins: [rehypeKatex, rehypePaperTables],
    shikiConfig: { theme: listingsTheme },
  },
});
