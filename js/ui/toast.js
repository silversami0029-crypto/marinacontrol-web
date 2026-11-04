import { italianUI as itUI } from '../i18n.js';
// js/ui/toast.js
// Small pill toast, bottom-center — mirrors Android Toast

let current = null;

export function toast(message, opts = {}) {
  const { duration = 2200, kind = 'info' } = opts;

  // Remove existing
  if (current) {
    current.remove();
    current = null;
  }

  const el = document.createElement('div');
  el.className = `app-toast app-toast--${kind}`;
  el.textContent = itUI(message);
  document.body.appendChild(el);
  current = el;

  requestAnimationFrame(() => el.classList.add('is-visible'));

  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => {
      el.remove();
      if (current === el) current = null;
    }, 220);
  }, duration);
}