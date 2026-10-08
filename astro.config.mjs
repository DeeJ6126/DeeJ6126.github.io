import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: { theme: listingsTheme },
  },
});
