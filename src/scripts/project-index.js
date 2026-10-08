let cleanupProjectIndex = () => {};

function initProjectIndex() {
  cleanupProjectIndex();
  const search = document.querySelector('[data-project-search]');
  if (!(search instanceof HTMLElement)) {
    cleanupProjectIndex = () => {};
    return;
  }
  const toggle = search.querySelector('[data-search-toggle]');
  const input = search.querySelector('[data-search-input]');
  const entries = [...document.querySelectorAll('[data-project-entry]')];
  const empty = document.querySelector('[data-no-results]');
  const cleanups = [];
  const on = (target, type, listener) => {
    target?.addEventListener(type, listener);
    cleanups.push(() => target?.removeEventListener(type, listener));
  };

  const onToggle = () => {
    const open = !search.classList.contains('open');
    search.classList.toggle('open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (input instanceof HTMLInputElement) {
      input.disabled = !open;
      if (open) input.focus();
      else {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        toggle?.focus();
      }
    }
  };
  on(toggle, 'click', onToggle);

  const onInput = () => {
    if (!(input instanceof HTMLInputElement)) return;
    const query = input.value.trim().toLocaleLowerCase('zh-CN');
    let matches = 0;
    entries.forEach(entry => {
      const show = !query || entry.dataset.projectTitle.includes(query);
      entry.hidden = !show;
      if (show) matches += 1;
    });
    if (empty) empty.hidden = matches !== 0;
  };
  on(input, 'input', onInput);

  const onKeydown = event => {
    if (event.key === 'Escape' && search.classList.contains('open')) toggle?.click();
  };
  on(document, 'keydown', onKeydown);

  cleanupProjectIndex = () => {
    cleanups.forEach(cleanup => cleanup());
    cleanupProjectIndex = () => {};
  };
}

document.addEventListener('astro:page-load', initProjectIndex);
document.addEventListener('astro:before-swap', () => cleanupProjectIndex());
initProjectIndex();
