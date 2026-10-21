'use strict';

function filterCourseTitles(entries, query) {
  const normalized = String(query || '').trim().toLocaleLowerCase('zh-CN');
  if (!normalized) return entries;
  return entries.filter(entry => String(entry.title || '').toLocaleLowerCase('zh-CN').includes(normalized));
}

module.exports = { filterCourseTitles };
