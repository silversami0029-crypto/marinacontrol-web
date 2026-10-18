import { store } from '../store.js';
import { auth } from '../firebase.js';
import { getLocale } from '../i18n.js';
import { procedureLabel as t } from './ProcedureLabels.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { confirmSheet } from '../ui/confirm.js';

const categories = ['Berthing & dock operations', 'Infrastructure & utilities', 'Safety & emergencies', 'Environment & waste', 'Staff & contractors', 'Other'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cleanup = () => {};
export function unmountProceduresScreen() { cleanup(); cleanup = () => {}; }
export function mountProceduresScreen() {
  unmountProceduresScreen();
  const linkUrl = new URL('../../css/procedures.css', import.meta.url).href;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === linkUrl)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = linkUrl; document.head.append(link);
  }
  const clientId = Number(store.activeClientId), uid = auth.currentUser?.uid;
  const screen = document.getElementById('screen');
  screen.innerHTML = `<section class="procedures-screen">
    <div class="doc-header"><div class="doc-header-row">
      <button type="button" class="doc-icon-btn" id="prBack" aria-label="${t('Back')}">‹</button>
      <div class="doc-pill">${t('Procedures')}</div><div class="doc-header-spacer"></div>
      <button type="button" class="doc-icon-btn" id="prRefresh" aria-label="${t('Refresh')}">↻</button>
    </div></div>
    <form id="prSearch" class="pr-search">
      <label class="add-label" for="prQuestion">${t('Search procedure contents or ask a question')}</label>
      <input class="add-input" id="prQuestion" maxlength="600" placeholder="${t('e.g. report a damaged pedestal')}" required>
      <div class="pr-actions"><button class="csv-btn csv-btn--choose" type="submit">${t('Search contents')}</button>
      <button class="csv-btn csv-btn--cancel" type="button" id="prAsk" disabled>${t('Ask procedures')}</button></div>
    </form>
    <div class="pr-filters">
      <label>${t('Category')}<select class="add-input add-select" id="prCategory"><option value="">${t('All categories')}</option>${categories.map(value => `<option value="${esc(value)}">${t(value)}</option>`).join('')}</select></label>
      <label>${t('Asset tag')}<input class="add-input" id="prTag" maxlength="40" placeholder="${t('e.g. pontoon, electrical')}" list="prTags"><datalist id="prTags"></datalist></label>
      <label>${t('Status')}<select class="add-input add-select" id="prStatus"><option value="current">${t('Approved / current')}</option></select></label>
    </div>
    <p class="pr-status" id="prStatusMessage" role="status" aria-live="polite"></p>
    <div id="prResults" class="pr-results"></div>
    <div class="doc-list" id="prList"></div>
    <button class="csv-btn csv-btn--cancel" id="prMore" type="button" hidden>${t('Load more')}</button>
    <button class="cm-fab" id="prAdd" type="button" hidden aria-label="${t('Upload procedure')}">+</button>
  </section>`;
  const root = screen.firstElementChild, modals = new Set(), objectUrls = new Set(), confirmations = new AbortController();
  let alive = true, items = [], canManage = false, nextCursor = null, loading = false, searchGeneration = 0, loadGeneration = 0;
  const active = () => alive && root.isConnected && Number(store.activeClientId) === clientId && auth.currentUser?.uid === uid;
  const $ = selector => root.querySelector(selector);
  const status = message => { if (active()) $('#prStatusMessage').textContent = message; };
  const call = async (name, args = {}) => {
    if (!active()) throw new Error(t('Marina changed. Reopen Procedures.'));
    const result = await httpsCallable(getFunctions(auth.app, 'us-central1'), name, {timeout: 130000})({clientId, ...args});
    if (!active()) throw new Error(t('Marina changed. Reopen Procedures.'));
    return result.data;
  };
  const fail = error => { if (active()) { console.error('[PROCEDURES]', error); status(error.message || t('Could not load procedures')); } };
  function clearResults() { searchGeneration++; $('#prResults').replaceChildren(); }
  function render() {
    if (!active()) return;
    const category = $('#prCategory').value, tag = $('#prTag').value.trim().toLocaleLowerCase(), filter = $('#prStatus').value;
    const visible = items.filter(item => {
      const version = filter === 'current' ? item.current : item.latest;
      return version && (!category || version.category === category) && (!tag || version.assetTags.some(value => value.toLocaleLowerCase() === tag)) &&
        (filter === 'all' || (filter === 'archived' ? item.archived : filter === 'draft' ? !item.archived && item.latest?.versionId !== item.activeVersionId : !item.archived && !!item.current));
    });
    $('#prList').innerHTML = visible.length ? visible.map(item => {
      const version = filter === 'current' ? item.current : item.latest;
      return `<div class="doc-row pr-row"><div class="doc-info">
        <button type="button" class="pr-title" data-procedure="${esc(item.procedureId)}" data-version="${esc(version.versionId)}">${esc(version.title)}</button>
        <div class="doc-type">${t(version.category)} · ${t('Version')} ${esc(version.versionLabel)}</div>
        <div class="doc-notes">${esc(version.assetTags.join(' · '))}</div>
        <div class="pr-state pr-state--${item.archived ? 'archived' : version.versionId === item.activeVersionId ? 'approved' : 'draft'}">${t(item.archived ? 'Archived' : version.versionId === item.activeVersionId ? 'Approved / current' : version.status === 'FAILED' ? 'Could not process' : 'Draft — awaiting approval')}</div>
        ${item.current && item.latest?.versionId !== item.activeVersionId ? `<div class="doc-notes">${t('A separate revision is awaiting review. The approved version stays current.')}</div>` : ''}
        ${canManage ? `<button class="pr-link" type="button" data-manage="${esc(item.procedureId)}">${t('Manage versions')}</button>` : ''}
      </div></div>`;
    }).join('') : `<div class="boats-empty"><h2>${t('No matching procedures')}</h2><p>${nextCursor ? t('Load more to see additional procedures.') : t('Approved procedures will appear here.')}</p></div>`;
    $('#prMore').hidden = !nextCursor;
    root.querySelectorAll('[data-procedure]').forEach(button => button.onclick = () => showProcedure(button.dataset.procedure, button.dataset.version));
    root.querySelectorAll('[data-manage]').forEach(button => button.onclick = () => {
      const item = items.find(row => row.procedureId === button.dataset.manage);
      showProcedure(item.procedureId, item.latest.versionId);
    });
    $('#prTags').innerHTML = [...new Set(items.flatMap(item => (item.current || item.latest)?.assetTags || []))].map(tag => `<option value="${esc(tag)}"></option>`).join('');
  }
  async function load(append = false) {
    if (loading && append) return;
    const generation = ++loadGeneration; loading = true; status(t('Loading…'));
    try {
      const data = await call('listProcedures', append ? {cursor: nextCursor} : {});
      if (generation !== loadGeneration) return;
      items = append ? [...items, ...data.items] : data.items; nextCursor = data.nextCursor; canManage = data.canManage;
      $('#prAdd').hidden = !canManage;
      $('#prAsk').disabled = !data.answersConfigured;
      $('#prAsk').title = data.answersConfigured ? '' : t('Answers are not enabled. Content search is available.');
      if (canManage && $('#prStatus').options.length === 1) {
        $('#prStatus').insertAdjacentHTML('beforeend', `<option value="draft">${t('Drafts / processing issues')}</option><option value="archived">${t('Archived')}</option><option value="all">${t('All')}</option>`);
      }
      render(); status(nextCursor ? t('More procedures are available. Use Load more to browse them.') : '');
    } catch (error) { if (generation === loadGeneration) fail(error); }
    finally { if (generation === loadGeneration) loading = false; }
  }
  function modal(title, body) {
    const backdrop = document.createElement('div'); backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div'); sheet.className = 'sheet pr-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', title);
    const opener = document.activeElement;
    sheet.innerHTML = `<div class="pr-sheet-header"><div class="sheet-title">${esc(title)}</div><button class="doc-icon-btn" type="button" data-close aria-label="${t('Close')}">×</button></div>${body}`;
    let closed = false;
    const close = () => { if (closed) return; closed = true; backdrop.remove(); sheet.remove(); document.removeEventListener('keydown', keys); modals.delete(close); if (opener?.isConnected) opener.focus(); };
    const keys = event => {
      if (document.querySelector('.confirm-sheet')) return;
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focus = [...sheet.querySelectorAll('button,input,select,textarea,a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
        const first = focus[0], last = focus.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    backdrop.onclick = close; sheet.querySelector('[data-close]').onclick = close; document.addEventListener('keydown', keys);
    document.getElementById('modalRoot').append(backdrop, sheet); modals.add(close);
    requestAnimationFrame(() => { backdrop.classList.add('is-open'); sheet.classList.add('is-open'); sheet.querySelector('[data-close]').focus(); });
    return {sheet, close, active: () => !closed && active()};
  }
  async function showProcedure(procedureId, versionId) {
    status(t('Loading…'));
    try {
      const data = await call('getProcedure', {procedureId, versionId}); status('');
      const version = data.version;
      const view = modal(version.title, `<div class="add-scroll">
        <p class="doc-type">${t(version.category)} · ${t('Version')} ${esc(version.versionLabel)} · ${esc(version.fileName)}</p>
        <p class="pr-state">${t(data.archived ? 'Archived' : data.activeVersionId === version.versionId ? 'Approved / current' : version.status === 'FAILED' ? 'Could not process' : 'Draft — awaiting approval')}</p>
        ${version.error ? `<p class="add-error">${esc(version.error)}</p>` : ''}
        ${data.canManage ? `<label class="add-label">${t('Version history')}<select class="add-input add-select" id="prVersion">${data.versions.map(row => `<option value="${esc(row.versionId)}" ${row.versionId === version.versionId ? 'selected' : ''}>${esc(row.versionLabel)} · ${row.versionId === data.activeVersionId ? t('Approved / current') : t('Not current')} · ${new Date(row.createdAt).toLocaleDateString(getLocale())}</option>`).join('')}</select></label>` : ''}
        <p class="pr-note">${t('Extracted text is a search aid. Check the original file for diagrams, tables and all applicable warnings.')}</p>
        ${data.chunks.map(chunk => `<section class="pr-extract"><strong>${esc(chunk.locator)}</strong><p>${esc(chunk.text)}</p></section>`).join('')}
        <p class="add-error" id="prDetailError" role="alert"></p>
      </div><div class="pr-footer">
        <button class="csv-btn csv-btn--choose" type="button" id="prOriginal">${t('Download original')}</button>
        ${data.canManage ? `${!data.archived ? `<button class="csv-btn csv-btn--cancel" type="button" id="prRevision">${t('Upload revision')}</button>` : ''}
        ${!data.archived && version.status === 'READY' && version.versionId !== data.activeVersionId ? `<button class="csv-btn csv-btn--choose" type="button" id="prApprove">${t('Approve this version')}</button>` : ''}
        <button class="csv-btn csv-btn--cancel" type="button" id="prArchive">${t(data.archived ? 'Restore' : 'Archive')}</button>` : ''}
      </div>`);
      const report = error => { if (view.active()) view.sheet.querySelector('#prDetailError').textContent = error.message; };
      view.sheet.querySelector('#prVersion')?.addEventListener('change', event => { view.close(); showProcedure(procedureId, event.target.value); });
      view.sheet.querySelector('#prOriginal').onclick = async event => {
        const button = event.currentTarget; button.disabled = true;
        try {
          const file = await call('downloadProcedure', {procedureId, versionId: version.versionId});
          if (!view.active()) return;
          const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bytes], {type: file.mime})); objectUrls.add(url);
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.fileName; anchor.click();
          setTimeout(() => { URL.revokeObjectURL(url); objectUrls.delete(url); }, 60000);
        } catch (error) { report(error); } finally { if (view.active()) button.disabled = false; }
      };
      view.sheet.querySelector('#prRevision')?.addEventListener('click', () => { view.close(); upload(procedureId, version); });
      for (const [selector, action] of [['#prApprove', 'APPROVE'], ['#prArchive', data.archived ? 'RESTORE' : 'ARCHIVE']]) {
        view.sheet.querySelector(selector)?.addEventListener('click', async event => {
          const button = event.currentTarget; button.disabled = true;
          try {
            const ok = await confirmSheet({signal: confirmations.signal, action: action === 'APPROVE' ? 'approve' : action === 'RESTORE' ? 'restore' : 'archive',
              title: t(action === 'APPROVE' ? 'Approve this procedure version?' : action === 'ARCHIVE' ? 'Archive procedure?' : 'Restore procedure?'),
              message: t(action === 'APPROVE' ? 'Confirm this file is authorised and current. It will replace the version used for staff search and answers.' : action === 'ARCHIVE' ? 'The procedure and its history will be kept. It will stop appearing in staff search and answers.' : 'The previous approved version will become available again. Confirm it is still valid.'),
              confirmText: t(action === 'APPROVE' ? 'Approve' : action === 'ARCHIVE' ? 'Archive' : 'Restore'), cancelText: t('Cancel')});
            if (!ok || !view.active()) return;
            await call('controlProcedure', {procedureId, versionId: version.versionId, action, revision: data.revision});
            view.close(); clearResults(); await load();
          } catch (error) { report(error); } finally { if (view.active()) button.disabled = false; }
        });
      }
    } catch (error) { fail(error); }
  }
  function upload(procedureId = crypto.randomUUID(), prior = null) {
    const versionId = crypto.randomUUID();
    const view = modal(t(prior ? 'Upload revision' : 'Upload procedure'), `<form class="add-form" id="prUpload">
      <div class="add-scroll">
        <label class="add-label" for="prTitle">${t('Title')}</label><input class="add-input" id="prTitle" maxlength="160" required value="${esc(prior?.title || '')}">
        <label class="add-label" for="prUploadCategory">${t('Category')}</label><select class="add-input add-select" id="prUploadCategory">${categories.map(value => `<option value="${esc(value)}" ${value === prior?.category ? 'selected' : ''}>${t(value)}</option>`).join('')}</select>
        <label class="add-label" for="prUploadTags">${t('Asset tags — comma separated')}</label><input class="add-input" id="prUploadTags" value="${esc((prior?.assetTags || []).join(', '))}" placeholder="pontoon, electrical">
        <label class="add-label" for="prVersionLabel">${t('Version')}</label><input class="add-input" id="prVersionLabel" maxlength="40" required placeholder="1.0">
        <label class="add-label" for="prFile">${t('Procedure file')}</label><input class="add-input" id="prFile" type="file" accept=".pdf,.docx,.txt" required>
        <p class="pr-note">${t('PDF, DOCX or UTF-8 TXT. Up to 4 MB and 100 PDF pages. Scanned pages need OCR first. Uploads remain drafts until approved.')}</p>
        <p id="prUploadError" class="add-error" role="alert"></p>
      </div><button class="add-save" id="prUploadSave" type="submit">${t('Upload and process')}</button></form>`);
    view.sheet.querySelector('#prUpload').onsubmit = async event => {
      event.preventDefault(); const button = view.sheet.querySelector('#prUploadSave'), message = view.sheet.querySelector('#prUploadError');
      const file = view.sheet.querySelector('#prFile').files[0];
      if (!file || file.size > 4 * 1024 * 1024 || !/\.(pdf|docx|txt)$/i.test(file.name)) { message.textContent = t('Choose a PDF, DOCX or TXT file up to 4 MB.'); return; }
      button.disabled = true; button.textContent = t('Processing…');
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = ''; for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        const response = await call('uploadProcedure', {procedureId, versionId, fileName: file.name, base64: btoa(binary), metadata: {
          title: view.sheet.querySelector('#prTitle').value.trim(), category: view.sheet.querySelector('#prUploadCategory').value,
          versionLabel: view.sheet.querySelector('#prVersionLabel').value.trim(), assetTags: view.sheet.querySelector('#prUploadTags').value.split(',').map(value => value.trim()).filter(Boolean)
        }});
        if (!view.active()) return;
        view.close(); await load(); await showProcedure(procedureId, response.versionId);
      } catch (error) { if (view.active()) message.textContent = error.message; }
      finally { if (view.active()) { button.disabled = false; button.textContent = t('Upload and process'); } }
    };
  }
  async function search(answer) {
    const question = $('#prQuestion').value.trim(); if (!question) { $('#prQuestion').focus(); return; }
    const generation = ++searchGeneration;
    status(t(answer ? 'Finding supported passages…' : 'Searching contents…')); $('#prResults').replaceChildren();
    try {
      const data = await call(answer ? 'askProcedures' : 'searchProcedures', {question, category: $('#prCategory').value, assetTag: $('#prTag').value.trim()});
      if (generation !== searchGeneration) return;
      const hits = answer ? data.matches.map(match => ({...data.hits.find(row => row.sourceId === match.sourceId), quote: match.quote})) : data.hits;
      $('#prResults').innerHTML = `<div class="pr-panel"><h3>${t(answer ? 'Answer from approved procedures' : 'Content search results')}</h3>
        ${answer ? `<p class="pr-note">${esc(data.message)}</p>` : ''}
        ${!hits.length ? `<p>${t('No supporting passage found. Try different words or contact your supervisor.')}</p>` : hits.map((hit, n) => `<section class="pr-extract"><p>${esc(hit.quote || hit.text)}</p><button class="pr-link" type="button" data-source="${n}">${esc(hit.title)} · ${t('Version')} ${esc(hit.versionLabel)} · ${esc(hit.locator)}</button></section>`).join('')}
        ${data.truncated ? `<p class="pr-note">${t('Many matches found. These results are limited; narrow your query or filters. Search matches words, not every possible synonym.')}</p>` : ''}
      </div>`;
      $('#prResults').querySelectorAll('[data-source]').forEach(button => button.onclick = () => {const hit = hits[Number(button.dataset.source)]; showProcedure(hit.procedureId, hit.versionId);}); status('');
    } catch (error) { if (generation === searchGeneration) fail(error); }
  }
  $('#prSearch').onsubmit = event => { event.preventDefault(); search(false); };
  $('#prAsk').onclick = () => search(true);
  $('#prAdd').onclick = () => upload();
  $('#prMore').onclick = () => load(true);
  $('#prRefresh').onclick = () => { clearResults(); load(); };
  $('#prBack').onclick = () => history.back();
  for (const id of ['#prCategory', '#prTag', '#prStatus']) $(id).addEventListener('change', () => { clearResults(); render(); });
  const unsubscribe = store.subscribe(() => { if (!active()) unmountProceduresScreen(); });
  cleanup = () => { alive = false; confirmations.abort(); root.remove(); unsubscribe(); [...modals].forEach(close => close()); objectUrls.forEach(url => URL.revokeObjectURL(url)); };
  load();
}
