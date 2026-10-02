import { t as tr, getLocale as uiLocale } from '../i18n.js';
import { t, getLocale, languagePicker } from '../i18n.js';
// js/screens/ManageMarinasSheet.js
import { store } from '../store.js';
import { auth } from '../firebase.js';
import { getMyMarinas } from '../db.js';
import { esc } from '../utils.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const functions = getFunctions(auth.app, 'us-central1');
let openSheet = null;
const buttonStyle = 'padding:12px;border:1px solid #737D89;border-radius:8px;background:#151A20;color:#F5F7F9;font:inherit;cursor:pointer;';
const inputStyle = 'box-sizing:border-box;width:100%;margin-top:5px;padding:11px;border:1px solid #737D89;border-radius:7px;background:#151A20;color:#F5F7F9;font:inherit;';

export function showManageMarinasSheet() {
  if (openSheet || !store.authUser) return;
  const uid = store.authUser.uid;
  const sourceClientId = Number(store.activeClientId);
  const canCreate = (store.activeRole || store.userProfile?.role) === 'admin';
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-labelledby', 'mmTitle');
  sheet.style.cssText = 'padding:20px;box-sizing:border-box;max-height:85dvh;overflow:auto;color:#F5F7F9;background:#1C222A;';
  sheet.innerHTML = `
    <div class="assign-handle"></div>
    <h2 id="mmTitle" style="margin:10px 0 16px;font-size:20px;">${t("Manage Marinas")}</h2>
    <div id="mmList" style="display:grid;gap:8px;margin-bottom:16px;"></div>
    <div id="mmActions" style="display:flex;flex-wrap:wrap;gap:8px;">
      ${canCreate ? `<button type="button" id="mmAdd" style="${buttonStyle}">${t("Add Marina")}</button>` : ''}
      <button type="button" id="mmJoin" style="${buttonStyle}">${t("Join Marina")}</button>
      <button type="button" id="mmRefresh" style="${buttonStyle}">${t("Refresh List")}</button>
    </div>
    <div id="mmForm"></div>
    <p id="mmStatus" role="status" aria-live="polite" style="white-space:pre-wrap;overflow-wrap:anywhere;"></p>
    <button type="button" id="mmClose" style="${buttonStyle}width:100%;">${t("Close")}</button>`;
  const root = document.getElementById('modalRoot');
  if (!root) return;
  root.append(backdrop, sheet);
  openSheet = sheet;
  const priorFocus = document.activeElement;
  let busy = false;
  const $ = selector => sheet.querySelector(selector);
  function validSession() {
    if (store.authUser?.uid !== uid || Number(store.activeClientId) !== sourceClientId) {
      throw new Error(tr('Your active marina changed. Close this sheet and try again.'));
    }
  }
  function status(message, error = false) {
    $('#mmStatus').textContent = message;
    $('#mmStatus').style.color = error ? '#FF8A80' : '#AEB6C1';
  }
  function setBusy(value) {
    busy = value;
    sheet.querySelectorAll('button,input').forEach(el => { el.disabled = value; });
  }
  function close() {
    if (busy) return;
    sheet.remove(); backdrop.remove(); openSheet = null;
    document.removeEventListener('keydown', onKey);
    if (priorFocus?.isConnected) priorFocus.focus();
  }
  function onKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const items = [...sheet.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
    const first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('click', close);
  $('#mmClose').addEventListener('click', close);
  requestAnimationFrame(() => {
    if (!sheet.isConnected) return;
    backdrop.classList.add('is-open'); sheet.classList.add('is-open');
    sheet.querySelector('button')?.focus();
  });
  function renderList() {
    $('#mmList').innerHTML = store.marinas.map(m => `
      <div style="border:1px solid #0A8EF7;border-radius:10px;padding:14px;background:#172532;">
        <strong>${esc(m.name)}</strong>
        <div style="color:#AEB6C1;font-size:13px;margin-top:4px;">${esc(m.role || 'staff')}${Number(m.id) === sourceClientId ? ' · Active' : ''}</div>
        ${Number(m.id) !== sourceClientId ? `<button type="button" data-switch="${Number(m.id)}" style="${buttonStyle}margin-top:8px;">${t("Switch to Marina")}</button>` : ''}
        ${m.role === 'admin' ? `<button type="button" data-invite="${Number(m.id)}" style="${buttonStyle}margin-top:8px;">${t("Show Invite Code")}</button>` : ''}
      </div>`).join('');
    $('#mmList').querySelectorAll('[data-switch]').forEach(btn => {
      btn.addEventListener('click', () => run(async () => {
        const { switchMarina } = await import('../router.js');
        await switchMarina(Number(btn.dataset.switch));
      }));
    });
    $('#mmList').querySelectorAll('[data-invite]').forEach(btn => {
      btn.addEventListener('click', () => run(async () => {
        const result = await call('getMarinaInvite', {clientId: Number(btn.dataset.invite)});
        status(`Invite code: ${result.inviteCode}\nAnyone with this code can join as staff. Share it only with authorised colleagues.`);
      }));
    });
  }
  async function call(name, data) {
    validSession();
    return (await httpsCallable(functions, name)(data)).data;
  }
  async function run(action) {
    if (busy) return;
    setBusy(true); status('Please wait…');
    try { validSession(); await action(); }
    catch (error) { console.error('[manage marinas]', error); status(error.message || 'Unable to complete this action.', true); }
    finally { if (sheet.isConnected) setBusy(false); }
  }
  async function loadAndSwitch(id) {
    // The backend action has succeeded; do not encourage repeating marina creation.
    status('Marina saved. Loading your marina list…');
    try {
      await auth.currentUser.getIdToken(true);
      const marinas = (await getMyMarinas(uid, store.userProfile?.userId || 0))
        .filter(m => Number(m.isActive) === 1);
      validSession();
      store.marinas = marinas;
      if (!marinas.some(m => Number(m.id) === Number(id))) throw new Error(tr('New marina not yet visible'));
      // Storage failure must not repeat an already successful backend operation.
      localStorage.setItem(`marinacontrol.activeMarina.${uid}`, String(id));
      const route = location.hash.split('?')[0];
      const safeRoute = route === '#/boat-dashboard' ? '#/boats' : (route || '#/boats');
      history.replaceState(null, '', `${location.pathname}${location.search}${safeRoute}`);
      location.reload();
    } catch (error) {
      console.error('[manage marinas] refresh after save failed', error);
      status('Marina saved successfully. Close this sheet and refresh the WebApp to load it.');
      renderList();
    }
  }
  $('#mmRefresh').addEventListener('click', () => run(async () => {
    store.marinas = (await getMyMarinas(uid, store.userProfile?.userId || 0))
      .filter(m => Number(m.isActive) === 1);
    validSession();
    renderList(); status('Marina list refreshed.');
  }));
  function showForm(mode) {
    const adding = mode === 'add';
    $('#mmForm').innerHTML = `
      <form id="mmDetails" style="display:grid;gap:12px;margin-top:16px;">
        ${adding ? `
          <label>${t("Marina name")}<input name="name" required maxlength="120" style="${inputStyle}"></label>
          <label>${t("Country code (e.g. ES, AE, GB)")}<input name="countryCode" required minlength="2" maxlength="2" pattern="[A-Za-z]{2}" style="${inputStyle}"></label>
          <label>${t("Email (optional)")}<input name="email" type="email" maxlength="254" style="${inputStyle}"></label>
          <label>${t("Phone (optional)")}<input name="phone" type="tel" maxlength="50" style="${inputStyle}"></label>
          <p style="margin:0;color:#AEB6C1;">${t("The new marina joins the current marina’s organisation. You will be its administrator.")}</p>
        ` : `
          <label>${t("Invite code")}<input name="inviteCode" required minlength="6" maxlength="32" pattern="[A-Za-z0-9]{6,32}" autocomplete="off" style="${inputStyle}"></label>
          <label>${t("Your name")}<input name="displayName" required minlength="2" maxlength="100" value="${esc(store.userProfile?.name || '')}" style="${inputStyle}"></label>
          <p style="margin:0;color:#AEB6C1;">${t("Use the invite code provided by that marina’s administrator. Joining requires a verified email.")}</p>
        `}
        <button type="submit" style="${buttonStyle}background:#0A8EF7;border-color:#0A8EF7;">${adding ? 'Create Marina' : tr('Join Marina')}</button>
      </form>`;
    status('');
    $('#mmDetails input')?.focus();
    $('#mmDetails').addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      run(async () => {
        const result = adding
          ? await call('createMarina', {...data, sourceClientId})
          : await call('redeemMarinaInvite', {...data, inviteCode: data.inviteCode.trim().toUpperCase()});
        // Prevent a second submission after a successful save, even if refresh fails.
        $('#mmForm').replaceChildren();
        await loadAndSwitch(result.marina?.id || result.client?.id);
      });
    });
  }
  $('#mmAdd')?.addEventListener('click', () => {
    $('#mmForm').innerHTML = `
      <h3 style="margin:18px 0 12px;">${t("Add Marina")}</h3>
      <div style="display:grid;gap:10px;">
        <button type="button" id="mmSingle" style="${buttonStyle}text-align:left;">${t("Add Single Marina")}<br><small>${t("Add one marina manually")}</small></button>
        <button type="button" id="mmBulk" style="${buttonStyle}text-align:left;">${t("Bulk Import")}<br><small>${t("Import multiple marinas from a CSV file")}</small></button>
      </div>`;
    status('');
    $('#mmSingle').addEventListener('click', () => showForm('add'));
    $('#mmBulk').addEventListener('click', showBulkForm);
    $('#mmSingle').focus();
  });
  function showBulkForm() {
    $('#mmForm').innerHTML = `
      <form id="mmBulkForm" style="display:grid;gap:12px;margin-top:18px;">
        <h3 style="margin:0;">${t("Bulk Import Marinas")}</h3>
        <p style="margin:0;color:#AEB6C1;">${t("CSV columns: name,countryCode,email,phone. Name and two-letter country code are required. Maximum 50 marinas.")}</p>
        <button type="button" id="mmTemplate" style="${buttonStyle}">${t("Download CSV Template")}</button>
        <label>${t("CSV file")}<input name="csv" type="file" accept=".csv,text/csv" required style="${inputStyle}"></label>
        <div id="mmPreview" style="color:#AEB6C1;"></div>
        <button type="submit" style="${buttonStyle}background:#0A8EF7;">${t("Import Marinas")}</button>
      </form>`;
    status('');
    $('#mmTemplate').addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob(['name,countryCode,email,phone\r\n'], {type:'text/csv;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'marinas-template.csv'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    let prepared = null;
    $('#mmBulkForm input').addEventListener('change', async event => {
      prepared = null;
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 1024 * 1024) throw new Error(tr('CSV file must be smaller than 1 MB.'));
        prepared = parseMarinaCsv(await file.text());
        $('#mmPreview').textContent = `${prepared.length} marinas ready to import.`;
        status('');
      } catch (error) { status(error.message, true); $('#mmPreview').textContent = ''; }
    });
    $('#mmBulkForm').addEventListener('submit', event => {
      event.preventDefault();
      if (!prepared) { status('Select a valid CSV file first.', true); return; }
      const rows = prepared;
      run(async () => {
        // Remove submission controls: partial imports must not be submitted twice.
        $('#mmForm').replaceChildren();
        let added = 0, skipped = 0;
        const errors = [];
        const existing = new Set(store.marinas.map(m => `${m.name.trim().toLowerCase()}|${m.countryCode || ''}`));
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const key = `${row.name.toLowerCase()}|${row.countryCode}`;
          if (existing.has(key)) { skipped++; continue; }
          status(`Importing marina ${i + 1} of ${rows.length}…`);
          try {
            await call('createMarina', {...row, sourceClientId});
            existing.add(key); added++;
          } catch (error) {
            errors.push(`${row.name}: ${error.message || 'Creation failed'}`);
            // Stop on access/session/network errors; their outcome may be uncertain.
            if (['functions/unauthenticated', 'functions/permission-denied', 'functions/unavailable', 'functions/deadline-exceeded', 'functions/internal'].includes(error.code) || store.authUser?.uid !== uid) break;
          }
        }
        try {
          store.marinas = (await getMyMarinas(uid, store.userProfile?.userId || 0)).filter(m => Number(m.isActive) === 1);
          renderList();
        } catch (error) { errors.push('Refresh the WebApp to load the updated marina list.'); }
        const notProcessed = rows.length - added - skipped - errors.filter(e => !e.startsWith('Refresh')).length;
        status(`Import complete: ${added} added · ${skipped} skipped · ${errors.filter(e => !e.startsWith('Refresh')).length} failed${notProcessed > 0 ? ` · ${notProcessed} not processed` : ''}.${errors.length ? '\n' + errors.join('\n') : ''}`, errors.length > 0);
      });
    });
  }
  $('#mmJoin').addEventListener('click', () => showForm('join'));
  renderList();
}

