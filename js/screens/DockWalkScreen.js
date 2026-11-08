import { store } from '../store.js';
import { listenForBerths } from '../db.js';
import { app, db, auth, collection, doc, getDoc, getDocs, setDoc, onSnapshot, query, where } from '../firebase.js';
import { runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { t } from '../i18n.js';
import { showMaintenanceDetail } from './MaintenanceDetailSheet.js';

const checks = [
  ['lightingOk', 'Lighting'], ['shorePowerOk', 'Shore Power'], ['waterOk', 'Water'],
  ['bollardsOk', 'Bollards'], ['pontoonDamage', 'Pontoon']
];
const roles = ['admin', 'manager', 'staff', 'inspector'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const label = key => esc(t(key));
const status = (record, key) => typeof record[key] === 'boolean'
  ? (record[key] === (key === 'pontoonDamage') ? 'Fault' : 'OK')
  : String(record[key] || 'Not Inspected');
const faults = record => checks.filter(([key]) => status(record, key).toLowerCase() === 'fault');
const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const calendar = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
const dateText = ms => ms > 0 ? `${calendar.format(ms)} ${clock.format(ms)}` : '—';
let cleanup = () => {};

export async function countDockWalkIssues(clientId) {
  const snapshot = await getDocs(query(collection(db, 'inspections'), where('clientId', '==', clientId)));
  const latest = new Map();
  for (const entry of snapshot.docs) {
    const record = entry.data();
    const previous = latest.get(record.berthId);
    if (record.completed && (!previous || record.inspectionDate > previous.inspectionDate)) {
      latest.set(record.berthId, record);
    }
  }
  return [...latest.values()].filter(record => faults(record).length).length;
}

// Android keeps these berth attachments on the device. The web copy is browser-local.
function berthAttachment(key, operation, value) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('marinacontrol-dock-walk', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('berth-media');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('berth-media', operation === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('berth-media');
      const request = operation === 'put' ? store.put(value, key) : store[operation](key);
      transaction.oncomplete = () => { database.close(); resolve(request.result); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  });
}

export function unmountDockWalkScreen() { cleanup(); cleanup = () => {}; }

export function mountDockWalkScreen() {
  unmountDockWalkScreen();
  const clientId = store.activeClientId;
  const uid = store.authUser?.uid;
  const screen = document.getElementById('screen');
  let alive = true;
  let berths;
  let records;
  let failed = false;
  let closeSheet = () => {};
  const current = () => alive && uid && auth.currentUser?.uid === uid &&
    store.activeClientId === clientId && !store.marinaSwitching;
  const writable = () => current() && roles.includes(store.activeRole);
  const scoped = name => query(collection(db, name), where('clientId', '==', clientId));
  screen.innerHTML = `
    <div class="berth-header">
      <div class="berth-header-row">
        <button class="berth-icon-btn" data-back aria-label="${label('Back')}">‹</button>
        <div class="berth-pill">${label('Dock Walk')}</div>
        <button type="button" class="berth-info" data-help aria-label="${label('Help')}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".5"/>
          </svg>
        </button>
        <div class="berth-header-spacer"></div>
        <button type="button" class="berth-date-filter dw-progress" data-audit>${label('Progress')}</button>
      </div>
      <div class="berth-summary" data-summary></div>
    </div>
    <div class="berth-search dw-search">
      <input class="add-input" type="search" aria-label="${label('Search')}" placeholder="${label('Search berth or dock')}">
      <label><input type="checkbox" data-issues> ${label('Issues only')}</label>
    </div>
    <div class="berth-grid dw-grid" data-list></div>`;
  const list = screen.querySelector('[data-list]');
  const search = screen.querySelector('input[type=search]');
  const issues = screen.querySelector('[data-issues]');
  issues.checked = new URLSearchParams(location.hash.split('?')[1]).get('issues') === '1';
  const historyFor = berth => records.filter(row => row.berthId === berth.id);
  const daily = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const berthIds = new Set(berths.map(berth => berth.id));
    return records.filter(row => row.completed && berthIds.has(row.berthId) &&
      row.inspectionDate >= start && row.inspectionDate < end);
  };
  function render() {
    if (!current()) return;
    if (failed || !berths || !records) {
      list.innerHTML = `<div class="boats-empty">${label(failed ? 'Unable to load Dock Walk' : 'Loading...')}</div>`;
      return;
    }
    const inspected = new Map();
    for (const record of daily()) {
      if (!inspected.has(record.berthId)) inspected.set(record.berthId, record.inspectionDate);
    }
    screen.querySelector('[data-summary]').textContent =
      `${store.activeMarina?.name || ''} · ${inspected.size} / ${berths.length} ${t('Inspected today')}`;
    const needle = search.value.trim().toLowerCase();
    const filtered = berths.filter(berth => {
      const latest = historyFor(berth).find(record => record.completed);
      return `${berth.berthNumber} ${berth.dockName} ${berth.assignedBoatName || ''}`.toLowerCase().includes(needle) &&
        (!issues.checked || (latest && faults(latest).length));
    });
    list.innerHTML = filtered.map((berth, i) => {
      const latest = historyFor(berth).find(record => record.completed);
      const state = latest && faults(latest).length ? 'maintenance' :
        berth.status === 'OCCUPIED' ? 'occupied' : berth.status === 'MAINTENANCE' ? 'maintenance' : 'available';
      return `<article class="berth-card berth-card--${state}${inspected.has(berth.id) ? ' dw-inspected' : ''}" data-berth="${i}">
        <span class="berth-card-num">${esc(berth.berthNumber)}</span>
        <span class="berth-card-boat">${esc(berth.dockName)}</span>
        <span class="berth-card-boat">${esc(berth.assignedBoatName || t('Empty'))}</span>
        <span class="berth-card-boat dw-card-status">${label(inspected.has(berth.id) ? 'Inspected today' : 'Not inspected today')}${inspected.has(berth.id) ? ' · ' + esc(clock.format(inspected.get(berth.id))) : ''}</span>
        <div class="dw-card-actions">
          ${writable() ? `<button type="button" data-inspect>${label('Inspect')}</button>` : ''}
          <button type="button" data-history-open>${label('History')}</button>
          <button type="button" data-options aria-label="${label('Inspection Options')}">⋮</button>
        </div>
      </article>`;
    }).join('') || `<div class="boats-empty">${label('No matching berths')}</div>`;
    list.querySelectorAll('[data-berth]').forEach(card => {
      const berth = filtered[Number(card.dataset.berth)];
      card.querySelector('[data-history-open]').onclick = () => berthSheet(berth);
      card.querySelector('[data-options]').onclick = () => inspectionOptions(berth);
      const inspect = card.querySelector('[data-inspect]');
      if (inspect) inspect.onclick = () => { if (writable()) inspectionForm(berth); };
    });
  }

  function sheet(title, body) {
    closeSheet();
    const backdrop = document.createElement('div');
    const panel = document.createElement('div');
    backdrop.className = 'sheet-backdrop is-open';
    panel.className = 'sheet is-open dw-sheet';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', title);
    panel.innerHTML = `<div class="sheet-handle"></div><div class="sheet-title">${esc(title)}</div>
      <div class="md-body">${body}</div><button class="md-close-btn" data-close>${label('Close')}</button>`;
    const previous = document.activeElement;
    const keydown = event => { if (event.key === 'Escape') close(); };
    const close = () => {
      backdrop.remove(); panel.remove();
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus();
    };
    closeSheet = close;
    document.getElementById('modalRoot').append(backdrop, panel);
    backdrop.onclick = panel.querySelector('[data-close]').onclick = close;
    document.addEventListener('keydown', keydown);
    panel.querySelector('[data-close]').focus();
    return panel;
  }

  const row = (key, value) => `<div class="md-line"><span class="md-label">${label(key)}</span>
    <span class="md-value">${esc(value || '—')}</span></div>`;
  const button = (action, key) => `<button type="button" class="sheet-item" data-action="${action}">
    <span class="sheet-item-title">${label(key)}</span></button>`;
  const on = (panel, action, fn) => {
    const control = panel.querySelector(`[data-action="${action}"]`);
    if (control) control.onclick = fn;
  };
  const error = (panel, err) => {
    console.error('Dock Walk:', err);
    const output = panel.querySelector('[role=status]');
    if (output) output.textContent = t('Unable to complete this action. Check access and try again.');
  };

  const berthKey = berth => JSON.stringify([uid, clientId, berth.id]);

  function inspectionOptions(berth) {
    if (!current()) return;
    const panel = sheet(t('Inspection Options'), row('Berth', berth.berthNumber) +
      button('history', 'Inspection History') + button('photo', 'Photo') +
      button('voice', 'Voice Note Options') + button('cctv', 'View CCTV'));
    on(panel, 'history', () => berthSheet(berth));
    on(panel, 'photo', () => showBerthMedia(berth, 'photo'));
    on(panel, 'voice', () => showBerthMedia(berth, 'voice'));
    on(panel, 'cctv', () => showCctv(berth));
  }

  async function showBerthMedia(berth, kind) {
    const photo = kind === 'photo';
    const title = photo ? 'Berth photo' : 'Voice Note Options';
    const key = `${berthKey(berth)}:${kind}`;
    const panel = sheet(t(title), row('Berth', berth.berthNumber) +
      `<p>${label('Saved in this browser for your account.')}</p><div data-media></div>
       <p role="status">${label('Loading...')}</p>` + button('back', 'Inspection Options'));
    on(panel, 'back', () => inspectionOptions(berth));
    const output = panel.querySelector('[role=status]');
    try {
      const file = await berthAttachment(key, 'get');
      if (!current() || !panel.isConnected) return;
      output.textContent = '';
      const body = panel.querySelector('[data-media]');
      if (file) {
        const media = document.createElement(photo ? 'img' : 'audio');
        const url = URL.createObjectURL(file);
        const close = closeSheet;
        closeSheet = () => { URL.revokeObjectURL(url); close(); };
        // Also release the URL when the sheet's own Close button removes it.
        const observer = new MutationObserver(() => {
          if (panel.isConnected) return;
          URL.revokeObjectURL(url);
          observer.disconnect();
        });
        observer.observe(panel.parentNode, { childList: true });
        media.src = url;
        if (photo) { media.alt = t(title); media.style.maxWidth = '100%'; }
        else { media.controls = true; media.style.maxWidth = '100%'; }
        body.append(media);
      } else body.textContent = t(photo ? 'No berth photo saved' : 'No voice note saved');

      if (!writable()) return;
      const form = document.createElement('form');
      form.className = 'add-form';
      form.innerHTML = `<label class="add-label">${label(file ? 'Replace attachment' : 'Add attachment')}
        <input class="add-input" type="file" accept="${photo ? 'image/*' : 'audio/*'}" capture="${photo ? 'environment' : 'user'}" required>
        </label><button class="add-save" type="submit">${label('Save')}</button>` +
        (file ? button('delete', 'Delete') : '');
      body.append(form);
      const save = form.querySelector('[type=submit]');
      const remove = form.querySelector('[data-action=delete]');
      const change = async (operation, value) => {
        if (!writable() || !panel.isConnected || save.disabled) return;
        save.disabled = true;
        if (remove) remove.disabled = true;
        try {
          await berthAttachment(key, operation, value);
          if (current() && panel.isConnected) showBerthMedia(berth, kind);
        } catch (err) { error(panel, err); }
        finally { save.disabled = false; if (remove) remove.disabled = false; }
      };
      form.onsubmit = event => {
        event.preventDefault();
        const chosen = form.querySelector('input').files[0];
        if (!chosen?.size || !chosen.type.startsWith(photo ? 'image/' : 'audio/') || chosen.size >= 10 * 1024 * 1024) {
          output.textContent = t(photo ? 'Choose an image under 10 MB.' : 'Choose an audio file under 10 MB.');
          return;
        }
        change('put', chosen);
      };
      if (remove) remove.onclick = () => {
        if (writable() && confirm(t('Delete this berth attachment?'))) change('delete');
      };
    } catch (err) { error(panel, err); }
  }

  function showCctv(berth) {
    const key = `marinacontrol.cctv:${berthKey(berth)}`;
    const parseUrl = raw => {
      try {
        const url = new URL(raw);
        return url.protocol === 'https:' && !url.username && !url.password ? url : null;
      } catch { return null; }
    };
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; }
    catch { /* A missing or invalid local setting can be configured again. */ }
    const url = parseUrl(saved.url);
    const lastInspection = daily().find(record => record.berthId === berth.id);
    const panel = sheet(t('View CCTV'), row('Berth', berth.berthNumber) + row('Dock', berth.dockName) +
      row('Inspection time', dateText(lastInspection?.inspectionDate)) +
      (url ? `<a class="sheet-item" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(saved.name || t('Open CCTV viewer'))}</a>` :
        `<p>${label('No CCTV viewer configured in this browser.')}</p>`) +
      (writable() ? `<form class="add-form">
        <label class="add-label">${label('Camera name')}<input class="add-input" name="camera" value="${esc(saved.name)}"></label>
        <label class="add-label">${label('HTTPS viewer link')}<input class="add-input" name="url" type="url" value="${esc(url?.href)}" required></label>
        <button class="add-save" type="submit">${label('Save')}</button>
      </form>` : '') + '<p role="status"></p>' + button('back', 'Inspection Options'));
    on(panel, 'back', () => inspectionOptions(berth));
    const form = panel.querySelector('form');
    if (form) form.onsubmit = event => {
      event.preventDefault();
      if (!writable()) return;
      const values = new FormData(form);
      const viewer = parseUrl(values.get('url'));
      if (!viewer) {
        panel.querySelector('[role=status]').textContent = t('Enter a valid HTTPS viewer link.');
        return;
      }
      try {
        localStorage.setItem(key, JSON.stringify({ url: viewer.href, name: values.get('camera').trim() }));
        showCctv(berth);
      } catch (err) { error(panel, err); }
    };
  }

  function berthSheet(berth) {
    const history = historyFor(berth);
    const panel = sheet(berth.berthNumber, row('Dock', berth.dockName) +
      row('Boat', berth.assignedBoatName || t('Empty')) +
      (writable() ? button('inspect', 'Record Inspection') : '') +
      `<h3>${label('Inspection history')}</h3>
      <input class="add-input" type="search" aria-label="${label('Search inspection history')}"
        placeholder="${label('Search inspection history')}">
      <div data-history-list></div>`);
    on(panel, 'inspect', () => inspectionForm(berth));
    const input = panel.querySelector('input[type=search]');
    const historyList = panel.querySelector('[data-history-list]');
    const renderHistory = () => {
      const term = input.value.trim().toLowerCase();
      const matches = history.filter(item => [berth.assignedBoatName, item.berthNumber,
        item.inspectorName, item.assignedTo, item.notes, item.damageDescription]
        .some(value => String(value ?? '').toLowerCase().includes(term)));
      historyList.innerHTML = matches.map((item, i) => `<button type="button" class="sheet-item" data-history="${i}">
        <span class="sheet-item-text"><span class="sheet-item-title">${esc(dateText(item.inspectionDate))}</span>
        <span class="sheet-item-subtitle">${esc(item.inspectorName)} · ${faults(item).length} ${label('issues found')}</span></span>
      </button>`).join('') || `<p>${label(term ? 'No matching inspections' : 'No inspections recorded')}</p>`;
      historyList.querySelectorAll('[data-history]').forEach(el => {
        el.onclick = () => detail(berth, matches[Number(el.dataset.history)]);
      });
    };
    input.oninput = renderHistory;
    renderHistory();
  }

  async function crewOptions(berth, onlyBoat) {
    const result = await getDocs(scoped('crew'));
    return [...new Set(result.docs.map(d => d.data())
      .filter(crew => !onlyBoat || (berth.boatId > 0 && Number(crew.boatId) === berth.boatId))
      .map(crew => crew.name || crew.fullName).filter(Boolean))].sort();
  }

  function populateCrew(panel, berth, onlyBoat, selected = '') {
    const select = panel.querySelector('[name=assignedTo]');
    select.disabled = true;
    return crewOptions(berth, onlyBoat).then(names => {
      if (!current() || !panel.isConnected) return;
      for (const name of new Set([...names, ...(selected ? [selected] : [])])) {
        select.add(new Option(name, name, false, name === selected));
      }
      select.disabled = false;
    }).catch(err => error(panel, err));
  }

  function inspectionForm(berth) {
    const cloudId = crypto.randomUUID();
    const panel = sheet(berth.berthNumber, `<form class="add-form">
      ${checks.map(([key, title]) => `<label class="add-label">${label(title)}
        <select class="add-input" name="${key}" required>
          <option value="">${label('Not Inspected')}</option><option value="OK">OK</option>
          <option value="Fault">${label('Fault')}</option>
        </select></label>`).join('')}
      <label class="add-label" data-damage hidden>${label('Damage description')}
        <textarea class="add-input" name="damageDescription"></textarea></label>
      <label class="add-label">${label('Notes')}<textarea class="add-input" name="notes"></textarea></label>
      <label class="add-label">${label('Assigned to')}
        <select class="add-input" name="assignedTo"><option value="">${label('Unassigned')}</option></select></label>
      <label class="add-label">${label('Inspection photo')}
        <input class="add-input" type="file" name="photo" accept="image/*"></label>
      <p role="status"></p>
      <button class="add-save" type="submit">${label('Complete inspection')}</button>
    </form>`);
    const form = panel.querySelector('form');
    form.elements.pontoonDamage.onchange = () => {
      panel.querySelector('[data-damage]').hidden = form.elements.pontoonDamage.value !== 'Fault';
      if (form.elements.pontoonDamage.value !== 'Fault') form.elements.damageDescription.value = '';
    };
    populateCrew(panel, berth, true);
    form.onsubmit = async event => {
      event.preventDefault();
      const save = form.querySelector('[type=submit]');
      if (save.disabled || !writable()) return;
      const values = new FormData(form);
      const photo = values.get('photo');
      if (photo?.size && (!photo.type.startsWith('image/') || photo.size >= 10 * 1024 * 1024)) {
        form.querySelector('[role=status]').textContent = t('Choose an image under 10 MB.');
        return;
      }
      save.disabled = true;
      const inspectionDate = Date.now();
      const item = {
        id: inspectionDate, cloudId, clientId, berthId: berth.id, berthNumber: berth.berthNumber,
        inspectorName: store.userProfile?.name || '', inspectionDate, completed: true,
        ...Object.fromEntries(checks.map(([key]) => [key, values.get(key)])),
        damageDescription: String(values.get('damageDescription')).trim(),
        notes: String(values.get('notes')).trim(), assignedTo: values.get('assignedTo') || null,
        maintenanceTaskId: 0, maintenanceTaskCloudId: null,
        photoPath: null, photoUrl: null, photoStoragePath: null
      };
      try {
        if (photo?.size) {
          const path = `tenants/${clientId}/inspections/${cloudId}/evidence.jpg`;
          const object = ref(getStorage(app), path);
          await uploadBytes(object, photo, { contentType: photo.type });
          item.photoUrl = await getDownloadURL(object);
          item.photoStoragePath = path;
        }
        if (!writable() || !panel.isConnected) throw new Error('Session changed');
        await setDoc(doc(db, 'inspections', cloudId), { ...item, syncedAt: serverTimestamp() });
        if (current() && panel.isConnected) closeSheet();
      } catch (err) { error(panel, err); }
      finally { save.disabled = false; }
    };
  }

  async function maintenanceRef(item) {
    if (item.maintenanceTaskCloudId) {
      return doc(db, 'maintenance', item.maintenanceTaskCloudId);
    }
    if (!item.maintenanceTaskId) return null;
    const result = await getDocs(query(scoped('maintenance'), where('id', '==', item.maintenanceTaskId)));
    if (result.size !== 1) throw new Error('Maintenance link could not be resolved');
    return result.docs[0].ref;
  }

  function detail(berth, item) {
    const linked = item.maintenanceTaskCloudId || item.maintenanceTaskId;
    const expectedPhoto = `tenants/${clientId}/inspections/${item.cloudId}/evidence.jpg`;
    const panel = sheet(berth.berthNumber,
      row('Date', dateText(item.inspectionDate)) + row('Inspector', item.inspectorName) +
      checks.map(([key, title]) => row(title, t(status(item, key)))).join('') +
      row('Damage description', item.damageDescription) + row('Notes', item.notes) +
      row('Assigned to', item.assignedTo || t('Unassigned')) +
      (item.photoStoragePath === expectedPhoto ? button('photo', 'Inspection photo') : '') +
      (linked ? button('maintenance', 'View maintenance') :
        writable() && faults(item).length ? button('create', 'Create maintenance task') : '') +
      (writable() ? button('assign', 'Assign to crew') : '') +
      button('history', 'Inspection history') + '<p role="status"></p>');
    on(panel, 'history', () => berthSheet(berth));
    on(panel, 'photo', async () => {
      try {
        const url = await getDownloadURL(ref(getStorage(app), expectedPhoto));
        if (!current() || !panel.isConnected || panel.querySelector('img')) return;
        const img = new Image();
        img.alt = t('Inspection photo');
        img.style.maxWidth = '100%';
        img.src = url;
        panel.querySelector('.md-body').append(img);
      } catch (err) { error(panel, err); }
    });
    on(panel, 'maintenance', async () => {
      try {
        const target = await maintenanceRef(item);
        const snap = await getDoc(target);
        if (!snap.exists() || snap.data().clientId !== clientId) throw new Error('Maintenance unavailable');
        if (current() && panel.isConnected) {
          closeSheet();
          const root = document.getElementById('modalRoot');
          const before = new Set(root.children);
          showMaintenanceDetail(snap.data());
          const added = [...root.children].filter(node => !before.has(node));
          closeSheet = () => added.forEach(node => node.remove());
        }
      } catch (err) { error(panel, err); }
    });
    on(panel, 'create', () => changeInspection(panel, berth, item, 'create'));
    on(panel, 'assign', () => {
      const assign = sheet(t('Assign to crew'), `<label class="add-label">${label('Assigned to')}
        <select class="add-input" name="assignedTo"><option value="">${label('Unassigned')}</option></select>
        </label>${button('save', 'Save')}<p role="status"></p>`);
      const save = assign.querySelector('[data-action=save]');
      const select = assign.querySelector('select');
      save.disabled = true;
      populateCrew(assign, berth, false, item.assignedTo).then(() => { save.disabled = select.disabled; });
      on(assign, 'save', () => changeInspection(assign, berth, item, 'save', select.value || null));
    });
  }

  async function changeInspection(panel, berth, item, action, assignee) {
    const control = panel.querySelector(`[data-action="${action}"]`);
    if (!writable() || control.disabled) return;
    control.disabled = true;
    try {
      const existingTask = action === 'save' ? await maintenanceRef(item) : null;
      const taskId = crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647 + 1;
      const newTask = action === 'create' ? doc(collection(db, 'maintenance'), crypto.randomUUID()) : null;
      await runTransaction(db, async tx => {
        const target = doc(db, 'inspections', item.cloudId);
        const snap = await tx.get(target);
        const task = existingTask ? await tx.get(existingTask) : null;
        if (!writable() || !panel.isConnected || !snap.exists() || snap.data().clientId !== clientId)
          throw new Error('Inspection unavailable');
        const record = snap.data();
        const now = Date.now();
        const actor = String(store.userProfile?.userId || uid);
        if (newTask) {
          if (record.maintenanceTaskId || record.maintenanceTaskCloudId || !faults(record).length)
            throw new Error('Inspection already linked or has no faults');
          const date = new Date(now);
          const day = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
          tx.set(newTask, {
            id: taskId, cloudId: newTask.id, clientId, berthId: berth.id, boatId: berth.boatId || null,
            source: 'Dock Walk Inspection', priority: 'HIGH', status: 'ACTIVE', completed: false, archived: false,
            type: `Dock Walk: ${berth.berthNumber} - ${faults(record).map(([,title]) => title).join(', ')}`,
            date: day, notes: [dateText(record.inspectionDate), record.damageDescription,
              ...checks.map(([key,title]) => `${title}: ${status(record,key)}`), record.notes].filter(Boolean).join('\n'),
            assignedTo: record.assignedTo || null, lastModified: now, lastModifiedBy: actor,
            syncedAt: now, syncTime: serverTimestamp()
          });
          tx.update(target, { maintenanceTaskId: taskId, maintenanceTaskCloudId: newTask.id, syncedAt: serverTimestamp() });
        } else {
          if (record.maintenanceTaskCloudId !== item.maintenanceTaskCloudId || record.maintenanceTaskId !== item.maintenanceTaskId)
            throw new Error('Maintenance link changed');
          if (task) {
            if (!task.exists() || task.data().clientId !== clientId || task.data().archived ||
                Number(task.data().berthId) !== berth.id) throw new Error('Maintenance cannot be edited');
            tx.update(existingTask, { assignedTo: assignee, assignedBy: assignee ? store.userProfile?.name || actor : null,
              assignedAt: assignee ? now : 0, lastModified: now, lastModifiedBy: actor, syncedAt: now, syncTime: serverTimestamp() });
          }
          tx.update(target, { assignedTo: assignee, syncedAt: serverTimestamp() });
        }
      });
      if (current() && panel.isConnected) berthSheet(berth);
    } catch (err) { error(panel, err); }
    finally { control.disabled = false; }
  }

  screen.querySelector('[data-back]').onclick = () => { location.hash = '#/berths'; };
  screen.querySelector('[data-help]').onclick = () => {
    const steps = [
      'Select Inspect on a berth card to begin an inspection.',
      'Check lighting, shore power, water, bollards and the pontoon. Add notes or a damage description where needed.',
      'Open a recorded fault and select Create maintenance task when follow-up is required.',
      'Select History on a berth card to review previous inspections, findings, notes and damage records.',
      'Open Progress to see today’s inspected berths, remaining berths, issues, maintenance tasks raised today and latest inspection details.'
    ];
    sheet(t('Dock Walk'), `<p class="help-desc">${label('Inspect marina berths, record infrastructure issues, review inspection history, and raise maintenance tasks directly from the Dock Walk workflow.')}</p>
      ${steps.map((step, index) => `<div class="help-step"><div class="help-step-num">${index + 1}</div>
        <div class="help-step-text">${label(step)}</div></div>`).join('')}
      <div class="help-divider"></div>
      <h3>${label('Tips')}</h3>
      <ul class="help-tips">${[
        'Complete each berth inspection once per daily dock walk.',
        'Select OK when no problem is found.',
        'Select Fault when a problem is identified.',
        'Mark Pontoon as Fault for visible structural damage.',
        'Raise a maintenance task only when follow-up work is required.',
        'Use History to confirm when a berth was last inspected.'
      ].map(tip => `<li>${label(tip)}</li>`).join('')}</ul>
      <p>${label('Need help?')} <a href="mailto:support@marinacontrol.com">support@marinacontrol.com</a></p>`);
  };
  screen.querySelector('[data-audit]').onclick = () => {
    if (!berths || !records || failed) return;
    const todayRecords = daily();
    const checked = new Set(todayRecords.map(record => record.berthId)).size;
    const percent = berths.length ? Math.floor(checked * 100 / berths.length) : 0;
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const panel = sheet(t('Dock Audit'), `<div role="progressbar" aria-label="${label('Dock Audit')}"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
      <span>${percent}%</span>
      <div class="pf-progress-track"><div class="pf-progress-fill" style="width:${percent}%"></div></div>
      </div>` + row('Inspected today', `${checked} / ${berths.length}`) +
      row('Remaining', String(berths.length - checked)) +
      row('issues found', String(new Set(todayRecords.filter(item => faults(item).length).map(item => item.berthId)).size)) +
      row('Last inspection', dateText(records[0]?.inspectionDate)) + row('Inspector', records[0]?.inspectorName) +
      `<p data-maintenance-count role="status">${label('Loading...')}</p>`);
    const count = panel.querySelector('[data-maintenance-count]');
    getDocs(query(scoped('maintenance'), where('date', '==', day))).then(snapshot => {
      if (!current() || !panel.isConnected) return;
      const total = snapshot.docs.filter(entry => entry.data().source === 'Dock Walk Inspection').length;
      count.textContent = `${t('Maintenance tasks raised today')} · ${total}`;
    }).catch(() => {
      if (current() && panel.isConnected) count.textContent = t('Maintenance task count unavailable');
    });
  };
  search.oninput = issues.onchange = render;
  render();
  const stopBerths = listenForBerths(clientId, (items, err) => {
    failed ||= !!err;
    berths = items;
    render();
  });
  const stopInspections = onSnapshot(scoped('inspections'), snapshot => {
    records = snapshot.docs.map(d => ({ ...d.data(), cloudId: d.id }))
      .sort((a, b) => (b.inspectionDate || 0) - (a.inspectionDate || 0));
    render();
  }, err => {
    console.error('Dock Walk:', err);
    failed = true;
    render();
  });
  cleanup = () => { alive = false; stopBerths(); stopInspections(); closeSheet(); };
}
