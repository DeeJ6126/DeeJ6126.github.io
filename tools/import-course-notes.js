'use strict';

const path = require('node:path');
const { importCourseSources } = require('../lib/course-import');

const root = path.resolve(__dirname, '..');
const write = process.argv.includes('--write');

try {
  const writes = importCourseSources(
    path.join(root, 'course-sources.yml'),
    path.join(root, 'src/content/notes'),
    { write },
  );
  console.log(`${write ? 'Imported' : 'Checked'} ${writes.filter(item => !item.binary).length} course notes.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
