import { store } from '../store.js';
import { db } from '../firebase.js';
import { t } from '../i18n.js';
import { sheetCloseButton } from '../ui/sheetClose.js';
import { saveHandoverNote } from '../util/HandoverNotes.js';
import { handoverRows, handoverText, handoverSummary, latestHandover } from '../util/ShiftHandover.js';
import { collection, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export function showShiftHandover(anchor = null) {
  const uid = store.authUser?.uid, clientId = Number(store.activeClientId);
  const boatId = store.activeMarina?.clientType === 'yacht_operator' ? Number(store.assignedYacht?.id) : 0;
  if (!uid || !clientId || store.marinaSwitching || (store.activeMarina?.clientType === 'yacht_operator' && !boatId)) return () => {};
  const root = document.getElementById('modalRoot');
  if (!root || root.querySelector('[data-shift-handover]')) return () => {};
  const backdrop = document.createElement('div'), sheet = document.createElement('div');
  backdrop.className = 'sheet-backdrop'; sheet.className = 'sheet'; sheet.dataset.shiftHandover = '1';
  sheet.setAttribute('role','dialog'); sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-label',t('Shift handover'));
  sheet.innerHTML = `${sheetCloseButton()}<div class="sheet-title"></div><div class="add-scroll" style="padding:16px;overflow:auto;min-height:0">
    <p data-scope></p><div data-summary></div><p data-status role="status"></p>
    <div class="dash-filters" data-filters></div><div data-records></div>
    <label class="add-label"><span data-notes-label></span><textarea class="add-input" data-notes rows="4" maxlength="8000"></textarea></label>
    <p data-note-help></p><p data-saved role="status"></p><button type="button" class="md-close-btn" data-save disabled></button><p data-error role="alert" style="color:#ff9999"></p>
    <button type="button" class="md-close-btn" data-download disabled></button></div>
    <button type="button" class="md-close-btn" data-close></button>`;
  const find = selector => sheet.querySelector(selector);
  find('.sheet-title').textContent = t('Shift handover');
  const marina = store.activeMarina?.name || `Marina ${clientId}`;
  find('[data-scope]').textContent = marina + (boatId ? ` · ${store.assignedYacht?.name || boatId}` : '') + ' · ' + t('Outstanding tasks and maintenance');
  find('[data-notes-label]').textContent = t('Notes for the next shift');
  find('[data-note-help]').textContent = t('Save Notes stores a new marina handover in the shared record history. Download is optional. Deferred work is included in the list below but excluded from the active maintenance summary.');
  find('[data-save]').textContent = t('Save Notes');
  find('[data-download]').textContent = t('Download handover'); find('[data-close]').textContent = t('Close');
  let closed = false, stops = [], mode = 'ALL', rows = [], loading = new Set(['maintenance','tasks','berths','inspections','berth_bookings','shift_handovers']), errors = new Set();
  const data = { maintenance: [], tasks: [], berths: [], inspections: [], berth_bookings: [], shift_handovers: [] };
  let dirty=false, saving=false, retryRecord=null;
  const canSave=()=>['admin','manager','staff','inspector'].includes(store.activeRole) && !boatId;
  find('[data-notes]').addEventListener('input',()=>{dirty=true; if(!saving)retryRecord=null; render();});
  if(boatId) { find('[data-notes]').disabled=true; find('[data-save]').hidden=true; find('[data-note-help]').textContent=t('Marina-wide handover notes are available to marina staff accounts.'); }
  const current = () => !closed && sheet.isConnected && (!anchor || anchor.isConnected) && store.authUser?.uid === uid && Number(store.activeClientId) === clientId
    && !store.marinaSwitching && (store.activeMarina?.clientType === 'yacht_operator' ? Number(store.assignedYacht?.id) === boatId && boatId > 0 : boatId === 0);
  const close = () => { if (closed) return; closed = true; stops.forEach(stop=>stop()); observer.disconnect(); sheet.remove(); backdrop.remove(); };
  const observer = new MutationObserver(() => { if (!current()) close(); });
  root.append(backdrop,sheet); observer.observe(root,{childList:true});
  if (anchor?.parentElement) observer.observe(anchor.parentElement,{childList:true});
  requestAnimationFrame(()=>{if(!closed){backdrop.classList.add('is-open');sheet.classList.add('is-open');}});
  backdrop.onclick=close; find('[data-close]').onclick=close; find('[data-sheet-close]').onclick=close;
  const labels = { ALL:'All', OVERDUE:'Overdue', UNASSIGNED:'Unassigned', DEFERRED:'Deferred' };
  for (const [key,label] of Object.entries(labels)) {
    const button=document.createElement('button');button.type='button';button.className='dash-filter';button.dataset.mode=key;button.textContent=t(label);
    button.onclick=()=>{mode=key;render();};find('[data-filters]').append(button);
  }
  function render() {
    if (!current()) {close();return;}
    find('[data-save]').disabled=saving || !canSave() || loading.has('shift_handovers') || errors.has('shift_handovers') || !dirty;
    rows=handoverRows(data.maintenance,data.tasks,clientId,boatId);
    find('[data-download]').disabled=loading.size>0 || errors.size>0;
    find('[data-status]').textContent=loading.size ? t('Loading…') : errors.size ? t('Could not load all records. Reopen handover to retry; download is unavailable.')
      : `${rows.length} ${t('outstanding')} · ${rows.filter(r=>r.overdue).length} ${t('Overdue')} · ${rows.filter(r=>r.unassigned).length} ${t('Unassigned')}`;
    const summary=find('[data-summary]'); summary.replaceChildren();
    summary.hidden=!!boatId;
    const metrics=handoverSummary(data.maintenance,data.berth_bookings,data.berths,data.inspections,clientId);
    for(const [key,label,needs] of [['checkedIn','boat checked in',['berth_bookings']],['awaiting','boat awaiting check-in',['berth_bookings']],['issues','open Dock Walk issues',['maintenance']],['inspectionsDue','berth inspections due',['berths','inspections']],['maintenance','active maintenance tasks',['maintenance']]]) {
      const p=document.createElement('p');p.textContent=`${needs.some(n=>loading.has(n)||errors.has(n))?'—':metrics[key]} ${t(label)}`;summary.append(p);
    }
    for(const b of sheet.querySelectorAll('[data-mode]'))b.classList.toggle('is-active',b.dataset.mode===mode);
    const list=find('[data-records]');list.replaceChildren();
    const visible=rows.filter(r=>mode==='ALL'||mode==='OVERDUE'&&r.overdue||mode==='UNASSIGNED'&&r.unassigned||mode==='DEFERRED'&&r.deferred);
    if(!visible.length&&!loading.size&&!errors.size){const p=document.createElement('p');p.textContent=t('No outstanding items in this filter.');list.append(p);}
    for(const row of visible){
      const card=document.createElement('article');card.style.cssText='padding:12px 0;border-bottom:1px solid var(--color-water-blue,#2196F3);overflow-wrap:anywhere';
      const title=document.createElement('strong');title.textContent=`${t(row.kind)} · ${row.title}`;card.append(title);
      for(const text of [`${t('Assigned To')}: ${t(row.owner)}`,`${t('Status')}: ${t(row.status||'OPEN')} · ${t('Due')}: ${row.due||t('Not set')}${row.overdue?' · '+t('OVERDUE'):''}`,
        `${t('Boat')}: ${row.boatId||t('Unassigned')}`,row.notes||'']){const p=document.createElement('p');p.style.margin='6px 0';p.textContent=text;card.append(p);}
      const link=document.createElement('a');link.textContent=t('Open record list');link.href=`#/${row.kind==='Maintenance'?'maintenance':'tasks'}${Number(row.boatId)>0?'?boatId='+Number(row.boatId):''}`;
      link.style.color='var(--color-water-blue,#2196F3)';link.onclick=close;card.append(link);list.append(card);
    }
  }
  find('[data-download]').onclick=()=>{
    if(!current()){close();return;}if(loading.size||errors.size)return;
    try {
      const url=URL.createObjectURL(new Blob([handoverText(rows,marina,find('[data-notes]').value)],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download=`MarinaControl-handover-${clientId}-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{find('[data-error]').textContent=t('Could not download the briefing. Copy your notes before closing.');}
  };
  find('[data-save]').onclick=async()=>{
    if(!current()){close();return;}if(saving||!canSave()||loading.has('shift_handovers')||errors.has('shift_handovers'))return;
    saving=true;find('[data-notes]').disabled=true;find('[data-error]').textContent='';render();
    try {
      await saveHandoverNote(clientId,store.userProfile?.userId || uid,find('[data-notes]').value,()=>current()&&canSave(),retryRecord);
      if(current()){dirty=false;retryRecord=null;find('[data-saved]').textContent=t('Handover notes saved to the shared marina history.');}
    } catch(error){if(current()){retryRecord=error.handoverRecord||null;find('[data-error]').textContent=error.message||t('Could not save notes. Your draft is still here.');}}
    finally {saving=false;if(current()){find('[data-notes]').disabled=!!boatId;render();}}
  };
  for(const name of ['maintenance','tasks','berths','inspections','berth_bookings','shift_handovers']){
    if(boatId && !['maintenance','tasks'].includes(name)){loading.delete(name);continue;}
    const constraints=[where('clientId','==',clientId),...(boatId?[where('boatId','==',boatId)]:[])];
    try { stops.push(onSnapshot(query(collection(db,name),...constraints),snapshot=>{
      if(!current()){close();return;}data[name]=snapshot.docs.map(doc=>({...doc.data(),_docId:doc.id}));loading.delete(name);errors.delete(name);
      if(name==='shift_handovers' && !dirty && !saving){const latest=latestHandover(data[name],clientId);find('[data-notes]').value=latest?.notes||'';find('[data-saved]').textContent=latest?`${t('Latest saved handover')}: ${new Date(Number(latest.createdAt)).toLocaleString()}`:t('No saved handover notes.');}
      render();
    },()=>{if(!current()){close();return;}data[name]=[];loading.delete(name);errors.add(name);render();})); }
    catch { loading.delete(name); errors.add(name); }
  }
  render();
  return close;
}
