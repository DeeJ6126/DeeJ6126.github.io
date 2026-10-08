'use strict';

const path = require('node:path');
const { verifyImportedCourseNotes } = require('../lib/course-import');

const root = path.resolve(__dirname, '..');
try {
  const count = verifyImportedCourseNotes(
    path.join(root, 'course-sources.yml'),
    path.join(root, 'src/content/notes'),
  );
  console.log(`Verified ${count} imported course notes.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
