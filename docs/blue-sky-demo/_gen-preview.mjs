// Generate per-scene preview variants of the blue-sky demo.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('E:/BlogFile/docs/blue-sky-demo/index.html', 'utf8');
const scenes = ['s1', 's2', 's3', 's4', 's5', 's6'];

for (const s of scenes) {
  const variant = src.replace(
    "const forced = new URLSearchParams(location.search).get('scene');",
    `const forced = '${s}'; // forced scene for preview`
  );
  writeFileSync(`E:/BlogFile/docs/blue-sky-demo/_prev-${s}.html`, variant, 'utf8');
  console.log(`generated _prev-${s}.html`);
}
