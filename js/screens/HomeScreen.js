import { startHomeBanner } from './HomeBanner.js';
import { store } from '../store.js';
import { t, getLocale } from '../i18n.js';
import { db } from '../firebase.js';
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { liveRecord, pendingBooking, openMaintenance, safetyAttention } from './HomeMetrics.js';

let stops = [];
let generation = 0;
let clockTimer = null;
let clockVisibilityHandler = null;
export function unmountHomeScreen() {
  generation++;
  clearTimeout(clockTimer);
  clockTimer = null;
  if (clockVisibilityHandler) document.removeEventListener('visibilitychange', clockVisibilityHandler);
  clockVisibilityHandler = null;
  stops.forEach(stop => stop());
  stops = [];
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  bookings: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16m-12 4h3"/>',
  maintenance: '<path d="M14 6a5 5 0 0 0-6 6L3 17l4 4 5-5a5 5 0 0 0 6-6l-4 4-4-4 4-4z"/>',
  safety: '<path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3zM12 8v5m0 3h.01"/>',
  berths: '<path d="M4 19h16M6 19V7h12v12M9 7V3h6v4M9 12h6"/>'
};
const icon = key => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;

export function mountHomeScreen() {
  unmountHomeScreen();
  const token = generation;
  const clientId = Number(store.activeClientId);
  const screen = document.getElementById('screen');
  const cssId = 'homeOverviewCss';
  if (!document.getElementById(cssId)) {
    const link = document.createElement('link');
    link.id = cssId; link.rel = 'stylesheet'; link.href = 'css/home.css?v=20261005-rotation-2';
    document.head.appendChild(link);
  }
  screen.innerHTML = `<section class="mc-home">
    <header class="mc-home-heading"><time class="mc-home-clock" dir="auto"></time><span class="mc-home-eyebrow">${esc(t('MarinaControl'))}</span>
     <!-- <h1>${esc(store.activeMarina?.name || 'MarinaControl')}</h1> -->
      <p>${esc(t('Your marina at a glance'))}</p></header>
    <div class="mc-home-grid" aria-label="${esc(t('Marina overview'))}">
      ${['bookings','maintenance','safety','berths'].map(key => `<button type="button" class="mc-home-card" data-home-card="${key}">
        <span class="mc-home-icon">${icon(key)}</span><span class="mc-home-label"></span>
        <strong class="mc-home-count" aria-live="polite">…</strong><span class="mc-home-note">${esc(t('Loading…'))}</span>
      </button>`).join('')}
    </div>
    <section class="mc-home-detail" hidden aria-live="polite"></section>
    <section class="mc-home-quick"><h2>${esc(t('Quick links'))}</h2><div class="mc-home-links">
      ${[['/berths','Dock Walk'],['/boats','Boats'],['/booking-requests','Booking Requests'],['/operations-trends','Operations Trends']].map(([route,label]) => `<a href="#${route}">${esc(t(label))}<span aria-hidden="true">›</span></a>`).join('')}
    </div></section>
  </section>`;
  const root = screen.querySelector('.mc-home');
  stops.push(startHomeBanner(root.querySelector('.mc-home-heading')));
  const clock = root.querySelector('.mc-home-clock');
  function updateClock() {
    clearTimeout(clockTimer);
    if (token !== generation || !root.isConnected) return;
    const now = new Date();
    const locale = getLocale();
    clock.dateTime = now.toISOString();
    clock.textContent = `${new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)} · ${new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)}`;
    clockTimer = setTimeout(updateClock, 60000 - (Date.now() % 60000));
  }
  clockVisibilityHandler = () => { if (!document.hidden) updateClock(); };
  document.addEventListener('visibilitychange', clockVisibilityHandler);
  updateClock();
  const rows = {}, errors = {};
  let expanded = null;
  const configs = {
    bookings: ['Pending booking requests', pendingBooking, 'Nothing awaiting review', '/booking-requests'],
    maintenance: ['Open maintenance', openMaintenance, 'No open maintenance', '/maintenance'],
    safety: ['Safety needs attention', i => safetyAttention(i), 'No items needing attention', '/safety'],
    berths: ['Available berths', i => liveRecord(i) && String(i.status).toUpperCase() === 'AVAILABLE', 'No available berths', '/berths']
  };
  const current = () => token === generation && clientId === Number(store.activeClientId) && root.isConnected;
  function filtered(key) { return (rows[key] || []).filter(configs[key][1]); }
  function render() {
    if (!current()) return;
    for (const [key, [label,,empty]] of Object.entries(configs)) {
      const card = root.querySelector(`[data-home-card="${key}"]`);
      card.querySelector('.mc-home-label').textContent = t(label);
      card.querySelector('.mc-home-count').textContent = errors[key] ? '—' : rows[key] ? filtered(key).length : '…';
      card.querySelector('.mc-home-note').textContent = errors[key] ? t('Could not load · tap to retry') : !rows[key] ? t('Loading…') :
        key === 'safety' && filtered(key).length ? t('Expired, due within 30 days or missing expiry') :
        key === 'maintenance' && filtered(key).length ? t('Excludes completed and deferred work') :
        filtered(key).length ? t('View records') : t(empty);
    }
    renderDetail();
  }
  function renderDetail() {
    const panel = root.querySelector('.mc-home-detail');
    panel.hidden = !expanded;
    if (!expanded) return;
    const key = expanded;
    const [label,,empty,route] = configs[key];
    const items = filtered(key);
    const grouped = new Map();
    for (const item of items) {
      const id = Number(item.boatId || 0);
      grouped.set(id, (grouped.get(id) || 0) + 1);
    }
    panel.innerHTML = `<h2>${esc(t(label))}</h2>` +
      (errors[key] ? `<p>${esc(t('Could not load records. Tap the card to retry.'))}</p>` : !rows[key] ? `<p>${esc(t('Loading…'))}</p>` : !items.length ? `<p>${esc(t(empty))}</p>` :
      [...grouped].map(([id,count]) => {
        const boat = (rows.boats || []).find(b => Number(b.id) === id);
        const name = boat?.name || items.find(i => Number(i.boatId || 0) === id)?.boatName || (id ? `${t('Boat')} #${id}` : t('No boat linked'));
        return id ? `<a href="#${route}?boatId=${id}">${esc(name)}<span>${count} ›</span></a>` : `<p>${esc(name)} · ${count}</p>`;
      }).join(''));
  }
  function watch(key, name) {
    delete errors[key]; delete rows[key]; render();
    const stop = onSnapshot(query(collection(db, name), where('clientId', '==', clientId)), snap => {
      if (!current()) return;
      rows[key] = snap.docs.map(d => ({...d.data(), id: d.data().id ?? d.id}));
      delete errors[key]; render();
    }, error => {
      if (!current()) return;
      console.warn('[home] overview unavailable', key, error);
      errors[key] = true; render();
    });
    stops.push(stop);
  }
  const collections = {bookings:'berth_booking_requests', maintenance:'maintenance', safety:'safety_items', berths:'berths', boats:'boats'};
  root.querySelectorAll('[data-home-card]').forEach(card => card.addEventListener('click', () => {
    const key = card.dataset.homeCard;
    if (errors[key]) { watch(key, collections[key]); return; }
    if (key === 'bookings' || key === 'berths') { location.hash = `#${configs[key][3]}`; return; }
    expanded = expanded === key ? null : key;
    root.querySelectorAll('[data-home-card]').forEach(c => c.setAttribute('aria-expanded', String(c.dataset.homeCard === expanded)));
    renderDetail();
  }));
  render();
  if (clientId > 0) Object.entries(collections).forEach(([key,name]) => watch(key,name));
}
