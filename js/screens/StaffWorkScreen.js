import {showStaffWorkHelp} from './StaffWorkHelp.js';
import {store} from '../store.js';
import {t} from '../i18n.js';
import {staffWork,canManageWork,workEscape as esc,stageLabel,jpegEvidence} from '../util/StaffWorkApi.js';
import {sheetCloseButton} from '../ui/sheetClose.js';
let cleanup=()=>{};
const L=value=>esc(t(value));
const style='box-sizing:border-box;width:100%;padding:12px;margin:8px 0;border:1px solid #737D89;border-radius:10px;background:#151A20;color:#F5F7F9;font:inherit';
const button=(action,label)=>`<button type="button" class="dash-filter" data-work-action="${action}" style="min-height:44px;margin:4px">${L(label)}</button>`;
function ensureStyles(){
  if(document.getElementById('staffWorkUiStyles'))return;
  const css=document.createElement('style');css.id='staffWorkUiStyles';css.textContent=`
    .staff-work-filters{display:flex;flex-wrap:wrap;gap:4px;}
    .staff-work-filters .dash-filter.is-active{background:var(--color-accent,#2196F3);border-color:var(--color-accent,#2196F3);color:#fff;font-weight:700;}
    .sheet.staff-work-sheet{display:flex;flex-direction:column;overflow:hidden;max-height:88vh;max-height:88dvh;padding:0;box-sizing:border-box;}
    .staff-work-sheet .dash-filter:focus,.staff-work-sheet .dash-filter:active{border-color:var(--color-accent,#2196F3);outline:1px solid var(--color-accent,#2196F3);outline-offset:0;}
    .staff-work-sheet-header{position:relative;flex:0 0 auto;padding:20px 16px 12px;}
    .staff-work-sheet-header .sheet-title{text-align:center;padding:0 44px;margin:0;}
    .staff-work-sheet-header .sheet-close-button{position:absolute;top:4px;right:8px;}
    .staff-work-sheet .staff-work-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px;box-sizing:border-box;}
  `;document.head.append(css);
}
function dialog(title,html) {
  ensureStyles();
  const backdrop=document.createElement('div');backdrop.className='sheet-backdrop is-open';
  const sheet=document.createElement('div');sheet.className='sheet staff-work-sheet is-open';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
  sheet.innerHTML=`<div class="staff-work-sheet-header">${sheetCloseButton()}<div class="sheet-title">${esc(title)}</div></div><div class="staff-work-body" data-work-body>${html}<p data-work-status role="status" aria-live="polite"></p></div>`;
  document.getElementById('modalRoot').append(backdrop,sheet);
  const close=()=>{backdrop.remove();sheet.remove();};backdrop.onclick=()=>{if(!sheet.dataset.busy)close();};sheet.querySelector('[data-sheet-close]').onclick=()=>{if(!sheet.dataset.busy)close();};
  return {sheet,close};
}
function status(sheet,message) {const el=sheet.querySelector('[data-work-status]');if(el)el.textContent=String(message||'');}
async function busy(sheet,fn) {
  const focused=document.activeElement;
  sheet.dataset.busy='1';const controls=[...sheet.querySelectorAll('button,input,select,textarea')];controls.forEach(c=>c.disabled=true);status(sheet,t('Saving…'));
  try{await fn();if(sheet.isConnected)status(sheet,t('Saved.'));}catch(error){if(sheet.isConnected)status(sheet,error.message||t('Could not save. Try again.'));}
  finally{delete sheet.dataset.busy;controls.forEach(c=>c.disabled=false);if(sheet.isConnected&&focused&&sheet.contains(focused)&&!focused.disabled)focused.focus({preventScroll:true});}
}
export function unmountStaffWorkScreen(){cleanup();cleanup=()=>{};}
export function mountStaffWorkScreen(){
  unmountStaffWorkScreen();ensureStyles();
  const screen=document.getElementById('screen'),clientId=Number(store.activeClientId),uid=store.authUser?.uid;
  let alive=true,loading=false,rows=[],cursor=null,mode='OPEN',closeHelp=null,crewLink=null,assignmentChanged=false;
  const current=()=>alive&&uid===store.authUser?.uid&&clientId===Number(store.activeClientId)&&!store.marinaSwitching;
  const manage=canManageWork();
  screen.innerHTML=`<div style="padding:16px"><div class="cm-header"><div class="cm-header-row"><div class="cm-pill">${L(manage?'Staff Work':'My Tasks')}</div><button type="button" class="cm-icon-btn" data-work-help aria-label="${L('Help')}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.8" fill="currentColor"/></svg></button><div class="cm-header-spacer"></div>${button('refresh','Refresh')}</div></div>
    <p>${L(manage?'Assign work, review evidence and approve completion.':'Your assigned work. Submit completed work for manager review.')}</p>
    ${manage?`<div>${button('assign','Assign work')}${button('links','Crew account links')}</div>`:''}
    <div class="staff-work-filters" role="group" aria-label="${L('Work status')}">${button('OPEN','Open')}${button('REVIEW','Awaiting review')}${button('DONE','Completed')}${button('ALL','All')}</div>
    <p data-load-status role="status"></p><div data-work-list></div><div data-load-more></div></div>`;
  const emptyGuidance=()=>{
    if(rows.length)return 'No work matches this filter. Try All.';
    if(crewLink?.state==='NEEDS_REASSIGNMENT')return 'Your crew account is linked, but existing work still targets a previous sign-in. Ask your manager to open the task and assign it again to your linked crew record.';
    if(crewLink?.state==='UNLINKED'||crewLink?.state==='INVALID_LINK')return 'Your sign-in is not linked to an active crew record. Ask your manager to save your link in Crew account links.';
    if(assignmentChanged)return 'An assignment changed and is no longer available to this sign-in. Ask your manager to review and reassign it.';
    if(crewLink?.state==='LINKED')return 'Your crew account is linked. No work has been assigned to this sign-in yet. Ask your manager to assign a task.';
    return 'Your manager links your crew record to your sign-in account and assigns work here.';
  };
  function updateFilters(){screen.querySelectorAll('.staff-work-filters [data-work-action]').forEach(control=>{const active=control.dataset.workAction===mode;control.classList.toggle('is-active',active);control.setAttribute('aria-pressed',String(active));});}
  updateFilters();
  const render=()=>{
    updateFilters();
    const visible=rows.filter(r=>mode==='ALL'||mode==='REVIEW'&&r.stage==='AWAITING_REVIEW'||mode==='DONE'&&r.stage==='COMPLETED'||mode==='OPEN'&&!['COMPLETED','ARCHIVED','WITHDRAWN','UNASSIGNED'].includes(r.stage));
    const list=screen.querySelector('[data-work-list]');if(!list)return;
    list.innerHTML=visible.length?visible.map(row=>`<button type="button" data-work-id="${esc(row.docId)}" style="${style};text-align:start"><strong>${esc(row.title)}</strong><div>${esc(stageLabel(row.stage))}${row.priority?' · '+esc(row.priority):''}</div>${row.location?`<div>${esc(row.location)}</div>`:''}${row.dueDate?`<div>${L('Due')}: ${esc(row.dueDate)}</div>`:''}${manage?`<div>${esc(row.assigneeName||t('Unassigned'))}${['LINK_CHANGED','ACCESS_CHANGED'].includes(row.delivery)?' · '+L('Reassignment required'):row.linked?'':' · '+L('No linked sign-in account')}</div>`:''}</button>`).join(''):`<p>${L('No work in this view.')}</p>${!manage?`<p>${crewLink?.crewName?'<strong>'+esc(crewLink.crewName)+'</strong><br>':''}${L(emptyGuidance())}</p>`:''}`;
    list.querySelectorAll('[data-work-id]').forEach(b=>b.onclick=()=>openStaffWorkDetail(b.dataset.workId,()=>load(false)));
    screen.querySelector('[data-load-more]').innerHTML=cursor?button('more','Load more'):'';
    screen.querySelector('[data-work-action="more"]')?.addEventListener('click',()=>load(true));
  };
  async function load(more=false){
    if(loading||!current())return;loading=true;screen.querySelector('[data-load-status]').textContent=t('Loading…');
    try{const result=await staffWork('LIST',more&&cursor?{cursor}:{});if(!current())return;rows=more?[...rows,...result.items]:result.items;cursor=result.nextCursor;crewLink=result.crewLink||null;assignmentChanged=!!result.assignmentChanged;render();screen.querySelector('[data-load-status]').textContent='';}
    catch(error){if(current())screen.querySelector('[data-load-status]').textContent=error.message;}
    finally{loading=false;}
  }
  screen.querySelector('[data-work-help]').onclick=()=>{closeHelp?.(true);closeHelp=showStaffWorkHelp(manage);};
  screen.querySelectorAll('[data-work-action]').forEach(b=>b.onclick=()=>{
    const action=b.dataset.workAction;
    if(action==='refresh')load(false);else if(action==='assign')openStaffWorkAssign({},()=>load(false));else if(action==='links')openStaffWorkLinks();else{mode=action;render();}
  });
  load(false).then(()=>{const id=new URLSearchParams(location.hash.split('?')[1]||'').get('workId');if(id&&current())openStaffWorkDetail(id,()=>load(false));});
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('#modalRoot .sheet'))load(false);},30000);
  cleanup=()=>{alive=false;clearInterval(timer);closeHelp?.(true);};
}
export async function openStaffWorkDetail(workId,onChanged=()=>{}) {
  const {sheet,close}=dialog(t('Work details'),`<p>${L('Loading…')}</p>`);
  async function render(){
    const result=await staffWork('DETAIL',{workId});if(!sheet.isConnected)return;
    const item=result.item,manage=result.canManage;
    sheet.querySelector('[data-work-body]').innerHTML=`<h3>${esc(item.title)}</h3><p><strong>${esc(stageLabel(item.stage))}</strong></p>
      ${item.location?`<p>${esc(item.location)}</p>`:''}${item.dueDate?`<p>${L('Due')}: ${esc(item.dueDate)}</p>`:''}<p style="white-space:pre-wrap">${esc(item.instructions)}</p>
      ${item.managerNote?`<p><strong>${L('Manager feedback')}:</strong> ${esc(item.managerNote)}</p>`:''}
      ${manage&&!['COMPLETED','ARCHIVED','DEFERRED'].includes(item.stage)?`<p>${['LINK_CHANGED','ACCESS_CHANGED'].includes(item.delivery)?L('The crew account link or access changed. Check Crew account links, then reassign this task to the current Staff login.'):''}</p><button type="button" class="dash-filter" data-work-reassign>${L('Assign / reassign work')}</button>`:''}
      <label>${L('Update / completion note')}<textarea data-work-note maxlength="4000" rows="4" style="${style}"></textarea></label>
      <div>${!manage&&['ASSIGNED','BLOCKED'].includes(item.stage)?button('START','Start / resume work'):''}
      ${!manage&&['ASSIGNED','IN_PROGRESS'].includes(item.stage)?button('BLOCK','Report a blocker'):''}
      ${!manage&&item.stage==='IN_PROGRESS'?button('SUBMIT','Submit for review'):''}
      ${!['COMPLETED','WITHDRAWN','ARCHIVED','DEFERRED','RECORDED_ONLY','UNASSIGNED'].includes(item.stage)?button('NOTE','Add note'):''}
      ${manage&&item.stage==='AWAITING_REVIEW'?button('APPROVE','Approve completion')+button('RETURN','Return for follow-up'):''}</div>
      ${!manage&&!['COMPLETED','WITHDRAWN','ARCHIVED','DEFERRED','RECORDED_ONLY','UNASSIGNED'].includes(item.stage)?`<label>${L('Add photo')}<input data-work-photo type="file" accept="image/*" style="${style}"></label>`:''}
      <p data-work-status role="status" aria-live="polite"></p><h4>${L('Updates and evidence')}</h4><div>${result.events.map(event=>`<div style="padding:12px 0;border-top:1px solid #737D89"><strong>${esc(stageLabel(event.action))}</strong><p style="white-space:pre-wrap">${esc(event.note)}</p><small>${esc(new Date(event.createdAt).toLocaleString())}</small>${event.photo?`<div><button type="button" class="dash-filter" data-event-photo="${esc(event.docId)}">${L('View photo')}</button></div>`:''}</div>`).join('')||L('No updates yet.')}</div>`;
    sheet.querySelector('[data-work-reassign]')?.addEventListener('click',()=>{close();openStaffWorkAssign({kind:item.kind,sourceDocId:item.sourceDocId,crewDocumentId:item.crewDocumentId,title:item.title},onChanged);});
    sheet.querySelectorAll('[data-work-action]').forEach(b=>b.onclick=()=>busy(sheet,async()=>{
      const note=sheet.querySelector('[data-work-note]').value;
      await staffWork('UPDATE',{workId,revision:item.revision,command:b.dataset.workAction,note});await render();onChanged();
    }));
    sheet.querySelector('[data-work-photo]')?.addEventListener('change',event=>busy(sheet,async()=>{
      const file=event.target.files[0];if(!file)return;
      const base64=await jpegEvidence(file);await staffWork('UPLOAD_PHOTO',{workId,revision:item.revision,base64,note:sheet.querySelector('[data-work-note]').value});await render();onChanged();
    }));
    sheet.querySelectorAll('[data-event-photo]').forEach(b=>b.onclick=()=>busy(sheet,async()=>{
      const image=await staffWork('GET_PHOTO',{workId,eventId:b.dataset.eventPhoto});if(!sheet.isConnected)return;
      const img=document.createElement('img');img.alt=t('Work evidence');img.style.maxWidth='100%';img.src='data:image/jpeg;base64,'+image.base64;b.after(img);b.remove();
    }));
  }
  try{await render();}catch(error){status(sheet,error.message);}
  return close;
}
export async function openStaffWorkLinks(crewDocumentId='') {
  if(!canManageWork())return;
  const {sheet}=dialog(t('Crew account links'),`<p>${L('Loading…')}</p>`);
  try{
    const setup=await staffWork('SETUP');if(!sheet.isConnected)return;
    sheet.querySelector('[data-work-body]').innerHTML=`<p>${L('Choose the crew record and its Staff sign-in account explicitly. Names or email addresses are never matched automatically.')}</p>
      <label>${L('Crew')}<select data-link-crew style="${style}"><option value="">${L('Choose crew')}</option>${setup.crew.map(c=>`<option value="${esc(c.docId)}"${c.docId===crewDocumentId?' selected':''}>${esc(c.name)}${c.linkedUid?' · '+L('Linked'):''}</option>`).join('')}</select></label>
      <label>${L('Staff sign-in account')}<select data-link-user style="${style}"><option value="">${L('Unlink / no account')}</option>${setup.users.map(u=>`<option value="${esc(u.uid)}">${esc(u.name)} · ${esc(u.email)}</option>`).join('')}</select></label>
      <p>${L('Linking does not transfer old work. Assign or reassign work after linking to send a task alert.')}</p>${button('link','Save link')}<p data-work-status role="status"></p>`;
    const crewSelect=sheet.querySelector('[data-link-crew]'),userSelect=sheet.querySelector('[data-link-user]');
    const sync=()=>{userSelect.value=setup.crew.find(c=>c.docId===crewSelect.value)?.linkedUid||'';};crewSelect.onchange=sync;sync();
    sheet.querySelector('[data-work-action]').onclick=()=>busy(sheet,async()=>{
      if(!crewSelect.value)throw Error(t('Choose a crew record.'));
      await staffWork('LINK_CREW',{crewDocumentId:crewSelect.value,targetUid:userSelect.value});
      setup.crew.find(c=>c.docId===crewSelect.value).linkedUid=userSelect.value;
    });
  }catch(error){status(sheet,error.message);}
}
export async function openStaffWorkAssign(source={},onChanged=()=>{}) {
  if(!canManageWork())return;
  const {sheet,close}=dialog(t('Assign work'),`<p>${L('Loading…')}</p>`);
  try{
    const setup=await staffWork('SETUP');if(!sheet.isConnected)return;
    let sources=setup.sources;
    if(source.sourceDocId&&!sources.some(s=>s.kind===source.kind&&s.docId===source.sourceDocId))sources=[{kind:source.kind,docId:source.sourceDocId,title:source.title||t('Selected task')},...sources];
    const chosen=source.sourceDocId?sources.findIndex(s=>s.kind===source.kind&&s.docId===source.sourceDocId):-1;
    sheet.querySelector('[data-work-body]').innerHTML=`<label>${L('Task')}<select data-assign-source style="${style}"><option value="">${L('Choose task')}</option>${sources.map((s,i)=>`<option value="${i}"${i===chosen?' selected':''}>${esc(s.title)} · ${esc(s.kind)}</option>`).join('')}</select></label>
      <label>${L('Crew')}<select data-assign-crew style="${style}"><option value="">${L('Unassign')}</option>${setup.crew.map(c=>`<option value="${esc(c.docId)}"${c.docId===source.crewDocumentId?' selected':''}>${esc(c.name)} · ${c.linkedUid?L('Linked sign-in'):L('No sign-in alerts')}</option>`).join('')}</select></label>
      <p>${L('Without a linked Staff account, the assignment records responsibility but sends no in-app alert.')}</p>${setup.limited?`<p>${L('This picker shows a limited source list. Open Assign Owner from a specific maintenance task to select it directly.')}</p>`:''}${button('assign','Save assignment')}<p data-work-status role="status"></p>`;
    sheet.querySelector('[data-work-action]').onclick=()=>busy(sheet,async()=>{
      const selected=sheet.querySelector('[data-assign-source]').value;if(selected==='')throw Error(t('Choose a task.'));
      const row=sources[Number(selected)];
      await staffWork('ASSIGN',{kind:row.kind,sourceDocId:row.docId,crewDocumentId:sheet.querySelector('[data-assign-crew]').value||null});onChanged();close();
    });
  }catch(error){status(sheet,error.message);}
}
