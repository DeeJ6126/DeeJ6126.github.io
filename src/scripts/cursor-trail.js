if (!window.__deeCursorTrailReady) {
  window.__deeCursorTrailReady = true;
  const canvas = document.querySelector('[data-cursor-trail]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

if (canvas instanceof HTMLCanvasElement && finePointer && !reduceMotion) {
  const context = canvas.getContext('2d');
  const colors = ['#eff6ff', '#bfdbfe', '#60a5fa', '#3b82f6', '#1d4ed8'];
  const particles = [];
  let width = innerWidth;
  let height = innerHeight;
  let previousPointer = null;

  class SquareParticle {
    constructor(x, y) {
      this.x = x + (Math.random() - 0.5) * 20;
      this.y = y + (Math.random() - 0.5) * 20;
      this.size = Math.random() * 15 + 5;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.life = 1;
      this.decay = Math.random() * 0.01 + 0.005;
      this.vx = (Math.random() - 0.5) * 0.5;
      this.vy = (Math.random() - 0.5) * 0.5;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      if (this.size > 0.1) this.size -= 0.1;
    }
    draw() {
      if (this.life <= 0) return;
      context.fillStyle = this.color;
      context.globalAlpha = this.life;
      context.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      context.globalAlpha = 1;
    }
  }

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  addEventListener('resize', resize);
  addEventListener('mousemove', event => {
    if (document.body.dataset.cursorTrailEnabled !== 'true') return;
    const current = { x: event.clientX, y: event.clientY };
    if (!previousPointer) previousPointer = current;
    const dx = current.x - previousPointer.x;
    const dy = current.y - previousPointer.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.min(12, Math.max(1, Math.ceil(distance / 14)));
    for (let step = 0; step < steps; step += 1) {
      const progress = step / steps;
      particles.push(new SquareParticle(
        previousPointer.x + dx * progress,
        previousPointer.y + dy * progress,
      ));
    }
    if (particles.length > 180) particles.splice(0, particles.length - 180);
    previousPointer = current;
  });
  resize();

  function animate() {
    context.clearRect(0, 0, width, height);
    if (document.body.dataset.cursorTrailEnabled !== 'true') {
      particles.length = 0;
      previousPointer = null;
      requestAnimationFrame(animate);
      return;
    }
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      particles[index].update();
      if (particles[index].life <= 0) particles.splice(index, 1);
    }
    const connectionDistance = 80;
    context.lineWidth = 0.5;
    for (let first = 0; first < particles.length; first += 1) {
      const left = particles[first];
      for (let second = first + 1; second < particles.length; second += 1) {
        const right = particles[second];
        const dx = left.x - right.x;
        const dy = left.y - right.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < connectionDistance * connectionDistance) {
          const distance = Math.sqrt(distanceSquared);
          const opacity = (1 - distance / connectionDistance) * Math.min(left.life, right.life);
          context.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
          context.beginPath();
          context.moveTo(left.x, left.y);
          context.lineTo(right.x, right.y);
          context.stroke();
        }
      }
      left.draw();
    }
    requestAnimationFrame(animate);
  }
  animate();
}
}
