import {mountEditableBerthMap} from './BerthCustomMap.js';
// Shared plan mapped by berth number; records remain scoped to the active client.
const PLAN_URL = new URL('../../assets/marina-pier-plan.jpg', import.meta.url).href;
const NS = 'http://www.w3.org/2000/svg';
const VIEWS = { ALL: '90 165 640 616', A: '640 465 100 325', B: '495 330 140 460', C: '360 265 120 525', D: '205 225 125 565', E: '85 155 90 635' };

export function mapBaseView(pier) {
  const bounds = (VIEWS[pier] || VIEWS.ALL).split(' ').map(Number);
  const aspect = 640 / 616;
  const width = Math.max(bounds[2], bounds[3] * aspect);
  const height = width / aspect;
  return [bounds[0] - (width - bounds[2]) / 2, bounds[1] - (height - bounds[3]) / 2, width, height];
}

export function zoomMapView(base, view, factor, anchor) {
  const width = Math.max(base[2] / 8, Math.min(base[2], view[2] * factor));
  const height = width * base[3] / base[2];
  const x = anchor.x - (anchor.x - view[0]) * width / view[2];
  const y = anchor.y - (anchor.y - view[1]) * height / view[3];
  return clampMapView(base, [x, y, width, height]);
}
function clampMapView(base, view) {
  return [Math.max(base[0], Math.min(base[0] + base[2] - view[2], view[0])),
    Math.max(base[1], Math.min(base[1] + base[3] - view[3], view[1])), view[2], view[3]];
}

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

