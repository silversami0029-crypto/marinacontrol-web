import { t, getLocale } from '../i18n.js';

const clockPreferenceKey = 'marinacontrol.webapp.secondClock';
const secondClockZones = [
  ['Asia/Dubai', 'Dubai'],
  ['Europe/Istanbul', 'Türkiye'],
  ['America/New_York', 'New York (US Eastern)']
];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function workspaceClocksMarkup() {
  return `<div class="mc-home-clocks">
        <span>${esc(t('London'))}</span>
        <time class="mc-home-clock" data-clock="london" dir="auto"></time>
        <select class="mc-home-clock-zone" aria-label="${esc(t('Second clock time zone'))}">
          ${secondClockZones.map(([zone, name]) => `<option value="${zone}">${esc(t(name))}</option>`).join('')}
        </select>
        <time class="mc-home-clock" data-clock="secondary" dir="auto"></time>
      </div>`;
}

export function startWorkspaceClocks(root) {
  let clockTimer;
  const zoneSelect = root.querySelector('.mc-home-clock-zone');
  const londonClock = root.querySelector('[data-clock="london"]');
  const secondClock = root.querySelector('[data-clock="secondary"]');
  const locale = getLocale();
  const clockFormatters = new Map(
    ['Europe/London', ...secondClockZones.map(([zone]) => zone)].map(timeZone => [
      timeZone,
      new Intl.DateTimeFormat(locale, {
        timeZone, weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      })
    ])
  );
  try {
    const savedZone = localStorage.getItem(clockPreferenceKey);
    if (secondClockZones.some(([zone]) => zone === savedZone)) zoneSelect.value = savedZone;
  } catch {
    // The selector still works without browser storage.
  }
  const onZoneChange = () => {
    updateClock();
    try {
      localStorage.setItem(clockPreferenceKey, zoneSelect.value);
    } catch {
      // The selection still applies until the screen is closed.
    }
  };
  zoneSelect.addEventListener('change', onZoneChange);
  function updateClock() {
    clearTimeout(clockTimer);
    if (!root.isConnected) return;
    const now = new Date();
    londonClock.dateTime = now.toISOString();
    secondClock.dateTime = londonClock.dateTime;
    londonClock.textContent = clockFormatters.get('Europe/London').format(now);
    secondClock.textContent = clockFormatters.get(zoneSelect.value).format(now);
    clockTimer = setTimeout(updateClock, 60000 - (Date.now() % 60000));
  }
  const clockVisibilityHandler = () => { if (!document.hidden) updateClock(); };
  document.addEventListener('visibilitychange', clockVisibilityHandler);
  updateClock();
  return () => {
    clearTimeout(clockTimer);
    zoneSelect.removeEventListener('change', onZoneChange);
    document.removeEventListener('visibilitychange', clockVisibilityHandler);
  };
}
