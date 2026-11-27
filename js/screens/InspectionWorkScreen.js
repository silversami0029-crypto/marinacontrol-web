import {clearFieldError as clearError,revealFieldErrors as revealErrors} from '../util/WorkFormFeedback.js';
import {showInspectionHelp} from './InspectionHelp.js';
import {store} from '../store.js';
import {t} from '../i18n.js';
import {inspectionWork,canManageWork,workEscape as esc,stageLabel,jpegEvidence} from '../util/InspectionWorkApi.js';
import {sheetCloseButton} from '../ui/sheetClose.js';
let cleanup=()=>{};
const dialogs=new Set();
const L=value=>esc(t(value));
const style='box-sizing:border-box;width:100%;padding:12px;margin:8px 0;border:1px solid #737D89;border-radius:10px;background:#151A20;color:#F5F7F9;font:inherit';
const button=(action,label)=>`<button type="button" class="dash-filter" data-work-action="${action}" style="min-height:44px;margin:4px">${L(label)}</button>`;
function ensureStyles(){
  if(document.getElementById('inspectionWorkUiStyles'))return;
  const css=document.createElement('style');css.id='inspectionWorkUiStyles';css.textContent=`
    .inspection-sheet .iw-title{font-size:22px;line-height:1.3;margin:0 0 8px;font-weight:700;}
    .inspection-sheet .iw-meta{color:#B9C4CF;font-size:14px;margin:6px 0;}
    .inspection-sheet .iw-stage{display:inline-block;padding:5px 10px;border-radius:16px;background:#173650;color:#8BCFFF;font-size:13px;font-weight:700;}
    .inspection-sheet .iw-section{margin:20px 0;padding:16px;border:1px solid #39434D;border-radius:12px;}
    .inspection-sheet .iw-section h4{font-size:18px;margin:0 0 8px;font-weight:700;}
    .inspection-sheet .iw-hint{font-size:14px;line-height:1.5;color:#B9C4CF;margin:6px 0 12px;}
    .inspection-sheet .iw-check{padding:16px 0;border-top:1px solid #39434D;}
    .inspection-sheet .iw-check:first-child{border-top:0;}
    .inspection-sheet .iw-check-title{display:block;font-weight:700;line-height:1.4;}
    .inspection-sheet .iw-field{display:block;font-size:15px;font-weight:600;margin-top:14px;}
    .inspection-sheet .iw-required{font-size:12px;color:#FFD08A;font-weight:600;}
    .inspection-sheet .iw-progress{background:#172C3C;border-left:3px solid #2196F3;padding:12px;border-radius:8px;margin:14px 0;}
    .inspection-sheet .iw-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;}
    .inspection-sheet [data-work-action="SUBMIT"],.inspection-sheet [data-work-action="APPROVE"]{background:#2196F3;color:#081824;border-color:#2196F3;font-weight:700;}
    .inspection-sheet [data-work-status]{font-size:14px;line-height:1.5;margin:12px 0;}
    .inspection-sheet [data-work-status][data-kind="error"]{color:#FFB4B4;padding:10px;border:1px solid #D96262;border-radius:8px;background:#352125;}
    .inspection-sheet .iw-error{display:block;color:#FFB4B4;font-size:14px;font-weight:400;margin:4px 0 8px;}
    .inspection-sheet .iw-invalid{border:2px solid #FF7676!important;outline:1px solid #FF7676;outline-offset:1px;animation:iw-attention .6s ease-in-out 2;}
    @keyframes iw-attention{50%{box-shadow:0 0 0 4px #FF767640;}}
    @media(prefers-reduced-motion:reduce){.inspection-sheet .iw-invalid{animation:none;}}
    .inspection-sheet .iw-history{padding:12px 0;border-top:1px solid #39434D;}
    .inspection-sheet .iw-history small{color:#AEBBC8;font-size:12px;}
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
  const sheet=document.createElement('div');sheet.className='sheet staff-work-sheet inspection-sheet is-open';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
  sheet.innerHTML=`<div class="staff-work-sheet-header">${sheetCloseButton()}<div class="sheet-title">${esc(title)}</div></div><div class="staff-work-body" data-work-body>${html}<p data-work-status role="status" aria-live="polite"></p></div>`;
  document.getElementById('modalRoot').append(backdrop,sheet);
  const close=()=>{backdrop.remove();sheet.remove();dialogs.delete(close);};dialogs.add(close);backdrop.onclick=()=>{if(!sheet.dataset.busy)close();};sheet.querySelector('[data-sheet-close]').onclick=()=>{if(!sheet.dataset.busy)close();};
  return {sheet,close};
}
function status(sheet,message,kind='') {const el=sheet.querySelector('[data-work-status]');if(el){el.textContent=String(message||'');el.dataset.kind=kind;}}
async function busy(sheet,fn) {
  const focused=document.activeElement;
  sheet.dataset.busy='1';const controls=[...sheet.querySelectorAll('button,input,select,textarea')];controls.forEach(c=>c.disabled=true);status(sheet,t('Saving…'));
  try{await fn();if(sheet.isConnected&&['',t('Saving…')].includes(sheet.querySelector('[data-work-status]')?.textContent||''))status(sheet,t('Saved.'));}catch(error){if(sheet.isConnected)status(sheet,error.message||t('Could not save. Try again.'),'error');}
  finally{delete sheet.dataset.busy;controls.forEach(c=>c.disabled=false);if(sheet.isConnected&&focused&&sheet.contains(focused)&&!focused.disabled)focused.focus({preventScroll:true});}
}
export function unmountInspectionWorkScreen(){cleanup();cleanup=()=>{};for(const close of [...dialogs])close();}
export function mountInspectionWorkScreen(){
  unmountInspectionWorkScreen();ensureStyles();
  const screen=document.getElementById('screen'),clientId=Number(store.activeClientId),uid=store.authUser?.uid;
  let alive=true,loading=false,rows=[],cursor=null,mode='OPEN',closeHelp=null;
  const current=()=>alive&&uid===store.authUser?.uid&&clientId===Number(store.activeClientId)&&!store.marinaSwitching;
  const manage=canManageWork();
  screen.innerHTML=`<div style="padding:16px"><div class="cm-header"><div class="cm-header-row"><div class="cm-pill">${L(manage?'Inspection Review':'My Inspections')}</div><button type="button" class="cm-icon-btn" data-work-help aria-label="${L('Help')}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="7.5" r="0.8" fill="currentColor"/></svg></button><div class="cm-header-spacer"></div>${button('refresh','Refresh')}</div></div>
    <p>${L(manage?'Assign safety inspections, review findings and approve completion.':'Your assigned safety inspections. Record findings and submit for manager review.')}</p>
    ${manage?`<div>${button('assign','Assign inspection')}</div>`:''}
    <div class="staff-work-filters" role="group" aria-label="${L('Work status')}">${button('OPEN','Open')}${button('REVIEW','Awaiting review')}${button('DONE','Completed')}${button('ALL','All')}</div>
    <p data-load-status role="status"></p><div data-work-list></div><div data-load-more></div></div>`;
  const emptyGuidance=()=>rows.length?'No inspections match this filter. Try All.':'Your manager assigns Safety checklists or equipment checks directly to your Inspector sign-in account.';
  function updateFilters(){screen.querySelectorAll('.staff-work-filters [data-work-action]').forEach(control=>{const active=control.dataset.workAction===mode;control.classList.toggle('is-active',active);control.setAttribute('aria-pressed',String(active));});}
  updateFilters();
  const render=()=>{
    updateFilters();
    const visible=rows.filter(r=>mode==='ALL'||mode==='REVIEW'&&r.stage==='AWAITING_REVIEW'||mode==='DONE'&&r.stage==='COMPLETED'||mode==='OPEN'&&['ASSIGNED','IN_PROGRESS','BLOCKED'].includes(r.stage));
    const list=screen.querySelector('[data-work-list]');if(!list)return;
    list.innerHTML=visible.length?visible.map(row=>`<button type="button" data-work-id="${esc(row.docId)}" style="${style};text-align:start"><strong>${esc(row.title)}</strong><div>${esc(stageLabel(row.stage))}${row.priority?' · '+esc(row.priority):''}</div>${row.location?`<div>${esc(row.location)}</div>`:''}${row.dueDate?`<div>${L('Due')}: ${esc(row.dueDate)}</div>`:''}${manage?`<div>${esc(row.assigneeName||t('Unassigned'))}</div>`:''}</button>`).join(''):`<p>${L('No work in this view.')}</p>${!manage?`<p>${L(emptyGuidance())}</p>`:''}`;
    list.querySelectorAll('[data-work-id]').forEach(b=>b.onclick=()=>openInspectionWorkDetail(b.dataset.workId,()=>load(false)));
    screen.querySelector('[data-load-more]').innerHTML=cursor?button('more','Load more'):'';
    screen.querySelector('[data-work-action="more"]')?.addEventListener('click',()=>load(true));
  };
  async function load(more=false){
    if(loading||!current())return;loading=true;screen.querySelector('[data-load-status]').textContent=t('Loading…');
    try{const result=await inspectionWork('LIST',more&&cursor?{cursor}:{});if(!current())return;rows=more?[...rows,...result.items]:result.items;cursor=result.nextCursor;render();screen.querySelector('[data-load-status]').textContent='';}
    catch(error){if(current())screen.querySelector('[data-load-status]').textContent=error.message;}
    finally{loading=false;}
  }
  screen.querySelector('[data-work-help]').onclick=()=>{closeHelp?.(true);closeHelp=showInspectionHelp(manage);};
  screen.querySelectorAll('[data-work-action]').forEach(b=>b.onclick=()=>{
    const action=b.dataset.workAction;
    if(action==='refresh')load(false);else if(action==='assign')openInspectionWorkAssign({},()=>load(false));else{mode=action;render();}
  });
  load(false).then(()=>{const id=new URLSearchParams(location.hash.split('?')[1]||'').get('workId');if(id&&current())openInspectionWorkDetail(id,()=>load(false));});
  const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('#modalRoot .sheet'))load(false);},30000);
  cleanup=()=>{alive=false;clearInterval(timer);closeHelp?.(true);};
}
export async function openInspectionWorkDetail(workId,onChanged=()=>{}) {
  const {sheet,close}=dialog(t('Inspection details'),`<p>${L('Loading…')}</p>`);
  let completionDraft='',findingDrafts=new Map();
  function capture(){
    const note=sheet.querySelector('[data-work-note]');if(note)completionDraft=note.value;
    sheet.querySelectorAll('[data-result]').forEach(select=>{const i=Number(select.dataset.result);findingDrafts.set(i,{result:select.value,note:sheet.querySelector(`[data-result-note="${i}"]`).value});});
  }
  async function render(){
    const result=await inspectionWork('DETAIL',{workId});if(!sheet.isConnected)return;
    const item=result.item,manage=result.canManage,editable=!manage&&item.stage==='IN_PROGRESS',active=['ASSIGNED','IN_PROGRESS','BLOCKED'].includes(item.stage);
    const required=item.items.filter(check=>check.mandatory),saved=required.filter(check=>['PASS','FAIL'].includes(check.result)).length;
    const needsNote=editable||manage&&item.stage==='AWAITING_REVIEW';
    const guidance=manage?(item.stage==='AWAITING_REVIEW'?'Check the saved findings and evidence below. Approve the inspection, or explain what needs changing and return it.':'Review the assigned inspection and its saved findings below.'):
      item.stage==='ASSIGNED'||item.stage==='BLOCKED'?'Tap Start / resume work to record your inspection findings.':item.stage==='IN_PROGRESS'?'Choose your results below, add a completion note, then submit. Your findings are saved automatically when you submit.':item.stage==='AWAITING_REVIEW'?'Submitted to your manager. Your findings are read only while you wait for review.':item.stage==='COMPLETED'?'Your manager has approved this inspection.':'This inspection is no longer open for updates. Ask your manager to review the assignment.';
    sheet.querySelector('[data-work-body]').innerHTML=`<h3 class="iw-title">${esc(item.title)}</h3><span class="iw-stage">${esc(stageLabel(item.stage))}</span>
      ${item.location?`<p class="iw-meta">${esc(item.location)}</p>`:''}${item.dueDate?`<p class="iw-meta">${L('Due')}: ${esc(item.dueDate)}</p>`:''}${item.instructions?`<p style="white-space:pre-wrap">${esc(item.instructions)}</p>`:''}
      <div class="iw-progress"><strong data-findings-progress>${saved} / ${required.length} ${L(editable?'required checks filled in':'required findings saved')}</strong><p class="iw-hint">${L(guidance)}</p></div>
      ${item.managerNote?`<section class="iw-section"><h4>${L('Manager feedback')}</h4><p>${esc(item.managerNote)}</p></section>`:''}
      ${manage&&!['COMPLETED','AWAITING_REVIEW'].includes(item.stage)?`<button type="button" class="dash-filter" data-work-reassign>${L('Assign / reassign inspection')}</button>`:''}
      <section class="iw-section"><h4>${L('1. Inspection findings')}</h4><p class="iw-hint">${L(editable?'Choose Pass or Fail. Explain any failure. Submit for review saves your results and sends them to your manager.':'Saved results for this inspection.')}</p>
      ${item.items.map((check,index)=>{const draft=findingDrafts.get(index),value=draft?.result??check.result,note=draft?.note??check.note;return `<div class="iw-check"><span class="iw-check-title">${esc(check.text)} ${check.mandatory?`<span class="iw-required">${L('Required')}</span>`:''}</span>${!editable?`<p class="iw-hint">${L('Saved result')}: <strong>${esc(stageLabel(check.result))}</strong>${check.note?' · '+esc(check.note):''}</p>`:''}${editable?`<label class="iw-field">${L('Result')}<select data-result="${index}" aria-required="${!!check.mandatory}" style="${style}"><option value="">${L('Choose Pass or Fail')}</option><option value="PASS"${value==='PASS'?' selected':''}>${L('Pass')}</option><option value="FAIL"${value==='FAIL'?' selected':''}>${L('Fail')}</option></select></label><label class="iw-field"><span data-finding-note-label="${index}">${L(value==='FAIL'?'Failure explanation — required':'Finding note — optional for Pass')}</span><textarea data-result-note="${index}" aria-required="${value==='FAIL'}" maxlength="4000" rows="2" placeholder="${L('Describe what you checked or what failed.')}" style="${style}">${esc(note)}</textarea></label>`:''}</div>`;}).join('')}</section>
      ${result.equipment?.length?`<details class="iw-section"><summary>${L('Related safety equipment — reference only')}</summary><p class="iw-hint">${L('Reference information. Record your findings in section 1 above.')}</p>${result.equipment.map(e=>`<p><strong>${esc(e.title)}</strong><br>${esc([e.category,e.location].filter(Boolean).join(' · '))}${e.expiryDate?'<br>'+L('Expiry')+': '+esc(new Date(e.expiryDate).toLocaleDateString()):''}</p>`).join('')}</details>`:''}
      ${active||manage&&item.stage==='AWAITING_REVIEW'?`<section class="iw-section"><h4>${L(manage?'2. Review decision':'2. Update and submit')}</h4>
      <label class="iw-field">${L(editable?'Completion / update note':manage?'Review note':'Update note')} ${needsNote?`<span class="iw-required">${L(manage?'Required when returning':'Required to submit')}</span>`:''}<textarea data-work-note maxlength="4000" rows="3" placeholder="${L(manage?'Explain any changes needed before approval.':'Summarise what you checked, the outcome and anything needing attention.')}" style="${style}">${esc(completionDraft)}</textarea></label>
      <p class="iw-hint">${L(manage?'A note is required when returning an inspection. Approval records the findings; it does not mark failed equipment repaired.':editable?'Enter a completion note, then tap Submit for review. This saves all your findings and sends the inspection to your manager.':'Use Add note to save an update, or explain why you cannot continue before reporting a blocker.')}</p>
      <div class="iw-actions">${!manage&&['ASSIGNED','BLOCKED'].includes(item.stage)?button('START','Start / resume work'):''}
      ${!manage&&['ASSIGNED','IN_PROGRESS'].includes(item.stage)?button('BLOCK','Report a blocker'):''}${editable?button('SUBMIT','Submit for review'):''}${active?button('NOTE','Save update note'):''}
      ${manage&&item.stage==='AWAITING_REVIEW'?button('APPROVE','Approve completion')+button('RETURN','Return for follow-up'):''}</div></section>`:''}
      <p data-work-status role="status" aria-live="polite"></p>
      ${!manage&&active?`<section class="iw-section"><h4>${L('Photo evidence — optional')}</h4><p class="iw-hint">${L('Attach a photo to support your findings. Wait for Photo saved before submitting.')}</p><label class="iw-field">${L('Add photo')}<input data-work-photo type="file" accept="image/*" style="${style}"></label></section>`:''}
      <section class="iw-section"><h4>${L('Updates and evidence')}</h4>${result.events.map(event=>`<div class="iw-history"><strong>${esc(stageLabel(event.action))}</strong>${event.note?`<p style="white-space:pre-wrap">${esc(event.note)}</p>`:''}<small>${esc(new Date(event.createdAt).toLocaleString())}</small>${event.photo?`<div><button type="button" class="dash-filter" data-event-photo="${esc(event.docId)}">${L('View photo')}</button></div>`:''}</div>`).join('')||L('No updates yet.')}</section>`;
    sheet.querySelector('[data-work-reassign]')?.addEventListener('click',()=>{close();openInspectionWorkAssign({kind:item.kind,sourceDocId:item.sourceDocId,targetUid:item.assigneeUid,dueDate:item.dueDate,title:item.title},onChanged);});
    sheet.querySelectorAll('[data-result]').forEach(select=>{
      const index=Number(select.dataset.result),note=sheet.querySelector(`[data-result-note="${index}"]`),update=()=>{
        capture();clearError(select);clearError(note);sheet.querySelector(`[data-finding-note-label="${index}"]`).textContent=t(select.value==='FAIL'?'Failure explanation — required':'Finding note — optional for Pass');note.setAttribute('aria-required',String(select.value==='FAIL'));
        const filled=item.items.filter((check,i)=>check.mandatory&&['PASS','FAIL'].includes(sheet.querySelector(`[data-result="${i}"]`)?.value)&& (sheet.querySelector(`[data-result="${i}"]`).value!=='FAIL'||sheet.querySelector(`[data-result-note="${i}"]`).value.trim())).length;
        sheet.querySelector('[data-findings-progress]').textContent=filled+' / '+required.length+' '+t('required checks filled in');
      };select.onchange=update;note.oninput=update;update();
    });
    sheet.querySelector('[data-work-note]')?.addEventListener('input',event=>{completionDraft=event.target.value;clearError(event.target);});
    sheet.querySelectorAll('[data-work-action]').forEach(b=>b.onclick=()=>{
      const command=b.dataset.workAction,note=sheet.querySelector('[data-work-note]'),errors=[];
      if(command==='SUBMIT'){
        item.items.forEach((check,index)=>{const select=sheet.querySelector(`[data-result="${index}"]`),fieldNote=sheet.querySelector(`[data-result-note="${index}"]`);
          if(!select)return;
          if(check.mandatory&&!['PASS','FAIL'].includes(select.value))errors.push([select,'Choose Pass or Fail for this check.']);
          else if(select.value==='FAIL'&&!fieldNote.value.trim())errors.push([fieldNote,'Explain what failed before submitting.']);

        });
      }
      if(['SUBMIT','NOTE','BLOCK','RETURN'].includes(command)&&!note?.value.trim())errors.push([note,command==='SUBMIT'?'Add a completion note before submitting for review.':command==='BLOCK'?'Explain what is stopping this inspection.':command==='RETURN'?'Explain what the Inspector needs to change.':'Enter an update before using Add note.']);
      if(revealErrors(sheet,errors))return;capture();
      busy(sheet,async()=>{
        if(command==='SUBMIT'){
          for(let index=0;index<item.items.length;index++){
            const check=item.items[index],draft=findingDrafts.get(index);if(!draft||!['PASS','FAIL'].includes(draft.result))continue;
            if(draft.result===check.result&&draft.note.trim()===(check.note||'').trim())continue;
            const previousRevision=item.revision;
            const saved=await inspectionWork('RESULT',{workId,revision:previousRevision,itemKey:check.key,result:draft.result,note:draft.note});
            if(typeof saved.revision==='number')item.revision=saved.revision;
            else {
              // A retried request may already have saved. Accept only that one expected revision.
              const fresh=await inspectionWork('DETAIL',{workId});
              if(fresh.item.assignmentVersion!==item.assignmentVersion||fresh.item.revision!==previousRevision+1||fresh.item.stage!=='IN_PROGRESS')throw Error(t('This inspection changed elsewhere. Reopen it before submitting.'));
              item.revision=fresh.item.revision;
            }
            check.result=draft.result;check.note=draft.note.trim();
          }
        }
        await inspectionWork('UPDATE',{workId,revision:item.revision,command,note:note?.value||''});if(['NOTE','SUBMIT','BLOCK','RETURN','APPROVE'].includes(command))completionDraft='';await render();const messages={START:'Inspection started. Choose your results above, then submit for review.',SUBMIT:'Submitted for manager review.',NOTE:'Update added. This does not submit the inspection.',BLOCK:'Blocker reported to your manager.',RETURN:'Inspection returned for follow-up.',APPROVE:'Inspection approved.'};status(sheet,t(messages[command]||'Saved.'));onChanged();});
    });
    sheet.querySelector('[data-work-photo]')?.addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;capture();busy(sheet,async()=>{
      const base64=await jpegEvidence(file);await inspectionWork('UPLOAD_PHOTO',{workId,revision:item.revision,base64,note:completionDraft});await render();status(sheet,t('Photo saved.'));onChanged();
    });});
    sheet.querySelectorAll('[data-event-photo]').forEach(b=>b.onclick=()=>busy(sheet,async()=>{
      const image=await inspectionWork('GET_PHOTO',{workId,eventId:b.dataset.eventPhoto});if(!sheet.isConnected)return;
      const img=document.createElement('img');img.alt=t('Inspection evidence');img.style.maxWidth='100%';img.src='data:image/jpeg;base64,'+image.base64;b.after(img);b.remove();
    }));
  }
  try{await render();}catch(error){status(sheet,error.message,'error');}
  return close;
}

export async function openInspectionWorkAssign(source={},onChanged=()=>{}) {
  if(!canManageWork())return;
  const {sheet,close}=dialog(t('Assign inspection'),`<p>${L('Loading…')}</p>`);
  try{
    const setup=await inspectionWork('SETUP');if(!sheet.isConnected)return;
    sheet.querySelector('[data-work-body]').innerHTML=`<p>${L('Choose an existing Safety checklist or equipment check and the Inspector sign-in account responsible for it. Crew links are not required.')}</p>
      <label>${L('Inspection')}<select data-assign-source style="${style}"><option value="">${L('Choose inspection')}</option>${setup.sources.map((s,i)=>`<option value="${i}"${s.kind===source.kind&&s.docId===source.sourceDocId?' selected':''}>${esc(s.title)} · ${esc(s.location||s.kind)}</option>`).join('')}</select></label>
      <label>${L('Inspector sign-in account')}<select data-assign-user style="${style}"><option value="">${L('Choose Inspector')}</option>${setup.users.map(u=>`<option value="${esc(u.uid)}"${u.uid===source.targetUid?' selected':''}>${esc(u.name)} · ${esc(u.email)}</option>`).join('')}</select></label>
      <label>${L('Due date (optional)')}<input data-assign-due type="date" value="${esc(source.dueDate||'')}" style="${style}"></label>
      ${!setup.users.length?`<p>${L('Add an Inspector account in User Management first.')}</p>`:''}${setup.limited?`<p>${L('Only the first 200 records from each source are listed.')}</p>`:''}${button('assign','Save assignment')}<p data-work-status role="status"></p>`;
    sheet.querySelector('[data-work-action]').onclick=()=>{
      const sourceSelect=sheet.querySelector('[data-assign-source]'),userSelect=sheet.querySelector('[data-assign-user]'),due=sheet.querySelector('[data-assign-due]'),errors=[];
      if(sourceSelect.value==='')errors.push([sourceSelect,'Choose an inspection to assign.']);if(!userSelect.value)errors.push([userSelect,'Choose an Inspector sign-in account.']);
      if(due.validity.badInput)errors.push([due,'Enter a valid due date or leave it blank.']);if(revealErrors(sheet,errors))return;
      const selected=setup.sources[Number(sourceSelect.value)];busy(sheet,async()=>{await inspectionWork('ASSIGN',{kind:selected.kind,sourceDocId:selected.docId,targetUid:userSelect.value,dueDate:due.value});onChanged();close();});
    };
  }catch(error){status(sheet,error.message);}
}