function mountLegacyBerthPierMap(host, { clientId, t, onOpen }) {
  let current = [];
  let baseView = VIEWS.ALL.split(' ').map(Number);
  let camera = [...baseView];
  let drag = null;
  let suppressClick = false;
  host.innerHTML = `<style>
    .pier-map-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:12px 0;color:#F5F7F9}
    .pier-map-controls button,.pier-map-controls select{background:#1C222A;color:#F5F7F9;border:1px solid #737D89;border-radius:10px;padding:10px 14px;font:inherit}
    .pier-map-panel[hidden]{display:none}.pier-map-panel{margin:12px 0;padding:12px;background:#1C222A;border-radius:14px}
    .pier-map-panel svg{display:block;width:auto;height:auto;max-width:100%;margin:0 auto;background:white;border-radius:10px;touch-action:none;user-select:none;cursor:grab}
    .pier-map-legend{display:flex;flex-wrap:wrap;gap:12px;color:#AEB6C1;font-size:12px;margin:10px 0}
    .pier-map-legend span::before{content:'';display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--swatch);margin-inline-end:5px}
    .pier-map-note{color:#AEB6C1;font-size:12px;margin:10px 0 0}
    .pier-map-slot{cursor:pointer}.pier-map-slot:focus rect,.pier-map-slot:hover rect{stroke:#0A8EF7;stroke-width:2}
  </style><div class="pier-map-controls"><button type="button" data-toggle>${t('Map')}</button>
    <label hidden data-selector>${t('Pier')} <select aria-label="${t('Pier')}"><option value="ALL">${t('All piers')}</option>${['A','B','C','D','E'].map(p => `<option value="${p}">${t('Pier')} ${p}</option>`).join('')}</select></label><span hidden data-zoom-controls>
    <button type="button" data-zoom-in aria-label="${t('Zoom in')}">+</button>
    <button type="button" data-zoom-out aria-label="${t('Zoom out')}">−</button>
    <button type="button" data-reset>${t('Reset view')}</button></span></div>
    <section class="pier-map-panel" hidden aria-label="${t('Marina map')}">
      <div class="pier-map-legend">${[['#22c55e','Available'],['#ef4444','Occupied'],['#f59e0b','Maintenance'],['#3b82f6','Booked'],['#737D89','No berth record']].map(([c,l]) => `<span style="--swatch:${c}">${t(l)}</span>`).join('')}</div>
      <svg xmlns="${NS}" viewBox="${VIEWS.ALL}" role="group" aria-label="${t('Marina map')}"></svg><p class="pier-map-note"></p>
    </section>`;
  const panel = host.querySelector('section');
  const selector = host.querySelector('[data-selector]');
  const select = host.querySelector('select');
  const svg = host.querySelector('svg');
  function applyCamera() { svg.setAttribute('viewBox', camera.join(' ')); }
  function resetCamera() {
    baseView = mapBaseView(select.value);
    camera = [...baseView];
    applyCamera();
  }
  function pointAt(clientX, clientY) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint(); point.x = clientX; point.y = clientY;
    return point.matrixTransform(matrix.inverse());
  }
  function zoom(factor, anchor = { x: camera[0] + camera[2] / 2, y: camera[1] + camera[3] / 2 }) {
    camera = zoomMapView(baseView, camera, factor, anchor);
    applyCamera();
  }
  host.querySelector('[data-zoom-in]').addEventListener('click', () => zoom(0.8));
  host.querySelector('[data-zoom-out]').addEventListener('click', () => zoom(1.25));
  host.querySelector('[data-reset]').addEventListener('click', resetCamera);
  svg.addEventListener('wheel', event => {
    if (panel.hidden) return;
    const point = pointAt(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? svg.clientHeight : 1);
    zoom(Math.exp(Math.max(-150, Math.min(150, delta)) * 0.002), point);
  }, { passive: false });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    const point = pointAt(event.clientX, event.clientY);
    if (point) drag = { id: event.pointerId, point, view: [...camera], x: event.clientX, y: event.clientY, moved: false };
  });
  svg.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    if (!drag.moved) { drag.moved = true; svg.setPointerCapture(event.pointerId); }
    suppressClick = true;
    event.preventDefault();
    // Convert against the starting camera so each move uses a stable coordinate system.
    svg.setAttribute('viewBox', drag.view.join(' '));
    const point = pointAt(event.clientX, event.clientY);
    if (point) camera = clampMapView(baseView, [drag.view[0] + drag.point.x - point.x,
      drag.view[1] + drag.point.y - point.y, drag.view[2], drag.view[3]]);
    applyCamera(); svg.style.cursor = 'grabbing';
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    drag = null; svg.style.cursor = '';
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('lostpointercapture', () => { drag = null; svg.style.cursor = ''; });
  svg.addEventListener('pointerleave', () => { if (drag && !drag.moved) drag = null; });
  svg.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
  }, true);
  const grid = document.getElementById('berthGrid');
  const summary = document.getElementById('berthSummary');
  const originalSummaryDisplay = summary?.style.display || '';
  let fitFrame = 0;
  function fitMap() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      if (!host.isConnected || panel.hidden) return;
      const [, , viewWidth, viewHeight] = baseView;
      const note = host.querySelector('.pier-map-note');
      const panelStyle = getComputedStyle(panel);
      const availableWidth = panel.clientWidth - parseFloat(panelStyle.paddingLeft) - parseFloat(panelStyle.paddingRight);
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const availableHeight = Math.max(80, viewportHeight - svg.getBoundingClientRect().top - note.getBoundingClientRect().height - 52);
      const height = Math.min(availableHeight, availableWidth * viewHeight / viewWidth);
      svg.style.height = `${height}px`;
      svg.style.width = `${height * viewWidth / viewHeight}px`;
    });
  }
  function onResize() {
    if (!host.isConnected) { window.removeEventListener('resize', onResize); observer.disconnect(); return; }
    fitMap();
  }
  const observer = new ResizeObserver(onResize);
  observer.observe(host);
  window.addEventListener('resize', onResize);
  host.querySelector('[data-toggle]').addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    selector.hidden = panel.hidden;
    host.querySelector('[data-zoom-controls]').hidden = panel.hidden;
    if (summary) summary.style.display = originalSummaryDisplay;
    if (grid) { grid.hidden = !panel.hidden; grid.style.display = panel.hidden ? '' : 'none'; }
    host.querySelector('[data-toggle]').textContent = t(panel.hidden ? 'Map' : 'List');
    fitMap();
  });
  select.addEventListener('change', () => { resetCamera(); render(current); });
  function render(berths) {
    current = berths;
    svg.replaceChildren();
    applyCamera();
    const image = document.createElementNS(NS, 'image');
    Object.entries({ href: PLAN_URL, x: 24, y: 5, width: 724, height: 776 }).forEach(([k,v]) => image.setAttribute(k,v));
    // A nested SVG crops the plan to this pier without narrowing the outer canvas.
    const bounds = VIEWS[select.value].split(' ').map(Number);
    const plan = document.createElementNS(NS, 'svg');
    Object.entries({ x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3],
      viewBox: bounds.join(' '), overflow: 'hidden', 'pointer-events': 'none' })
      .forEach(([k,v]) => plan.setAttribute(k,v));
    plan.append(image);
    svg.append(plan);
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
    host.querySelector('.pier-map-note').textContent = `${t('Scroll to zoom · Drag to move · Reset view to fit. Berth colours follow the selected date view.')} ${unmapped ? `${unmapped} ${t('berths are not on this plan; use List to view them.')}` : ''} ${duplicates.size ? t('Duplicate berth numbers are disabled on the map.') : ''}`;
    fitMap();
  }
  return { render, destroy(){cancelAnimationFrame(fitFrame);observer.disconnect();window.removeEventListener('resize',onResize);} };
}

export function mountBerthPierMap(host,options){return mountEditableBerthMap(host,{...options,legacy:mountLegacyBerthPierMap,planSlots,planUrl:PLAN_URL});}
