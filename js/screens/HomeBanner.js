import { t } from '../i18n.js';

// Decorative photos only; the heading and clock remain stationary.
export function startHomeBanner(header) {
  const sources = ['assets/images/home-marina.png', 'assets/images/home-marina-alternate.png'];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, paused = false, timer = null, index = 0, ready = [];
  const layers = sources.map(() => {
    const layer = document.createElement('span');
    layer.className = 'mc-home-photo';
    layer.setAttribute('aria-hidden', 'true');
    header.prepend(layer);
    return layer;
  });
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'mc-home-photo-toggle'; button.hidden = true;
  header.appendChild(button);
  function schedule() {
    clearTimeout(timer); timer = null;
    button.hidden = motion.matches || ready.length < 2;
    button.textContent = paused ? t('Resume photos') : t('Pause photos');
    button.setAttribute('aria-label', paused ? t('Resume background photos') : t('Pause background photos'));
    if (disposed || paused || document.hidden || motion.matches || ready.length < 2) return;
    timer = setTimeout(() => {
      if (disposed || !header.isConnected) return;
      index = (index + 1) % ready.length;
      ready.forEach((entry,i) => entry.layer.classList.toggle('is-visible', i === index));
      schedule();
    }, 15000);
  }
  button.addEventListener('click', () => { paused = !paused; schedule(); });
  const loads = sources.map((src,i) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({src,layer:layers[i]});
    img.onerror = () => resolve(null);
    img.src = src;
  }));
  Promise.all(loads).then(items => {
    if (disposed || !header.isConnected) return;
    ready = items.filter(Boolean);
    ready.forEach((entry,i) => {
      entry.layer.style.backgroundImage = `url("${entry.src}")`;
      entry.layer.classList.toggle('is-visible', i === 0);
    });
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', schedule);
  return () => {
    disposed = true; clearTimeout(timer);
    document.removeEventListener('visibilitychange', schedule);
    motion.removeEventListener('change', schedule);
    layers.forEach(layer => layer.remove()); button.remove();
  };
}
