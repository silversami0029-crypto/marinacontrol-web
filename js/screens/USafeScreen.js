import { italianUI as itUI } from '../i18n.js';
import { store } from '../store.js';
import { getLocale } from '../i18n.js';
import { usafeLabel as tr } from '../usafe/USafeLabels.js';
import { toast } from '../ui/toast.js';
import { createUSafeService, isDemo, isClosed, inspectionStatus } from '../usafe/USafeService.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const optionIcons = {"details": "<path d=\"M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6\"/>", "assignment": "<circle cx=\"9\" cy=\"7\" r=\"3\"/><path d=\"M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v2\"/>", "checklist": "<path d=\"M8 3H5v18h14V3h-3M9 2h6v4H9zM8 11l1 1 2-2M13 11h3M8 16l1 1 2-2M13 16h3\"/>", "status": "<path d=\"M4 20V11M10 20V4M16 20v-7M22 20H2\"/>", "photos": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"1\"/><circle cx=\"8\" cy=\"8\" r=\"1.5\"/><path d=\"m3 17 5-5 4 4 4-6 5 8\"/>", "voice": "<rect x=\"9\" y=\"3\" width=\"6\" height=\"12\" rx=\"3\"/><path d=\"M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8\"/>", "more": "<circle cx=\"12\" cy=\"5\" r=\"1\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"19\" r=\"1\" fill=\"currentColor\"/>"};
const svgIcon = name => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${optionIcons[name] || ''}</svg>`;
const stamp = value => {
  const ms = value?.toMillis?.() ?? value;
  if (!ms || !Number.isFinite(Number(ms))) return tr('Not available');
  return new Intl.DateTimeFormat(getLocale(), {dateStyle:'medium', timeStyle:'short'}).format(Number(ms));
};
let dispose = null;
export function unmountUSafeScreen() { dispose?.(); dispose = null; }
export function mountUSafeScreen() {
  unmountUSafeScreen();
  const clientId = Number(store.activeClientId), uid = store.authUser?.uid;
  const host = document.getElementById('screen');
  if (!clientId || !uid) { host.textContent = tr('Select a marina first.'); return; }
  const cssUrl = new URL('../../css/usafe.css', import.meta.url).href;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(l => l.href === cssUrl)) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = cssUrl; document.head.append(css);
  }
  host.innerHTML = `<section class="usafe-screen"><header class="doc-header usafe-document-header"><div class="doc-header-row">
    <button type="button" class="doc-icon-btn" data-back aria-label="${esc(tr('Back'))}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
    <h1 class="doc-pill">USAFE</h1>
    <button type="button" class="doc-icon-btn" data-help aria-label="${esc(tr('Help'))}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.8" fill="currentColor"/></svg></button>
    <div class="doc-header-spacer"></div></div></header>
    <p class="usafe-muted">${esc(tr('Device integration pending — live device data is not connected.'))}</p>
    <div class="usafe-message" role="status" aria-live="polite">${esc(tr('Loading…'))}</div><div class="usafe-list"></div></section>`;
  const root = host.firstElementChild, list = root.querySelector('.usafe-list'), message = root.querySelector('.usafe-message');
  const service = createUSafeService(clientId,uid), rows = new Map(), pendingUploads = new Map();
  let stopped = false, offEvents = null, currentSheet = null, viewGeneration = 0;
  const active = () => !stopped && root.isConnected && store.activeClientId === clientId && store.authUser?.uid === uid;
  const writable = () => ['admin','manager','staff','inspector'].includes(store.activeRole);
  const deletable = () => ['admin','manager'].includes(store.activeRole);
  const errorText = error => {
    console.error('[USAFE]',error);
    if (/permission-denied|unauthorized/.test(error.code || '')) return tr('Permission denied. Check the USAFE rules and your marina role.');
    if (error.code === 'storage/object-not-found') return tr('This file is missing. An admin or manager can delete its remaining record.');
    if (error.code === 'storage/unknown') return tr('Attachment request failed. Check Storage permissions, connection and bucket CORS configuration.');
    return error.message || tr('Request failed. Please retry.');
  };
  function sheet(title, body, cleanup = () => {}) {
    viewGeneration++;
    currentSheet?.close();
    const opener = document.activeElement;
    const overlay = document.createElement('div'); overlay.className = 'usafe-overlay';
    overlay.innerHTML = `<section class="usafe-sheet" role="dialog" aria-modal="true" aria-label="${esc(tr(title))}" tabindex="-1"><header><h2>${esc(tr(title))}</h2><button type="button" data-close aria-label="${esc(tr('Close'))}">×</button></header><div class="usafe-sheet-body">${body}</div><p class="usafe-error" role="alert"></p></section>`;
    const panel = overlay.firstElementChild; let busy = false, closed = false;
    const result = {overlay, panel, get closed() {return closed;},
      close(force = false) {
        if (closed || (busy && !force)) return;
        closed = true; viewGeneration++; panel.querySelectorAll('audio').forEach(audio => { audio.pause(); audio.removeAttribute('src'); audio.load(); }); cleanup(); document.removeEventListener('keydown', key); overlay.remove();
        if (currentSheet === result) currentSheet = null;
        if (opener?.isConnected) opener.focus();
      },
      async run(operation, success = tr('Saved.')) {
        if (busy || !active() || closed) return;
        busy = true; panel.querySelector('.usafe-error').textContent = '';
        panel.setAttribute('aria-busy','true');
        const controls = [...panel.querySelectorAll('button,input,textarea,select')];
        const states = controls.map(c => c.disabled); controls.forEach(c => {c.disabled = true;});
        try {
          service.context(); await operation();
          result.close(true); if (active()) toast(success);
        } catch (error) {
          if (!closed && active()) panel.querySelector('.usafe-error').textContent = errorText(error);
        } finally {
          busy = false; panel.removeAttribute('aria-busy'); controls.forEach((c,i) => {c.disabled = states[i];});
        }
      }
    };
    function key(e) {
      if (e.key === 'Escape') result.close();
      if (e.key === 'Tab') {
        const all = [...panel.querySelectorAll('button,input,textarea,select,a[href],audio[controls]')].filter(e => !e.disabled && e.offsetParent !== null);
        if (!all.length) {e.preventDefault(); panel.focus(); return;}
        const first = all[0], last = all[all.length-1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {e.preventDefault(); last.focus();}
        else if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first.focus();}
      }
    }
    panel.querySelector('[data-close]').onclick = () => result.close();
    overlay.onclick = e => { if (e.target === overlay) result.close(); };
    document.addEventListener('keydown',key); document.getElementById('modalRoot').append(overlay);
    currentSheet = result; panel.focus(); return result;
  }
const buttons = (entries, menu = false) => `
  <div class="usafe-actions${menu ? ' usafe-option-list' : ''}">
    ${entries.map(([action, label, disabled = false]) => `
      <button
        type="button"
        data-action="${action}"
        ${disabled ? 'disabled' : ''}
      >
        <span>${esc(tr(label))}</span>
      </button>
    `).join('')}
  </div>
