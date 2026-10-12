// Uploaded plan mapped by berth number. Enable only for the intended client.
const MAP_CLIENT_ID = 5;
const PLAN_URL = new URL('../../assets/marina-pier-plan.jpg', import.meta.url).href;
const NS = 'http://www.w3.org/2000/svg';
const VIEWS = { ALL: '80 155 755 650', A: '640 465 100 325', B: '495 330 140 460', C: '360 265 120 525', D: '205 225 125 565', E: '85 155 90 635' };

export function planSlots() {
  const slots = [];
  const add = (pier, number, x, y, width, height) => slots.push({ name: `${pier}${number}`, pier, x, y, width, height });
  for (let row = 0; row < 13; row++) {
    const y = 751 - row * 17.1;
    add('A', row * 2 + 1, 696, y, 24, 14);
    add('A', row * 2 + 2, 660, y, 24, 14);
  }
  add('A', 27, 663, 523, 53, 18);
  for (let row = 0; row < 18; row++) {
    const y = 750 - row * 20.4;
    add('B', row * 2 + 1, 570, y, 40, 17);
    add('B', row * 2 + 2, 520, y, 40, 17);
  }
  add('B', 37, 537, 379, 58, 17);
  for (let row = 0; row < 23; row++) {
    const y = 751 - row * 18.25;
    add('C', row * 2 + 1, 423, y, 31, 15);
    add('C', row * 2 + 2, 382, y, 31, 15);
  }
  add('C', 47, 389, 321, 57, 17);
  for (let row = 0; row < 24; row++) {
    const y = 751 - row * 19.25;
    add('D', row * 2 + 1, 277, y, 36, 16);
    if (row < 23) add('D', row * 2 + 2, 224, y, 44, 16);
  }
  add('D', 48, 243, 275, 58, 18);
  for (let row = 0; row < 34; row++) add('E', row + 1, 129, 739 - row * 15.45, 24, 13);
  return slots;
}

