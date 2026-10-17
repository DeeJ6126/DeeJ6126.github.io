let cleanupCourseIndex = () => {};

function initCourseIndex() {
  cleanupCourseIndex();
  const links = [...document.querySelectorAll('[data-discipline-link]')];
  const sections = [...document.querySelectorAll('[data-discipline-section]')];
  const search = document.querySelector('[data-course-search]');
  if (!links.length || !sections.length || !(search instanceof HTMLElement)) {
    cleanupCourseIndex = () => {};
    return;
  }

  const toggle = search.querySelector('[data-search-toggle]');
  const input = search.querySelector('[data-search-input]');
  const entries = [...document.querySelectorAll('[data-course-entry]')];
  const empty = document.querySelector('[data-no-results]');
  const bridges = [...document.querySelectorAll('.section-bridge')];
  const cleanups = [];
  const on = (target, type, listener, options) => {
    target?.addEventListener(type, listener, options);
    cleanups.push(() => target?.removeEventListener(type, listener, options));
  };

  const activate = id => {
    links.forEach(link => link.classList.toggle('active', link.dataset.disciplineLink === id));
  };
  links.forEach(link => on(link, 'click', () => activate(link.dataset.disciplineLink)));

  const observer = new IntersectionObserver(entriesToCheck => {
    const visible = entriesToCheck
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) activate(visible.target.dataset.disciplineSection);
  }, { rootMargin: '-18% 0px -48% 0px', threshold: [0, .15, .35, .6] });
  sections.forEach(section => observer.observe(section));

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
      const show = !query || entry.dataset.courseTitle.includes(query);
      entry.hidden = !show;
      if (show) matches += 1;
    });
    sections.forEach(section => {
      const hasVisible = [...section.querySelectorAll('[data-course-entry]')].some(entry => !entry.hidden);
      section.hidden = !hasVisible;
    });
    bridges.forEach(bridge => { bridge.hidden = Boolean(query); });
    if (empty) empty.hidden = matches !== 0;
    const firstVisibleSection = sections.find(section => !section.hidden);
    if (query && firstVisibleSection) {
      activate(firstVisibleSection.dataset.disciplineSection);
      firstVisibleSection.scrollIntoView({ block: 'start' });
    }
  };
  on(input, 'input', onInput);

  const onKeydown = event => {
    if (event.key === 'Escape' && search.classList.contains('open')) toggle?.click();
  };
  on(document, 'keydown', onKeydown);

  cleanupCourseIndex = () => {
    observer.disconnect();
    cleanups.forEach(cleanup => cleanup());
    cleanupCourseIndex = () => {};
  };
}

document.addEventListener('astro:page-load', initCourseIndex);
document.addEventListener('astro:before-swap', () => cleanupCourseIndex());
initCourseIndex();