`;
  async function safeOpen(operation) {
    try { await operation(); } catch (error) { if(active()) toast(errorText(error),{kind:'error', duration:6000}); }
  }
  root.querySelector('[data-back]').onclick = () => {location.hash = '#/dashboard';};
  root.querySelector('[data-help]').onclick = () => {
    const steps = [
      ['Review the event', 'Open Event details to see the device, recorded time and event information. Demo events are labelled.'],
      ['Assign responsibility (optional)', 'Open Assign inspection to enter an assignee and, if useful, a due date. The assignee appears beside the event.'],
      ['Carry out the inspection', 'Follow the agreed inspection procedure. Inspection checklist is optional; you do not need to create a checklist to complete the inspection.'],
      ['Add photos or voice notes', 'Use Add Photo or Add Voice Note from the options menu. Once attachments exist, these become Photo options and Voice notes so you can view, play or delete them.'],
      ['Record completion', 'Open Inspection status, add any notes, then choose Complete inspection and confirm. The event status updates and the completion is recorded in its history.']
    ];
    const help = sheet(itUI('USAFE help'), `<div class="help-scroll">
      <div class="help-pill">${esc(tr('USAFE events & inspections'))}</div>
      <p class="help-desc">${esc(tr('Keep device events, inspection responsibility and supporting evidence together in the marina’s operational view.'))}</p>
      <div class="help-section-title">${esc(tr('Here’s the workflow'))}</div>
      ${steps.map(([title,body],i) => `<div class="help-step"><div class="help-step-num">${i+1}</div><div class="help-step-text"><b>${esc(tr(title))}</b><br>${esc(tr(body))}</div></div>`).join('')}
      <div class="help-divider"></div>
      <div class="help-section-title">${esc(tr('Corrections & attachments'))}</div>
      <p class="help-desc">${esc(tr('To change a completed inspection, open Inspection status and provide a reason to reopen it. Only admins and managers can delete attachments.'))}</p>
      <div class="help-section-title">${esc(tr('Device integration'))}</div>
      <p class="help-desc">${esc(tr('Live device integration is pending. Demo inspections do not confirm equipment readiness. Completion records staff confirmation, not a device readiness signal.'))}</p>
    </div>`);
    help.panel.classList.add('usafe-help');
  };
  function showMenu(row) {
    const {event, media, mediaError} = row;
    const photos = media.some(m => m.mediaType === 'photos'), voice = media.some(m => m.mediaType === 'voice');
    const s = sheet(itUI('USAFE options'),buttons([
      ['details','Event details'], ['assignment','Assign inspection',!writable()], ['checklist','Inspection checklist'],
      ['status','Inspection status'], ['photos',photos?itUI('Photo options'):itUI('Add Photo'),!!mediaError],
      ['voice',voice?itUI('Voice notes'):itUI('Add Voice Note'),!!mediaError]
    ],true) + (mediaError?`<p>${esc(tr('Attachments unavailable. Close and reopen USAFE to retry.'))}</p>`:''));
    s.panel.querySelectorAll('[data-action]').forEach(button => button.onclick = () => {
      s.close(); const action = button.dataset.action;
      if (action === 'details') showDetails(event);
      else if (action === 'photos' || action === 'voice') showMedia(row,action);
      else safeOpen(() => showInspection(event,action));
    });
  }
  function showDetails(event) {
    sheet(itUI('Event details'), `<dl>${[['Device',event.deviceName || event.deviceId],['Event',event.title],['Recorded',stamp(event.occurredAt)],['Source',event.source],['Details',event.details]].map(([k,v]) => `<dt>${esc(tr(k))}</dt><dd>${esc(v || tr('Not available'))}</dd>`).join('')}</dl>${isDemo(event)?`<p class="usafe-notice">${itUI("DEMO — no live device activation.")}</p>`:''}`);
  }
  async function showInspection(event, section) {
    const request = ++viewGeneration;
    const task = await service.load(event, writable()); if (!active() || request !== viewGeneration) return;
    if (!task) {sheet(itUI('Inspection status'),`<p>${esc(tr('No inspection recorded yet. A staff member can open one.'))}</p>`); return;}
    const closed = isClosed(task), editable = writable() && !closed;
    const intro = `<p>${esc(tr('Status'))}: <strong>${esc(tr(inspectionStatus(task)))}</strong></p><p class="usafe-muted">${esc(task.assignedTo || tr('Unassigned'))}${task.date?' · '+esc(task.date):''}</p>${task.source === 'USAFE_DEMO'?`<p class="usafe-notice">${esc(tr('DEMO inspection — not proof of equipment readiness.'))}</p>`:''}`;
    const reason = `<label>${esc(tr('Notes or reason for this change'))}<textarea data-reason rows="2" maxlength="4000"></textarea></label>`;
    if (section === 'assignment') {
      const s = sheet(itUI('Assign inspection'),intro+`<label>${esc(tr('Assigned to (optional)'))}<input data-assignee maxlength="200" value="${esc(task.assignedTo || '')}" ${editable?'':'disabled'}></label><label>${esc(tr('Due date (optional)'))}<input type="date" data-date value="${esc(task.date || '')}" ${editable?'':'disabled'}></label>`+reason+buttons([['save','Save',!editable]]));
      s.panel.querySelector('[data-action=save]').onclick = () => s.run(() => service.save(event,task,'ASSIGNED',{
        assignedTo:s.panel.querySelector('[data-assignee]').value, date:s.panel.querySelector('[data-date]').value
      },s.panel.querySelector('[data-reason]').value));
    } else if (section === 'checklist') {
      const checks = Array.isArray(task.usafeWorkflow?.checks) ? task.usafeWorkflow.checks : [];
      const s = sheet(itUI('Inspection checklist'),intro+`<p class="usafe-muted">${esc(tr('Optional checklist. Use the agreed inspection procedure.'))}</p><div data-checks>${checks.map((c,i) => `<label class="usafe-check"><input type="checkbox" data-check="${i}" ${c.checked?'checked':''} ${editable?'':'disabled'}><span>${esc(c.label)}</span></label>`).join('')}</div>${!checks.length?`<p>${esc(tr('No checklist configured.'))}</p>`:''}${editable?`<details><summary>${esc(tr('Edit checklist (optional)'))}</summary><label>${esc(tr('One item per line'))}<textarea data-definition rows="4">${esc(checks.map(c => c.label).join('\n'))}</textarea></label></details>`:''}`+reason+buttons([['save','Save',!editable]]));
      s.panel.querySelector('[data-action=save]').onclick = () => s.run(() => {
        const next = s.panel.querySelector('[data-definition]').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean).map((label,i) => ({label,
          checked:checks[i]?.label === label && !!s.panel.querySelector(`[data-check="${i}"]`)?.checked}));
        return service.save(event,task,'CHECKLIST_UPDATED',{checks:next},s.panel.querySelector('[data-reason]').value);
      });
    } else {
      const s = sheet(itUI('Inspection status'),intro+reason+buttons(closed ? [['reopen','Reopen inspection',!writable()],['history','Inspection history']] : [
        ...(task.usafeWorkflow?.stage !== 'IN_PROGRESS'?[['start','Start inspection',!writable()]]:[]),['complete','Complete inspection',!writable()],['history','Inspection history']
      ]));
      const notes = () => s.panel.querySelector('[data-reason]').value;
      s.panel.querySelector('[data-action=start]')?.addEventListener('click',() => s.run(() => service.save(event,task,'STARTED',{},notes())));
      s.panel.querySelector('[data-action=reopen]')?.addEventListener('click',() => s.run(() => service.save(event,task,'REOPENED',{},notes())));
      s.panel.querySelector('[data-action=complete]')?.addEventListener('click',() => {
        const note = notes();
        const c = sheet(itUI('Complete inspection'),`<p>${esc(tr(task.source === 'USAFE_DEMO' ? itUI('Record this demo inspection as completed? This does not confirm equipment readiness.') : itUI('Confirm that you have carried out the inspection. This records completion; it does not certify equipment readiness.')))}</p>`+buttons([['complete','Complete inspection'],['cancel','Cancel']]));
        c.panel.querySelector('[data-action=cancel]').onclick = () => c.close();
        c.panel.querySelector('[data-action=complete]').onclick = () => c.run(() => service.save(event,task,'COMPLETED',{},note),tr('Inspection completed.'));
      });
      s.panel.querySelector('[data-action=history]').onclick = () => safeOpen(async () => {
        const request = ++viewGeneration;
        const records = await service.history(event); if(!active() || s.closed || request !== viewGeneration) return;
        sheet(itUI('Inspection history'),records.length?records.map(h => `<article class="usafe-history"><strong>${esc(h.description || h.eventType)}</strong><p>${esc(h.changedBy || '')} · ${esc(stamp(h.timestamp))}</p><p>${esc(h.reason || '')}</p></article>`).join(''):`<p>${esc(tr('No inspection history yet.'))}</p>`);
      });
    }
  }
  function showMedia(row,type) {
    const photo = type === 'photos', event = row.event;
    const items = row.media.filter(m => m.mediaType === (photo?'photos':'voice')).sort((a,b) => (b.createdAt?.toMillis?.() || 0)-(a.createdAt?.toMillis?.() || 0));
    const s = sheet(photo?itUI('Photo options'):itUI('Voice notes'),`<div data-files>${items.map((m,i) => `<article class="usafe-file"><span>${esc(stamp(m.createdAt))}</span>${buttons([[`view-${i}`,photo?itUI('View photo'):itUI('Play voice note')],[`delete-${i}`,photo?itUI('Delete photo'):itUI('Delete voice note'),!deletable()]])}</article>`).join('') || `<p>${esc(tr(photo?itUI('No photos yet.'):itUI('No voice notes yet.')))}</p>`}</div>`+buttons([['add',photo?itUI('Add Photo'):itUI('Add Voice Note'),!writable()]]));
    items.forEach((media,i) => {
      s.panel.querySelector(`[data-action="view-${i}"]`).onclick = () => safeOpen(async () => {
        const url = await service.url(event,media); if(!active() || s.closed) return;
        const v = sheet(photo?itUI('View photo'):itUI('Play voice note'),photo?`<img class="usafe-photo" src="${esc(url)}" alt="${esc(tr('Inspection photo'))}">`:`<audio controls src="${esc(url)}" class="usafe-audio"></audio>`);
        v.panel.querySelector('img')?.addEventListener('error',() => {v.panel.querySelector('.usafe-error').textContent = tr('The photo could not be displayed. Close and try again.');});
        v.panel.querySelector('audio')?.addEventListener('error',() => {v.panel.querySelector('.usafe-error').textContent = tr('This browser cannot play the recording. Try a browser supporting M4A audio.');});
      });
      s.panel.querySelector(`[data-action="delete-${i}"]`).onclick = () => {
        const c = sheet(photo?itUI('Delete Photo'):itUI('Delete Voice Note'),`<div class="usafe-trash" aria-hidden="true"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></div><p>${esc(tr(photo?itUI('Are you sure you want to delete this photo?'):itUI('Are you sure you want to delete this voice note?')))}</p>`+buttons([['cancel','Cancel'],['delete','Delete']]));
        c.panel.querySelector('[data-action=delete]').classList.add('usafe-danger');
        c.panel.querySelector('[data-action=cancel]').onclick = () => c.close();
        c.panel.querySelector('[data-action=delete]').onclick = () => c.run(() => service.remove(event,media),tr(photo?'Photo deleted.':'Voice note deleted.'));
      };
    });
    s.panel.querySelector('[data-action=add]').onclick = () => photo?choosePhoto(event):chooseVoice(event);
  }
  function uploadSheet(event,blob,photo) {
    const key = `${event.documentId}:${photo?'photo':'voice'}`;
    const pending = {id:crypto.randomUUID(),blob,photo,event}; pendingUploads.set(key,pending);
    showPendingUpload(key,pending);
  }
  function showPendingUpload(key,pending) {
    const {event,blob,photo} = pending;
    const url = URL.createObjectURL(blob);
    const s = sheet(photo?itUI('Add Photo'):itUI('Add Voice Note'),`${photo?`<img class="usafe-photo" src="${url}" alt="${esc(tr('Photo preview'))}">`:`<audio class="usafe-audio" controls src="${url}"></audio>`}<p>${esc(tr('Save this attachment to the inspection?'))}</p>`+buttons([['save','Save attachment'],['discard','Discard']]),() => URL.revokeObjectURL(url));
    s.panel.querySelector('[data-action=discard]').onclick = () => {pendingUploads.delete(key); s.close();};
    s.panel.querySelector('[data-action=save]').onclick = () => s.run(async () => {
      await service.upload(event,blob,photo,pending.id); pendingUploads.delete(key);
    },tr('Attachment saved.'));
  }
  async function choosePhoto(event) {
    const key = `${event.documentId}:photo`;
    if(pendingUploads.has(key)) {showPendingUpload(key,pendingUploads.get(key)); return;}
    const s = sheet(itUI('Add Photo'),`<label>${esc(tr('Choose or take a photo'))}<input type="file" accept="image/*" data-file></label><p class="usafe-muted">${esc(tr('Photos are saved as JPEG, smaller than 10 MB.'))}</p>`);
    s.panel.querySelector('[data-file]').onchange = async e => {
      const file = e.target.files[0]; if(!file) return;
      try {
        if(file.size > 25*1024*1024) throw new Error('Choose a photo smaller than 25 MB.');
        const image = await createImageBitmap(file);
        const scale = Math.min(1,2048/Math.max(image.width,image.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale));
        const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0,canvas.width,canvas.height); image.close();
        const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.88));
        if(!blob) throw new Error('This photo could not be converted. Choose a JPEG or PNG.');
        if(active() && !s.closed) uploadSheet(event,blob,true);
      } catch(error) {if(!s.closed) s.panel.querySelector('.usafe-error').textContent = errorText(error);}
    };
  }
  function chooseVoice(event) {
    const key = `${event.documentId}:voice`;
    if(pendingUploads.has(key)) {showPendingUpload(key,pendingUploads.get(key)); return;}
    const mime = typeof MediaRecorder !== 'undefined' && ['audio/mp4;codecs=mp4a.40.2','audio/mp4'].find(m => MediaRecorder.isTypeSupported(m));
    let stream = null, recorder = null, timer = null, discarded = false;
    const s = sheet(itUI('Add Voice Note'),`${mime && navigator.mediaDevices?.getUserMedia?buttons([['record','Record voice note']]):`<p>${esc(tr('This browser cannot record M4A audio. Choose an existing M4A/MP4 voice note instead.'))}</p>`}<p data-record-status role="status"></p><label>${esc(tr('Choose M4A/MP4 audio (under 10 MB)'))}<input type="file" accept=".m4a,.mp4,audio/mp4,audio/x-m4a" data-file></label>`,() => {
      discarded=true; clearTimeout(timer); if(recorder?.state === 'recording') recorder.stop(); stream?.getTracks().forEach(t => t.stop());
    });
    s.panel.querySelector('[data-file]').onchange = async e => {
      try {
        const file=e.target.files[0]; if(!file) return;
        if(file.size <= 0 || file.size >= 10*1024*1024) throw new Error('Choose an audio file smaller than 10 MB.');
        const head = new Uint8Array(await file.slice(0,12).arrayBuffer());
        if(String.fromCharCode(...head.slice(4,8)) !== 'ftyp') throw new Error('Choose an actual M4A/MP4 audio file. Renaming another format will not work.');
        if(active() && !s.closed) uploadSheet(event,new Blob([file],{type:'audio/mp4'}),false);
      } catch(error) {if(!s.closed) s.panel.querySelector('.usafe-error').textContent=errorText(error);}
    };
    const button = s.panel.querySelector('[data-action=record]');
    if(button) button.onclick = async () => {
      if(recorder?.state === 'recording') {recorder.stop(); return;}
      button.disabled=true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({audio:true});
        if(!active() || s.closed) {stream.getTracks().forEach(t=>t.stop()); return;}
        const chunks=[]; let bytes=0;
        recorder = new MediaRecorder(stream,{mimeType:mime});
        recorder.ondataavailable = e => {if(e.data.size) {chunks.push(e.data); bytes+=e.data.size; if(bytes >= 9*1024*1024 && recorder.state === 'recording') recorder.stop();}};
        recorder.onstop = () => {
          clearTimeout(timer); stream?.getTracks().forEach(t=>t.stop());
          if(!discarded && active() && !s.closed) uploadSheet(event,new Blob(chunks,{type:'audio/mp4'}),false);
        };
        recorder.onerror = () => {discarded=true; clearTimeout(timer); stream?.getTracks().forEach(t=>t.stop()); if(!s.closed) {button.disabled=false; s.panel.querySelector('.usafe-error').textContent=tr('Recording failed. Choose an existing M4A file or reopen to retry.');}};
        recorder.start(1000); timer=setTimeout(()=>{if(recorder.state==='recording') recorder.stop();},180000);
        button.textContent=tr('Stop recording'); button.disabled=false;
        s.panel.querySelector('[data-record-status]').textContent=tr('Recording… stops automatically after 3 minutes.');
        s.panel.querySelector('[data-file]').disabled=true;
      } catch(error) {stream?.getTracks().forEach(t=>t.stop()); if(!s.closed) {button.disabled=false; s.panel.querySelector('.usafe-error').textContent=errorText(error);}}
    };
  }
  function addRow(event) {
    const element = document.createElement('article'); element.className='usafe-row';
    element.innerHTML=`<div class="usafe-row-content"><h2></h2><div data-device class="usafe-muted"></div><div data-time class="usafe-muted"></div><div data-status class="usafe-status"></div><div data-assignee class="usafe-muted"></div><span data-demo class="usafe-demo">${"DEMO"}</span></div><div class="usafe-row-actions"><button type="button" data-inspect>${esc(tr('Inspection'))}</button><button type="button" data-photo hidden aria-label="${esc(tr('View photos'))}">${svgIcon('photos')}</button><button type="button" data-voice hidden aria-label="${esc(tr('Voice notes'))}">${svgIcon('voice')}</button><button type="button" data-menu aria-label="${esc(tr('USAFE options'))}">${svgIcon('more')}</button></div>`;
    const row={event,element,media:[],mediaError:null,offs:[]};
    element.querySelector('[data-inspect]').onclick=()=>safeOpen(()=>showInspection(row.event,'status'));
    element.querySelector('[data-menu]').onclick=()=>showMenu(row);
    element.querySelector('[data-photo]').onclick=()=>showMedia(row,'photos');
    element.querySelector('[data-voice]').onclick=()=>showMedia(row,'voice');
    row.offs.push(service.watchInspection(event,task=>{
      if(!active()) return;
      element.querySelector('[data-status]').textContent=`${tr('Inspection')}: ${tr(inspectionStatus(task))}`;
      element.querySelector('[data-status]').classList.toggle('usafe-complete',isClosed(task));
      element.querySelector('[data-assignee]').textContent=task?.assignedTo?`${tr('Assigned to')}: ${task.assignedTo}`:'';
    },error=>{if(active()) {element.querySelector('[data-status]').textContent=tr('Inspection status unavailable'); element.querySelector('[data-assignee]').textContent=''; console.error('[USAFE inspection]',error);}}));
    row.offs.push(service.watchMedia(event,media=>{
      if(!active()) return; row.media=media; row.mediaError=null;
      element.querySelector('[data-photo]').hidden=!media.some(m=>m.mediaType==='photos');
      element.querySelector('[data-voice]').hidden=!media.some(m=>m.mediaType==='voice');
    },error=>{row.mediaError=error; row.media=[]; element.querySelector('[data-photo]').hidden=true; element.querySelector('[data-voice]').hidden=true; console.error('[USAFE media]',error);}));
    return row;
  }
  function updateRow(row,event) {
    row.event=event;
    row.element.querySelector('h2').textContent=event.title || tr('USAFE event');
    row.element.querySelector('[data-device]').textContent=event.deviceName || event.deviceId || tr('Device unspecified');
    row.element.querySelector('[data-time]').textContent=stamp(event.occurredAt);
    row.element.querySelector('[data-demo]').hidden=!isDemo(event);
  }
  function listen() {
    offEvents?.(); message.textContent=tr('Loading…');
    offEvents=service.watchEvents(events=>{
      if(!active()) return;
      message.textContent=events.length?'':tr('No USAFE events recorded for this marina.');
      const ids=new Set(events.map(e=>e.documentId));
      for(const [id,row] of rows) if(!ids.has(id)) {row.offs.forEach(off=>off()); row.element.remove(); rows.delete(id);}
      events.sort((a,b)=>(b.occurredAt?.toMillis?.() ?? (Number(b.occurredAt) || 0))-(a.occurredAt?.toMillis?.() ?? (Number(a.occurredAt) || 0)));
      for(const event of events) {
        let row=rows.get(event.documentId); if(!row) {row=addRow(event); rows.set(event.documentId,row);}
        updateRow(row,event); list.append(row.element);
      }
    },error=>{
      if(!active()) return;
      for(const row of rows.values()) {row.offs.forEach(off=>off()); row.element.remove();} rows.clear();
      message.textContent=errorText(error)+' '; const retry=document.createElement('button'); retry.textContent=tr('Retry'); retry.onclick=listen; message.append(retry);
    });
  }
  dispose=()=>{stopped=true; offEvents?.(); for(const row of rows.values()) row.offs.forEach(off=>off()); rows.clear(); pendingUploads.clear(); currentSheet?.close(true);};
  listen();
}