export function mountBerthPierMap(host, { clientId, t, onOpen }) {
  if (Number(clientId) !== MAP_CLIENT_ID) return { render() {} };
  let current = [];
  host.innerHTML = `<style>
    .pier-map-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0;color:#F5F7F9}
    .pier-map-controls button,.pier-map-controls select{background:#1C222A;color:#F5F7F9;border:1px solid #737D89;border-radius:10px;padding:10px 14px;font:inherit}
    .pier-map-panel[hidden]{display:none}.pier-map-panel{margin:12px 0;padding:12px;background:#1C222A;border-radius:14px}
    .pier-map-panel svg{display:block;width:100%;height:auto;max-height:70vh;background:white;border-radius:10px}
    .pier-map-legend{display:flex;flex-wrap:wrap;gap:12px;color:#AEB6C1;font-size:12px;margin:10px 0}
    .pier-map-legend span::before{content:'';display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--swatch);margin-inline-end:5px}
    .pier-map-note{color:#AEB6C1;font-size:12px;margin:10px 0 0}
    .pier-map-slot{cursor:pointer}.pier-map-slot:focus rect,.pier-map-slot:hover rect{stroke:#0A8EF7;stroke-width:2}
  </style><div class="pier-map-controls"><button type="button" data-toggle>${t('Map')}</button>
    <label hidden data-selector>${t('Pier')} <select aria-label="${t('Pier')}"><option value="ALL">${t('All piers')}</option>${['A','B','C','D','E'].map(p => `<option value="${p}">${t('Pier')} ${p}</option>`).join('')}</select></label></div>
    <section class="pier-map-panel" hidden aria-label="${t('Marina map')}">
      <div class="pier-map-legend">${[['#22c55e','Available'],['#ef4444','Occupied'],['#f59e0b','Maintenance'],['#3b82f6','Booked'],['#737D89','No berth record']].map(([c,l]) => `<span style="--swatch:${c}">${t(l)}</span>`).join('')}</div>
      <svg xmlns="${NS}" viewBox="${VIEWS.ALL}" role="group" aria-label="${t('Marina map')}"></svg><p class="pier-map-note"></p>
    </section>`;
  const panel = host.querySelector('section');
  const selector = host.querySelector('[data-selector]');
  const select = host.querySelector('select');
  const svg = host.querySelector('svg');
  const grid = document.getElementById('berthGrid');
  host.querySelector('[data-toggle]').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    selector.hidden = panel.hidden;
    if (grid) { grid.hidden = !panel.hidden; grid.style.display = panel.hidden ? '' : 'none'; }
    host.querySelector('[data-toggle]').textContent = t(panel.hidden ? 'Map' : 'List');
  });
  select.addEventListener('change', () => render(current));
  function render(berths) {
    current = berths;
    svg.replaceChildren();
    svg.setAttribute('viewBox', VIEWS[select.value]);
    const image = document.createElementNS(NS, 'image');
    Object.entries({ href: PLAN_URL, width: 1000, height: 900 }).forEach(([k,v]) => image.setAttribute(k,v));
    svg.append(image);
    const records = new Map();
    const duplicates = new Set();
    const key = b => String(b.berthNumber || '').trim().toUpperCase().replace(/\s/g, '');
    for (const berth of berths) {
      if (berth.clientId != null && Number(berth.clientId) !== Number(clientId)) continue;
      const name = key(berth);
      if (records.has(name)) duplicates.add(name);
      records.set(name, berth);
    }
    const slots = planSlots();
    for (const slot of slots) {
      if (select.value !== 'ALL' && slot.pier !== select.value) continue;
      const berth = duplicates.has(slot.name) ? null : records.get(slot.name);
      const status = String(berth?.status || '').toUpperCase();
      const booked = berth && !berth.dateProjection && status === 'AVAILABLE' && String(berth.activeBooking?.status || '').toUpperCase() === 'CONFIRMED';
      const colour = !berth ? '#737D89' : booked ? '#3b82f6' : ({AVAILABLE:'#22c55e',OCCUPIED:'#ef4444',MAINTENANCE:'#f59e0b'}[status] || '#737D89');
      const group = document.createElementNS(NS, 'g');
      const label = `${slot.name} · ${t(booked ? 'Booked' : (status || 'No berth record'))}${berth?.assignedBoatName || berth?.activeBooking?.vesselName ? ` · ${berth.assignedBoatName || berth.activeBooking.vesselName}` : ''}`;
      if (berth) {
        group.setAttribute('class', 'pier-map-slot');
        group.setAttribute('tabindex', '0');
        group.setAttribute('role', 'button');
        group.setAttribute('aria-label', label);
        group.addEventListener('click', () => onOpen(berth));
        group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(berth); } });
      }
      const title = document.createElementNS(NS, 'title'); title.textContent = label;
      const rect = document.createElementNS(NS, 'rect');
      Object.entries({x:slot.x,y:slot.y,width:slot.width,height:slot.height,fill:colour,stroke:'#151A20','stroke-width':0.7,rx:1}).forEach(([k,v]) => rect.setAttribute(k,v));
      const text = document.createElementNS(NS, 'text');
      Object.entries({x:slot.x+slot.width/2,y:slot.y+slot.height/2,'text-anchor':'middle','dominant-baseline':'central','font-size':9,'font-family':'Arial, sans-serif',fill:'#151A20','font-weight':700}).forEach(([k,v]) => text.setAttribute(k,v));
      text.textContent = slot.name; group.append(title, rect, text); svg.append(group);
    }
    const names = new Set(slots.map(s => s.name));
    const unmapped = berths.filter(b => !names.has(key(b))).length;
    host.querySelector('.pier-map-note').textContent = `${t('Berth colours show the current date view. Original plan colours indicate berth sizes.')} ${unmapped ? `${unmapped} ${t('berths are not on this plan; use List to view them.')}` : ''} ${duplicates.size ? t('Duplicate berth numbers are disabled on the map.') : ''}`;
  }
  return { render };
}
