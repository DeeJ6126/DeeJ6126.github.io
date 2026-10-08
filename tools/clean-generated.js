'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
for (const directory of ['dist', '.astro', 'public']) {
  fs.rmSync(path.join(root, directory), { recursive: true, force: true });
}

console.log('Generated Astro output removed.');
