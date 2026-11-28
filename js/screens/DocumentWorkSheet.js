import {store} from '../store.js';
import {t} from '../i18n.js';
import {staffWork,canManageWork,workEscape as esc,stageLabel} from '../util/StaffWorkApi.js';
import {openStaffWorkDetail} from './StaffWorkScreen.js';
import {ensureWorkInputStyles,revealFieldErrors,clearFieldError} from '../util/WorkFormFeedback.js';
const L=value=>esc(t(value));
export async function showDocumentWork(item){
  if(!canManageWork())return;ensureWorkInputStyles();
  const uid=store.authUser?.uid,clientId=Number(store.activeClientId),backdrop=document.createElement('div'),sheet=document.createElement('div');let saving=false;
  backdrop.className='sheet-backdrop is-open';sheet.className='sheet work-input-sheet is-open';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
  sheet.innerHTML=`<header class="work-input-header"><h3>${L('Assign document work')}</h3><button type="button" class="dash-filter" data-ew-close aria-label="${L('Close')}">×</button></header><div class="work-input-body" data-ew-body><p>${L('Loading…')}</p><p data-work-status role="status" aria-live="polite"></p></div>`;
  document.getElementById('modalRoot').append(backdrop,sheet);
  const close=()=>{if(!saving){sheet.remove();backdrop.remove();unsubscribe?.();}},current=()=>sheet.isConnected&&uid===store.authUser?.uid&&clientId===Number(store.activeClientId)&&!store.marinaSwitching&&canManageWork();
  const unsubscribe=store.subscribe?.(()=>{if(sheet.isConnected&&!current()){sheet.remove();backdrop.remove();unsubscribe?.();}});
  backdrop.onclick=close;sheet.querySelector('[data-ew-close]').onclick=close;
  const reference={...(item._docId?{documentDocId:item._docId}:{documentId:Number(item.id)}),expectedBoatId:Number(item.boatId||0)};
  try{
    const result=await staffWork('DOCUMENT_SETUP',reference);if(!current())return;
    const record=result.document;
    sheet.querySelector('[data-ew-body]').innerHTML=`<h4>${esc(record.name)}</h4><p class="work-input-hint">${esc(record.location)}${record.responsiblePerson?'<br>'+L('Responsible person')+': '+esc(record.responsiblePerson):''}</p>
      <p class="work-input-hint">${L('Give the crew a specific job. This creates an assigned Staff Work task and a personal alert. Document responsibility, files and expiry dates remain separate.')}</p>
      <label>${L('Work title — required')}<input data-ew-title maxlength="200" placeholder="${L('For example: renew the safety equipment certificate')}"></label>
      <label>${L('Instructions — required')}<textarea data-ew-instructions rows="3" maxlength="3000" placeholder="${L('Describe the work to do and the outcome you need.')}" ></textarea></label>
      <label>${L('Crew member — linked Staff sign-in required')}<select data-ew-crew><option value="">${L('Choose crew')}</option>${result.crew.map(c=>`<option value="${esc(c.docId)}"${c.linked?'':' disabled'}>${esc(c.name)} · ${L(c.linked?'Linked Staff account':'No active Staff link')}</option>`).join('')}</select></label>
      ${!result.crew.some(c=>c.linked)?`<p class="work-input-hint">${L('No linked Staff accounts are available. Save the crew/account link in Staff Work → Crew account links first.')}</p>`:''}
      <label>${L('Due date — optional')}<input data-ew-due type="date"></label><label>${L('Priority')}<select data-ew-priority>${['LOW','MEDIUM','HIGH','CRITICAL'].map(p=>`<option value="${p}"${p==='MEDIUM'?' selected':''}>${esc(stageLabel(p))}</option>`).join('')}</select></label>
      <p data-work-status role="status" aria-live="polite"></p><button type="button" class="dash-filter work-primary" data-ew-save>${L('Assign work')}</button>
      <h4>${L('Existing document work')}</h4><p class="work-input-hint">${L('Check existing tasks below before assigning the same job again.')}</p>${result.items.length?result.items.map(work=>`<button type="button" class="dash-filter" data-ew-open="${esc(work.docId)}" style="display:block;width:100%;text-align:start;margin:8px 0;padding:12px"><strong>${esc(work.title)}</strong><br>${esc(stageLabel(work.stage))} · ${esc(work.assigneeName||'')}</button>`).join(''):`<p class="work-input-hint">${L('No work has been created from this document record yet.')}</p>`}${result.limited?`<p class="work-input-hint">${L('Up to 50 document tasks are shown. Use Staff Work for the full list.')}</p>`:''}`;
    sheet.querySelectorAll('input,textarea,select').forEach(field=>{field.addEventListener('input',()=>clearFieldError(field));field.addEventListener('change',()=>clearFieldError(field));});
    sheet.querySelectorAll('[data-ew-open]').forEach(button=>button.onclick=()=>{close();if(uid===store.authUser?.uid&&clientId===Number(store.activeClientId))openStaffWorkDetail(button.dataset.ewOpen);});
    sheet.querySelector('[data-ew-save]').onclick=async()=>{
      if(saving||!current())return;const title=sheet.querySelector('[data-ew-title]'),instructions=sheet.querySelector('[data-ew-instructions]'),crew=sheet.querySelector('[data-ew-crew]'),due=sheet.querySelector('[data-ew-due]'),errors=[];
      if(!title.value.trim())errors.push([title,'Enter a work title.']);if(!instructions.value.trim())errors.push([instructions,'Describe the work to do.']);if(!crew.value)errors.push([crew,'Choose a crew member linked to an active Staff account.']);if(due.validity.badInput)errors.push([due,'Enter a valid due date or leave it blank.']);if(revealFieldErrors(sheet,errors))return;
      const payload={documentDocId:record.docId,expectedBoatId:record.boatId,title:title.value,instructions:instructions.value,crewDocumentId:crew.value,dueDate:due.value,priority:sheet.querySelector('[data-ew-priority]').value};
      saving=true;const controls=[...sheet.querySelectorAll('button,input,select,textarea')];controls.forEach(c=>c.disabled=true);const status=sheet.querySelector('[data-work-status]');status.dataset.kind='';status.textContent=t('Assigning work…');
      try{const created=await staffWork('CREATE_DOCUMENT_WORK',payload);if(!current())return;saving=false;close();openStaffWorkDetail(created.workId);}
      catch(error){if(current()){status.dataset.kind='error';status.textContent=error.message||t('Could not assign work. Try again.');}}
      finally{saving=false;controls.forEach(c=>c.disabled=false);}
    };
  }catch(error){if(current()){const status=sheet.querySelector('[data-work-status]');status.textContent=error.message;status.dataset.kind='error';}}
  return close;
}
