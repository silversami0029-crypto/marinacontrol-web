import { getLocale as uiLocale } from '../i18n.js';
import { italianUI as itUI } from '../i18n.js';
import {showYardPackageMenu} from './YardPackageMenu.js';
import {showYardJobCosts} from './YardJobCosts.js';
import {showYardEstimates} from './YardEstimates.js';
import {readYardWorkPackages,launchState,launchLabel,ensureYardWorkStyles} from '../util/YardWorkPackageApi.js';
import {showMaintenanceMenu} from './MaintenanceMenuSheet.js';
import {showMaintenanceDetail} from './MaintenanceDetailSheet.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types=['Engine','Electrical','Plumbing','Hull','Deck','Rigging','Navigation','Safety Equipment','HVAC','Fuel System','Steering','Bilge','Interior','Exterior','Other'];
export function renderYardWorkPackages(root,{model,manager,writer,boatId,onBoat,dialog,mutate,onChanged}){
 ensureYardWorkStyles();let data=null,dead=false;const boats=model.boats||[],selected=boats.find(b=>b.id===Number(boatId));
 const contexts=Object.values(model.yard.stays||{}).filter(s=>s.boatId===Number(boatId)).map(s=>({key:'stay:'+s.id,stayId:s.id,slot:s.slot,label:`${s.slot} · ${s.status==='RESERVED'?itUI('Reserved'):itUI('In storage')} · ${s.startDate} to ${s.endDate}`}));
 for(const [slot,s]of Object.entries(model.yard.spaces))if(s.boatId===Number(boatId)&&!contexts.some(c=>c.slot===slot&&Object.values(model.yard.stays||{}).some(st=>st.id===c.stayId&&st.status==='IN_STORAGE')))contexts.push({key:'slot:'+slot,stayId:'',slot,label:slot+itUI(' · existing assignment')});
 root.innerHTML=`<div class="ys-planner-toolbar"><label>${itUI("Boat")}<select data-package-boat><option value="">${itUI("Select boat")}</option>${boats.map(b=>`<option value="${b.id}" ${b.id===Number(boatId)?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label><button data-work-help>${itUI("Work packages help")}</button><button data-work-refresh>${itUI("Refresh")}</button></div><div data-package-content>
<p role="status" class="${selected?'ys-status ys-saving-feedback':''}">${selected?itUI('Loading work packages…'):itUI('Select a boat to view its preparation work.')}</p>

</div>`;
 root.querySelector('[data-package-boat]').onchange=e=>onBoat(Number(e.target.value));root.querySelector('[data-work-refresh]').onclick=onChanged;
 root.querySelector('[data-work-help]').onclick=()=>dialog(itUI('Work packages and launch requirements'),`<ol><li>${itUI("Select a boat with an active reservation/stay or an existing yard assignment.")}</li><li>${itUI("Create a winter, spring or custom package. Review every task, due date, owner and launch requirement before saving.")}</li><li>${itUI("The package creates normal Fleet maintenance tasks. Use each task’s existing menu to assign, edit, complete, defer, review or archive it.")}</li><li>${itUI("Only administrators/managers can approve optional work, with a recorded reason. Existing unfinished tasks block launch until explicitly reviewed.")}</li><li>${itUI("Editing an optional task’s type or notes invalidates that launch review. Re-review it from the task menu.")}</li><li>${itUI("If a package task is deleted, it stays listed as missing and blocks launch until a manager records why it was removed.")}</li></ol><p>${itUI("Package progress follows actual task completion. Creating or completing a package does not automatically approve launch; the existing manager readiness confirmation and manual blockers still apply.")}</p><p>${itUI("Templates are editable planning prompts, not manufacturer procedures or safety certificates. Owners must be qualified for their assigned work.")}</p>`);
 const content=root.querySelector('[data-package-content]'),active=()=>root.isConnected&&!dead;
 if(!selected)return;
 const show=()=>{
  if(!active())return;const tasks=new Map(data.tasks.map(t=>[t._docId,t]));
  const incomplete=data.tasksTruncated||data.packagesTruncated||data.reviewsTruncated;
  content.innerHTML=`${incomplete?`<p class="ys-notice">${itUI("Some work records exceed the loading limit. This view is incomplete; launch readiness must be reviewed before use.")}</p>`:''}<div class="ys-planner-summary"><span>${data.packages.length} ${itUI("packages")}</span><span>${data.unfinished} ${itUI("unfinished maintenance tasks")}</span><span>${data.launchBlockers} ${itUI("launch blockers / reviews")}</span></div>
  ${manager&&data.writable&&contexts.length?`<button data-create-package>${itUI("Create work package")}</button>`:''}${!contexts.length?`<p class="ys-note">${itUI("Create a storage reservation or assign this boat to the yard before creating a new package. Existing package history remains visible.")}</p>`:''}
  <p class="ys-note">${itUI("Progress comes from the normal Fleet maintenance records. Refresh after other users’ changes. Required and unreviewed work blocks launch; approved optional work remains visible.")}</p>
  <div class="yw-packages">${data.packages.sort((a,b)=>b.createdAt-a.createdAt).map(p=>{
   const remaining=p.taskDocIds.filter(id=>!p.removedTasks?.[id]),done=remaining.filter(id=>tasks.get(id)&&launchState(tasks.get(id))==='COMPLETED').length,missing=remaining.filter(id=>!tasks.has(id)).length;
   const blockers=remaining.filter(id=>!tasks.has(id)||!['COMPLETED','OPTIONAL'].includes(launchState(tasks.get(id)))).length;
   return `<article class="yw-package"><h3>${esc(p.name)}</h3><p>${esc(p.slot)}${p.stayId?itUI(' · linked storage stay'):''} · ${esc(p.template)} · ${esc(new Date(p.createdAt).toLocaleDateString(uiLocale()))}</p><p><strong>${done} / ${remaining.length} ${itUI("completed")}</strong> · ${blockers} ${itUI("launch blockers / reviews ·")} ${Object.keys(p.removedTasks||{}).length} ${itUI("reviewed removals")}${missing?' · '+missing+' missing':''}</p><progress max="${remaining.length||1}" value="${done}" aria-label="${itUI("Package completion")}"></progress>
   <button type="button" class="mt-kebab" data-package-menu="${esc(p.id)}" aria-label="${itUI("Work package options")}" style="width:44px;height:44px;min-width:44px;padding:0;border:0;background:transparent;display:grid;place-items:center;margin-inline-start:auto"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="5" r="0.6" fill="currentColor"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/><circle cx="12" cy="19" r="0.6" fill="currentColor"/></svg></button><div class="yw-tasks">${p.taskDocIds.map(id=>{
    const task=tasks.get(id),removed=p.removedTasks?.[id];
    if(removed)return `<div class="yw-task yw-muted"><strong>${esc(p.taskTitles?.[id]||itUI('Task'))}</strong><span>${itUI("Removal reviewed:")} ${esc(removed.reason)}</span></div>`;
    if(!task)return `<div class="yw-task"><strong>${esc(p.taskTitles?.[id]||itUI('Task'))}</strong><span class="yw-error">${itUI("Missing task — launch review required")}</span>${manager&&data.writable&&!incomplete?`<button data-removed="${esc(id)}" data-package="${esc(p.id)}">${itUI("Review removal")}</button>`:''}</div>`;
    return taskRow(task);
   }).join('')}</div></article>`;
  }).join('')||`<p>${itUI("No work packages for this boat yet.")}</p>`}</div>
  <details class="ys-history"><summary>${itUI("Other boat maintenance (")}${data.tasks.filter(t=>!t.workPackageId).length})</summary>${data.tasks.filter(t=>!t.workPackageId).map(taskRow).join('')}</details>`;
  content.querySelectorAll('[data-package-menu]').forEach(b=>b.onclick=()=>showYardPackageMenu({packageId:b.dataset.packageMenu,dialog}));
  content.querySelector('[data-create-package]')?.addEventListener('click',()=>showCreatePackage({model,data,selected,contexts,dialog,mutate}));
  content.querySelectorAll('[data-task-menu]').forEach(b=>b.onclick=()=>{const task=tasks.get(b.dataset.taskMenu);if(!active()||!task)return;if(writer&&data.writable)showMaintenanceMenu(task,{onChanged});else showMaintenanceDetail(task);});
  content.querySelectorAll('[data-removed]').forEach(b=>b.onclick=()=>{const sheet=dialog(itUI('Review removed package task'),`<p>${itUI("This task is no longer in Maintenance. Record why it was removed. This acknowledges the removal; it does not claim that the work was performed.")}</p><form><label>${itUI("Reason")}<textarea name="reason" maxlength="300" required></textarea></label><button>${itUI("Confirm removal review")}</button></form>`);sheet.querySelector('form').onsubmit=e=>{e.preventDefault();mutate({api:'work_packages',action:'ACKNOWLEDGE_REMOVED_TASK',packageId:b.dataset.package,taskDocId:b.dataset.removed,reason:new FormData(e.target).get('reason')});};});
 };
 const taskRow=t=>`<div class="yw-task"><div><strong>${esc(itUI(t.workPackageTaskTitle||t.type))}</strong><span>${esc(itUI(t.type))} ${itUI("· due")} ${esc(t.date||itUI('not set'))}</span><span>${t.assignedTo?'Owner: '+esc(t.assignedTo):itUI('Unassigned')}</span>


${String(t.status||'').toUpperCase()==='DEFERRED'
  ? `<span style="color:var(--maintenance-deferred,#ffd176)">
       ${itUI("Deferred · review")} ${esc(t.reviewDate||itUI('not set'))}
     </span>`
  : ''}

<span class="yw-launch-${launchState(t).toLowerCase()}">${esc(itUI(launchLabel(t)))}</span>${t.archived?`<span>${itUI("Archived")}</span>`:''}</div>
<button type="button" class="mt-kebab"
        data-task-menu="${esc(t._docId)}"
        aria-label="${itUI("Task options")}"
        style="width:44px;height:44px;min-width:44px;padding:0;border:0;background:transparent;display:grid;place-items:center;flex-shrink:0">
  <svg viewBox="0 0 24 24" width="20" height="20"
       fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" aria-hidden="true">
    <circle cx="12" cy="5" r="0.6" fill="currentColor"/>
    <circle cx="12" cy="12" r="0.6" fill="currentColor"/>
    <circle cx="12" cy="19" r="0.6" fill="currentColor"/>
  </svg>
</button>

</div>`;
 readYardWorkPackages(selected.id).then(result=>{if(!active())return;data=result;show();}).catch(e=>{if(active())content.innerHTML=`<p class="ys-error">${esc(e.message||itUI('Could not load work packages.'))}</p><p>${itUI("Check that getYardWorkPackages and changeYardWorkPackages have been deployed, then refresh.")}</p>`;});
 return ()=>{dead=true;};
}
function showCreatePackage({model,data,selected,contexts,dialog,mutate}){
 const href=new URL('../../css/yard-quick-create.css',import.meta.url).href;if(![...document.querySelectorAll('link')].some(l=>l.href===href)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
 const templates=data.templates||[],today=model.stayToday||new Date().toISOString().slice(0,10),crewOptions=data.crew.map(c=>`<option value="${esc(c.docId)}">${esc(c.name)}</option>`).join('');
 const sheet=dialog(itUI('Create work package'),`<p><strong>${esc(selected.name)}</strong></p><form class="yq-form" data-work-package><label>${itUI("Template")}<select name="template">${templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}<option value="CUSTOM">${itUI("Custom package")}</option></select></label><label>${itUI("Due date")}<input name="defaultDate" type="date" min="2000-01-01" max="2100-12-31" value="${esc(today)}" required></label><label>${itUI("Owner")}<select name="defaultOwner"><option value="">${itUI("Unassigned")}</option>${crewOptions}</select></label><p class="ys-note yq-hint">${itUI("Keep the tasks you need. Edit details only for exceptions.")}</p><div data-work-items></div><button type="button" data-add-row>${itUI("Add task")}</button><div data-optional hidden><label>${itUI("Reason for optional work")}<textarea name="optionalReason" maxlength="300"></textarea></label></div><details class="yq-extra" ${contexts.length>1?'open':''}><summary>${itUI("Package details")}</summary><label>${itUI("Package name (optional)")}<input name="name" maxlength="120" placeholder="${itUI("Filled automatically")}"></label><label>${itUI("Storage stay / assignment")}<select name="context">${contexts.length>1?`<option value="">${itUI("Choose assignment or stay")}</option>`:''}${contexts.map(c=>`<option value="${esc(c.key)}">${esc(c.label)}</option>`).join('')}</select></label></details><p class="ys-note">${itUI("Included tasks are required before launch unless reviewed as optional. Other launch checks still apply.")}</p><p class="ys-form-error" role="status"></p><button type="submit">${itUI("Create package")}</button></form>`);
 const form=sheet.querySelector('form'),items=sheet.querySelector('[data-work-items]'),error=sheet.querySelector('.ys-form-error');
 const included=()=>[...items.children].filter(el=>el.querySelector('[data-include]').checked);
 const refresh=()=>{sheet.querySelector('[data-optional]').hidden=!included().some(el=>!el.querySelector('[data-required]').checked);for(const el of items.children){const on=el.querySelector('[data-include]').checked;el.classList.toggle('yq-excluded',!on);el.querySelectorAll('details input,details select,details textarea').forEach(n=>n.disabled=!on);el.querySelector('[data-task-title]').textContent=el.querySelector('[data-title]').value.trim()||itUI('New task');}error.textContent='';};
 const row=(r={},expanded=false)=>{
  const el=document.createElement('div');el.className='yq-task';el.innerHTML=`<label class="yq-include"><input type="checkbox" data-include checked><span data-task-title>${esc(r.title||itUI('New task'))}</span></label><details ${expanded?'open':''}><summary>${itUI("Edit details")}</summary><label>${itUI("Work title")}<input data-title maxlength="120" value="${esc(r.title||'')}"></label><label>${itUI("Type")}<select data-type>${types.map(t=>`<option value="${esc(t)}" ${t===(r.type||'Other')?'selected':''}>${esc(itUI(t))}</option>`).join('')}</select></label><label>${itUI("Different due date (optional)")}<input data-date type="date" min="2000-01-01" max="2100-12-31"></label><label>${itUI("Different owner (optional)")}<select data-owner><option value="">${itUI("Use package owner")}</option><option value="__unassigned">${itUI("Unassigned")}</option>${crewOptions}</select></label><label>${itUI("Work notes")}<textarea data-notes maxlength="300">${esc(r.notes||'')}</textarea></label><label class="yq-include"><input data-required type="checkbox" checked> ${itUI("Required before launch")}</label><button type="button" data-remove-row>${itUI("Remove task")}</button></details>`;
  el.querySelector('[data-remove-row]').onclick=()=>{el.remove();refresh();};el.oninput=refresh;el.onchange=refresh;items.append(el);refresh();
 };
 let previousTemplate=form.elements.template.value;
 const apply=()=>{items.replaceChildren();const template=templates.find(t=>t.id===form.elements.template.value);for(const t of template?.tasks||[{}])row(t,!template);form.elements.name.placeholder=(template?.name||itUI('Custom work'))+' · '+selected.name;previousTemplate=form.elements.template.value;refresh();};
 form.elements.template.onchange=()=>{const changed=[...items.children].some(el=>el.dataset.edited==='true');if(changed&&!window.confirm(itUI('Replace your edited task checklist with this template?'))){form.elements.template.value=previousTemplate;return;}apply();};
 // Track changes only within the checklist; package owner and date carry across templates.
 items.addEventListener('input',e=>{const el=e.target.closest('.yq-task');if(el)el.dataset.edited='true';});items.addEventListener('change',e=>{const el=e.target.closest('.yq-task');if(el)el.dataset.edited='true';});
 apply();sheet.querySelector('[data-add-row]').onclick=()=>{if(items.children.length>=50){error.textContent='Maximum 50 tasks.';return;}row({},true);};
 form.onsubmit=e=>{e.preventDefault();error.textContent='';const context=contexts.find(c=>c.key===form.elements.context.value),rows=included();if(!context){sheet.querySelector('.yq-extra').open=true;form.elements.context.focus();error.textContent=itUI('Choose a storage stay or assignment in Package details.');return;}if(!rows.length){error.textContent=itUI('Keep at least one task.');return;}
  const invalid=rows.find(el=>!el.querySelector('[data-title]').value.trim());if(invalid){invalid.querySelector('details').open=true;invalid.querySelector('[data-title]').focus();error.textContent=itUI('Give the new task a title.');return;}
  const tasks=rows.map(el=>({title:el.querySelector('[data-title]').value.trim(),type:el.querySelector('[data-type]').value,date:el.querySelector('[data-date]').value||form.elements.defaultDate.value,notes:el.querySelector('[data-notes]').value.trim(),ownerDocId:el.querySelector('[data-owner]').value==='__unassigned'?'':el.querySelector('[data-owner]').value||form.elements.defaultOwner.value,requiredBeforeLaunch:el.querySelector('[data-required]').checked}));
  if(tasks.some(t=>!t.requiredBeforeLaunch)&&!form.elements.optionalReason.value.trim()){error.textContent=itUI('Record why the optional work does not need to block launch.');form.elements.optionalReason.focus();return;}
  const template=templates.find(t=>t.id===form.elements.template.value),name=form.elements.name.value.trim()||((template?.name||itUI('Custom work'))+' · '+selected.name).slice(0,120);
  mutate({api:'work_packages',action:'CREATE_PACKAGE',packageId:crypto.randomUUID(),boatDocId:selected.docId,stayId:context.stayId,slot:context.slot,name,template:form.elements.template.value,optionalReason:tasks.some(t=>!t.requiredBeforeLaunch)?form.elements.optionalReason.value.trim():'',tasks});
 };
}
