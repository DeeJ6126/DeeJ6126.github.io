// Obsidian reading view preserves soft line breaks and explicit image widths.
// Keep these rules scoped to paper notes so course/project Markdown is unchanged.
export default function remarkPaperMarkdown() {
  const processor = this;
  return (tree, file) => {
    if (!String(file.path || '').replaceAll('\\', '/').includes('/src/content/papers/')) return;
    const source = String(file.value);
    function rebase(node, start) {
      if (node.position) {
        for (const point of [node.position.start, node.position.end]) {
          if (point.line === 1) point.column += start.column - 1;
          point.line += start.line - 1;
          point.offset += start.offset;
        }
      }
      node.children?.forEach((child) => rebase(child, start));
    }
    function closeTables(parent) {
      if (!Array.isArray(parent.children)) return;
      parent.children = parent.children.flatMap((child) => {
        closeTables(child);
        if (child.type !== 'table') return [child];
        // Obsidian closes a table when a following line has no column separators,
        // even when there is no blank line. GFM otherwise consumes it as a row.
        const boundary = child.children.findIndex((row, index) => index > 0 && row.position &&
          !/(^|[^\\])\|/.test(source.slice(row.position.start.offset, row.position.end.offset)));
        if (boundary < 1) return [child];
        const start = child.children[boundary].position.start;
        const tail = processor.parse(source.slice(start.offset, child.position.end.offset));
        rebase(tail, start);
        closeTables(tail);
        child.children = child.children.slice(0, boundary);
        child.position.end = { ...child.children.at(-1).position.end };
        return [child, ...tail.children];
      });
    }
    closeTables(tree);
    function displayMath(parent) {
      if (!Array.isArray(parent.children)) return;
      parent.children = parent.children.flatMap((node) => {
        if (node.type !== 'paragraph') { displayMath(node); return [node]; }
        const result = [];
        let pending = [];
        function flush() {
          while (pending[0]?.type === 'text' && !pending[0].value.trim()) pending.shift();
          while (pending.at(-1)?.type === 'text' && !pending.at(-1).value.trim()) pending.pop();
          if (pending.length) {
            if (pending[0].type === 'text') pending[0].value = pending[0].value.replace(/^\r?\n/, '');
            if (pending.at(-1).type === 'text') pending.at(-1).value = pending.at(-1).value.replace(/\r?\n$/, '');
            result.push({ ...node, children: pending });
          }
          pending = [];
        }
        for (const child of node.children) {
          const position = child.position;
          let standalone = false;
          if (child.type === 'inlineMath' && position && position.start.line === position.end.line) {
            const begin = source.lastIndexOf('\n', position.start.offset - 1) + 1;
            const end = source.indexOf('\n', position.end.offset);
            const raw = source.slice(position.start.offset, position.end.offset);
            standalone = raw.startsWith('$$') && raw.endsWith('$$') &&
              source.slice(begin, end < 0 ? source.length : end).trim() === raw;
          }
          if (standalone) {
            flush();
            const math = processor.parse(`$$\n${child.value}\n$$`).children[0];
            result.push({ ...math, position });
          } else pending.push(child);
        }
        flush();
        return result;
      });
    }
    displayMath(tree);
    function visit(parent) {
      if (!Array.isArray(parent.children)) return;
      const children = [];
      for (const child of parent.children) {
        if (child.type === 'image') {
          const width = child.title?.match(/^width=(\d{1,4})$/)?.[1];
          if (width && Number(width) > 0) {
            child.data = { ...child.data, hProperties: { ...child.data?.hProperties, width: Number(width) } };
            child.title = null;
          }
        }
        if (child.type === 'text' && child.value.includes('\n')) {
          child.value.split(/\r?\n/).forEach((value, index) => {
            if (index) children.push({ type: 'break' });
            if (value) children.push({ type: 'text', value });
          });
        } else {
          visit(child);
          children.push(child);
        }
      }
      parent.children = children;
    }
    visit(tree);
  };
}

export function rehypePaperTables() {
  return (tree, file) => {
    if (!String(file.path || '').replaceAll('\\', '/').includes('/src/content/papers/')) return;
    function visit(parent) {
      if (!Array.isArray(parent.children)) return;
      parent.children = parent.children.map((child) => {
        if (child.type === 'element' && child.tagName === 'table') {
          return { type: 'element', tagName: 'div', properties: { className: ['paper-table-scroll'] }, children: [child] };
        }
        visit(child);
        return child;
      });
    }
    visit(tree);
  };
}
