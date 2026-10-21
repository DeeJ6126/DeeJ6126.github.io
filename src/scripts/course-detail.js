let cleanupCourseDetail = () => {};

async function copyToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();
  if (!copied) throw new Error('Copy command failed');
}

function initCourseDetail() {
  cleanupCourseDetail();
  const railLinks = [...document.querySelectorAll('.detail-rail nav a')];
  const sections = [...document.querySelectorAll('[data-detail-section]')];
  if (!railLinks.length || !sections.length) {
    cleanupCourseDetail = () => {};
    return;
  }

  const cleanups = [];
  const timers = new Set();
  let frame = 0;
  const on = (target, type, listener, options) => {
    target?.addEventListener(type, listener, options);
    cleanups.push(() => target?.removeEventListener(type, listener, options));
  };

  const updateRail = () => {
    frame = 0;
    const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
    const probe = scrollY + headerHeight + 56;
    let activeSection = sections[0];
    for (const section of sections) {
      if (section.offsetTop <= probe) activeSection = section;
    }
    railLinks.forEach(link => link.classList.toggle('active', link.hash === `#${activeSection.id}`));
  };
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(updateRail);
  };
  on(window, 'scroll', scheduleUpdate, { passive: true });
  on(window, 'resize', scheduleUpdate);
  on(window, 'hashchange', scheduleUpdate);
  railLinks.forEach(link => on(link, 'click', () => {
    railLinks.forEach(candidate => candidate.classList.toggle('active', candidate === link));
  }));
  updateRail();

  document.querySelectorAll('[data-note-item]').forEach(item => {
    on(item, 'toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('[data-note-item]').forEach(sibling => {
        if (sibling !== item) sibling.open = false;
      });
      requestAnimationFrame(() => dispatchEvent(new Event('scroll')));
    });
  });

  document.querySelectorAll('[data-copy-share]').forEach(button => {
    on(button, 'click', async () => {
      const label = button.querySelector('[data-copy-label]');
      try {
        await copyToClipboard(button.dataset.copyShare);
        button.classList.add('copied');
        if (label) label.textContent = '已复制';
      } catch {
        if (label) label.textContent = '复制失败';
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        button.classList.remove('copied');
        if (label) label.textContent = '复制幕布链接';
      }, 1600);
      timers.add(timer);
    });
  });

  cleanupCourseDetail = () => {
    if (frame) cancelAnimationFrame(frame);
    cleanups.forEach(cleanup => cleanup());
    timers.forEach(timer => clearTimeout(timer));
    cleanupCourseDetail = () => {};
  };
}

document.addEventListener('astro:page-load', initCourseDetail);
document.addEventListener('astro:before-swap', () => cleanupCourseDetail());
initCourseDetail();
