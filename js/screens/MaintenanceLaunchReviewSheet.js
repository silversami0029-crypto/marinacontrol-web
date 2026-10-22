import {store} from '../store.js';
import {app} from '../firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {packageManagers,readYardWorkPackages,maintenanceScope,launchLabel,ensureYardWorkStyles} from '../util/YardWorkPackageApi.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function showMaintenanceLaunchReview(item,{onChanged}={}){
 if(!packageManagers())return;ensureYardWorkStyles();
 const clientId=Number(store.activeClientId),uid=store.authUser?.uid,hash=location.hash;
 if(clientId!==Number(item.clientId))return;
 const backdrop=document.createElement('div'),sheet=document.createElement('div');backdrop.className='sheet-backdrop is-open';sheet.className='sheet yw-sheet is-open';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','Launch requirement');
 sheet.innerHTML='<div class="yw-header"><h2>Launch requirement</h2><button type="button" data-close aria-label="Close">×</button></div><div class="yw-body"><p role="status">Loading launch requirement…</p></div>';
 document.getElementById('modalRoot').append(backdrop,sheet);let closed=false,unsubscribe=null;
 const active=()=>!closed&&sheet.isConnected&&Number(store.activeClientId)===clientId&&store.authUser?.uid===uid&&location.hash===hash;
 const close=()=>{if(closed)return;closed=true;unsubscribe?.();document.removeEventListener('keydown',keydown);window.removeEventListener('hashchange',close);backdrop.remove();sheet.remove();};
 const keydown=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const nodes=[...sheet.querySelectorAll('button,input,textarea')].filter(n=>!n.disabled);if(!nodes.length)return;const a=nodes[0],b=nodes.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}};
 sheet.querySelector('[data-close]').onclick=close;backdrop.onclick=close;document.addEventListener('keydown',keydown);window.addEventListener('hashchange',close);unsubscribe=store.subscribe(()=>{if(!active())close();});sheet.querySelector('[data-close]').focus();
 try{
  const model=await readYardWorkPackages(item.boatId);if(!active())return;
  const task=model.tasks.find(t=>t._docId===item._docId);if(!task)throw Error('Task not found in the loaded records. Refresh Maintenance.');
  if(!model.writable||task.archived)throw Error('Restore the task and ensure the marina is available before reviewing it.');
  const body=sheet.querySelector('.yw-body');body.innerHTML=`<p><strong>${esc(task.type)}</strong></p><p>${esc(task.notes)}</p><p>${esc(launchLabel(task))}</p><form><label class="yw-check"><input name="required" type="checkbox" ${task.launchState!=='OPTIONAL'?'checked':''}> Required before launch</label><label>Review reason<textarea name="reason" maxlength="300">${esc(task.launchReviewReason)}</textarea></label><p>Only administrators and managers can change this. Optional work stays visible in Maintenance. Changing its type, notes or package association requires a new launch review.</p><p class="yw-error" role="status"></p><button type="submit">Save launch requirement</button></form>`;
  const form=body.querySelector('form'),button=form.querySelector('button');let pending=null;
  form.onsubmit=async e=>{e.preventDefault();if(!active()||button.disabled)return;const required=form.elements.required.checked,reason=form.elements.reason.value.trim();if(!pending&&!required&&!reason){body.querySelector('.yw-error').textContent='Record why this work does not need to block launch.';return;}
   pending=pending||{clientId,action:'REVIEW_LAUNCH_TASK',commandId:crypto.randomUUID(),taskDocId:task._docId,expectedScope:maintenanceScope(task),required,reason};
   button.disabled=true;button.textContent='Saving…';body.querySelector('.yw-error').textContent='';form.elements.required.disabled=true;form.elements.reason.disabled=true;
   try{await httpsCallable(getFunctions(app,'us-central1'),'changeYardWorkPackages')(pending);if(!active())return;close();onChanged?.();}
   catch(err){if(!active())return;const uncertain=!['functions/failed-precondition','functions/permission-denied','functions/invalid-argument','functions/not-found','functions/already-exists'].includes(err.code);if(!uncertain)pending=null;button.disabled=false;button.textContent=uncertain?'Retry same review':'Save launch requirement';form.elements.required.disabled=uncertain;form.elements.reason.disabled=uncertain;body.querySelector('.yw-error').textContent=uncertain?'The result is uncertain. Retry the same review safely or close and refresh.':err.message||'Review could not be saved.';}
  };
 }catch(err){if(active())sheet.querySelector('.yw-body').textContent=err.message||'Unable to load launch requirement.';}
}