// RFC-style CSV quoting: supports commas, escaped quotes and line breaks in fields.
export function parseMarinaCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"') {
      if (field || closed) throw new Error(tr('Invalid CSV quoting.'));
      quoted = true;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(field); field = ''; closed = false;
      if (ch !== ',') {
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      }
    } else {
      if (closed && !/\s/.test(ch)) throw new Error(tr('Unexpected text after a quoted CSV field.'));
      if (!closed) field += ch;
    }
  }
  if (quoted) throw new Error(tr('Unclosed quoted CSV field.'));
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  if (rows.length < 2) throw new Error(tr('CSV must contain a header and at least one marina.'));
  const header = rows.shift().map(v => v.trim().toLowerCase());
  if (new Set(header).size !== header.length || !header.includes('name') || !header.includes('countrycode')) {
    throw new Error(tr('CSV requires unique column headers including name and countryCode.'));
  }
  if (rows.length > 50) throw new Error(tr('Import a maximum of 50 marinas at a time.'));
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`Row ${index + 2}: column count does not match the header.`);
    const get = name => (values[header.indexOf(name)] || '').trim();
    const marina = {name:get('name'), countryCode:get('countrycode').toUpperCase(), email:get('email'), phone:get('phone')};
    if (!marina.name || marina.name.length > 120 || !/^[A-Z]{2}$/.test(marina.countryCode) || marina.email.length > 254 || marina.phone.length > 50) {
      throw new Error(`Row ${index + 2}: check name, country code and contact lengths.`);
    }
    if (marina.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(marina.email)) throw new Error(`Row ${index + 2}: invalid email.`);
    return marina;
  });
}
