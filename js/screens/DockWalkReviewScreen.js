import {revealFieldErrors,ensureWorkInputStyles} from '../util/WorkFormFeedback.js';
import {store} from '../store.js';
import {t} from '../i18n.js';
import {dockWalkReview} from '../util/DockWalkReviewApi.js';
import {workEscape as esc} from '../util/StaffWorkApi.js';
import {openStaffWorkAssign} from './StaffWorkScreen.js';
import {sheetCloseButton} from '../ui/sheetClose.js';
import {getStorage,ref,getDownloadURL} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import {app} from '../firebase.js';
let cleanup=()=>{};
const L=v=>esc(t(v));
const state=s=>({PENDING:'Needs review',DEFERRED:'Deferred',MAINTENANCE_LINKED:'Maintenance linked'}[s]||s);
export function unmountDockWalkReviewScreen(){cleanup();cleanup=()=>{};}
export function mountDockWalkReviewScreen(){
 unmountDockWalkReviewScreen();ensureWorkInputStyles();const root=document.getElementById('screen'),clientId=store.activeClientId,uid=store.authUser?.uid;
 let alive=true,rows=[],cursor=null,mode='PENDING',loading=false;const sheets=new Set();
 const current=()=>alive&&store.activeClientId===clientId&&store.authUser?.uid===uid;
 if(!['admin','manager'].includes(store.activeRole)){root.textContent=t('Manager or administrator access required.');return;}
 root.innerHTML=`<section class="dw-review" style="padding:16px"><div class="berth-header"><div class="berth-pill">${L('Dock Walk review')}</div><button class="dash-filter" data-refresh>${L('Refresh')}</button></div><p>${L('Review inspection issues, create maintenance or defer with a reason and review date.')}</p><div style="display:flex;flex-wrap:wrap;gap:8px">${['PENDING','DEFERRED','MAINTENANCE_LINKED','ALL'].map(key=>`<button class="dash-filter" data-mode="${key}">${L(key==='ALL'?'All':state(key))}</button>`).join('')}</div><p role="status" data-status></p><div data-list></div><button class="dash-filter" data-more hidden>${L('Load more')}</button></section>`;
 const status=message=>{if(current())root.querySelector('[data-status]').textContent=message||'';};
 function render(){if(!current())return;const today=new Date().toISOString().slice(0,10);const visible=rows.filter(r=>mode==='ALL'||r.state===mode||mode==='PENDING'&&r.state==='DEFERRED'&&r.reviewDate<=today);
 root.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('is-active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
 root.querySelector('[data-list]').innerHTML=visible.map(r=>`<button class="nt-card" data-inspection="${esc(r.docId)}" style="display:block;width:100%;text-align:start;padding:16px;margin-top:12px;border:1px solid #737D89;border-radius:14px;background:var(--color-surface,#1C222A);color:inherit"><strong>${L('Berth')} ${esc(r.berthNumber)}</strong><p>${esc(r.faults.join(', '))}</p><span>${L(state(r.state))}${r.reviewDate?' · '+esc(r.reviewDate):''}</span></button>`).join('')||`<p>${L('No issues in this view.')}</p>`;
 root.querySelectorAll('[data-inspection]').forEach(b=>b.onclick=()=>detail(b.dataset.inspection));root.querySelector('[data-more]').hidden=!cursor;}
 async function load(more=false){if(!current()||loading)return;loading=true;status(t('Loading…'));try{const result=await dockWalkReview('LIST',more&&cursor?{cursor}:{});if(!current())return;rows=more?[...rows,...result.items]:result.items;cursor=result.nextCursor;render();status('');}catch(e){status(e.message);}finally{loading=false;}}
 async function detail(inspectionId){status(t('Loading…'));try{const result=await dockWalkReview('DETAIL',{inspectionId});if(!current())return;status('');const r=result.item;
 const backdrop=document.createElement('div');backdrop.className='sheet-backdrop is-open';const sheet=document.createElement('div');sheet.className='sheet work-input-sheet is-open';sheet.style.display='block';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
 sheet.innerHTML=`${sheetCloseButton()}<h3 style="padding:16px 44px">${L('Berth')} ${esc(r.berthNumber)}</h3><div style="padding:16px;overflow:auto;max-height:75vh"><p>${L(state(r.state))}</p><p>${esc(r.inspectorName)}${Number(r.inspectionDate)>0?' · '+esc(new Date(Number(r.inspectionDate)).toLocaleString()):''}</p><p>${esc(r.faults.join(', '))}</p><p style="white-space:pre-wrap">${esc([r.damageDescription,r.notes].filter(Boolean).join('\n'))}</p>${r.reason?`<p>${L('Review note')}: ${esc(r.reason)}</p>`:''}${r.photoStoragePath?`<button class="dash-filter" data-photo>${L('Inspection photo')}</button><div data-image></div>`:''}
 ${result.maintenance?`<p>${esc(result.maintenance.title)} · ${esc(result.maintenance.status)}</p><button class="dash-filter" data-assign>${L('Assign work')}</button>`:`<label>${L('Review note — required to defer')}<textarea class="add-input" data-reason maxlength="4000"></textarea></label><label>${L('Review date — required to defer')}<input class="add-input" data-date type="date" min="${new Date().toISOString().slice(0,10)}"></label><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="dash-filter" data-create>${L('Create maintenance')}</button><button class="dash-filter" data-defer>${L('Defer')}</button></div>`}<p data-result role="status"></p></div>`;
 let busy=false;const close=()=>{sheet.remove();backdrop.remove();sheets.delete(close);};sheets.add(close);document.getElementById('modalRoot').append(backdrop,sheet);backdrop.onclick=()=>{if(!busy)close();};sheet.querySelector('[data-sheet-close]').onclick=()=>{if(!busy)close();};
 const assign=task=>{close();openStaffWorkAssign({kind:'maintenance',sourceDocId:task.docId,title:task.title},()=>load());};
 if(result.maintenance)sheet.querySelector('[data-assign]').onclick=()=>assign(result.maintenance);
 const review=async decision=>{if(busy||!current())return;const errors=[];if(decision==='DEFER'){
 const reason=sheet.querySelector('[data-reason]'),date=sheet.querySelector('[data-date]');if(!reason.value.trim())errors.push([reason,'Explain why this issue is being deferred.']);
 if(!date.value||date.value<new Date().toISOString().slice(0,10)||!Number.isFinite(Date.parse(date.value))||new Date(date.value).toISOString().slice(0,10)!==date.value)errors.push([date,'Choose a valid review date today or later.']);
 }if(revealFieldErrors(sheet,errors))return;busy=true;sheet.querySelectorAll('button,input,textarea').forEach(c=>c.disabled=true);const output=sheet.querySelector('[data-result]');output.textContent=t('Saving…');try{const saved=await dockWalkReview('REVIEW',{inspectionId,fingerprint:r.fingerprint,reviewedAt:r.reviewedAt,decision,reason:sheet.querySelector('[data-reason]').value,reviewDate:sheet.querySelector('[data-date]').value});if(!current())return;close();load();if(saved.maintenanceDocId)openStaffWorkAssign({kind:'maintenance',sourceDocId:saved.maintenanceDocId,title:'Dock Walk: '+r.berthNumber});}catch(e){if(sheet.isConnected)output.textContent=e.message;}finally{busy=false;sheet.querySelectorAll('button,input,textarea').forEach(c=>c.disabled=false);}};
 if(!result.maintenance){sheet.querySelector('[data-create]').onclick=()=>review('MAINTENANCE');sheet.querySelector('[data-defer]').onclick=()=>review('DEFER');}
 if(r.photoStoragePath)sheet.querySelector('[data-photo]').onclick=async()=>{try{const url=await getDownloadURL(ref(getStorage(app),r.photoStoragePath));if(!current()||!sheet.isConnected)return;const image=new Image();image.alt=t('Inspection photo');image.style.maxWidth='100%';image.src=url;sheet.querySelector('[data-image]').replaceChildren(image);}catch(e){sheet.querySelector('[data-result]').textContent=e.message;}};
 }catch(e){status(e.message);}}
 root.querySelector('[data-refresh]').onclick=()=>load();root.querySelector('[data-more]').onclick=()=>load(true);root.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render();});
 cleanup=()=>{alive=false;sheets.forEach(close=>close());};load();const inspectionId=new URLSearchParams(location.hash.split('?')[1]||'').get('inspectionId');if(inspectionId)detail(inspectionId);
}
