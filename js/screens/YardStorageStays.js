import { italianUI as itUI } from '../i18n.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const active=model=>Object.values(model.yard.stays||{});
const occupiedStay=(model,id)=>active(model).find(s=>s.slot===id&&s.status==='IN_STORAGE');
const jobs=(model,s)=>Object.values(model.yard.planning?.jobs||{}).filter(j=>j.stayId===s.id||(s.status==='IN_STORAGE'&&j.slot===s.slot&&j.boatDocId===s.boatDocId));
const title=s=>itUI(s.status==='IN_STORAGE'?'In storage':s.status==='RESERVED'?'Reserved':s.status==='DEPARTED'?'Departed':'Cancelled');
export function stayAvailability(model,boat,slot,start,end,ignoreId=''){
 if(!start||!end||start>end)return itUI('Choose dates');
 const space=model.yard.spaces[slot];if(space?.unavailable)return itUI('Unavailable');
 for(const s of active(model))if(s.id!==ignoreId&&s.startDate<=end&&s.endDate>=start&&(s.slot===slot||s.boatDocId===boat?.docId||s.boatId===boat?.id))return `Booked: ${s.boatName} · ${s.slot}`;
 for(const [id,p]of Object.entries(model.yard.spaces)){
  if(!p.boatDocId||(id!==slot&&p.boatDocId!==boat?.docId&&p.boatId!==boat?.id))continue;
  const live=occupiedStay(model,id);if(live?.id===ignoreId)continue;
  if(!live)return `Existing assignment in ${id}: record its stay first`;
  if(live.endDate>=start)return `Current stay in ${id}`;
 }
 return '';
}
export function showStayForm({model,dialog,mutate,stay=null,slotId='',adopt=false}){
 const p=model.yard.spaces[slotId],boats=model.boats||[],customers=model.customers||[];
 if(!model.yard.planning?.timeZone){dialog(itUI('Set the marina time zone'),`<p>${itUI("Open Day planner → Planner settings & equipment and set the marina time zone first.")}</p>`);return;}
 const editing=!!stay,boatId=stay?.boatDocId||(adopt?p?.boatDocId:''),start=stay?.startDate||(adopt?p?.haulDate||model.stayToday:model.stayToday),end=stay?.endDate||(adopt?p?.launchDate||'':'');
 const slots=model.yard.zones.flatMap(z=>Array.from({length:z.capacity},(_,i)=>({id:`${z.id}-${i+1}`,label:`${z.id}${i+1}`})));
 const sheet=dialog(editing?itUI('Amend storage stay'):adopt?itUI('Record arrival for existing assignment'):itUI('Reserve yard storage'),`
 <p>${itUI("Storage dates include both the first and last day. Two bookings cannot share the same space or boat on the same date. Timed lifting appointments are booked separately in the Day planner.")}</p>
 ${adopt?`<p class="ys-notice">${itUI("Confirm when this boat actually arrived ashore. Its current assignment and maintenance remain intact.")}</p>`:''}
 <form data-stay-form>
 <label>${itUI("Boat")}<select name="boatDocId" required ${editing||adopt?'disabled':''}><option value="">${itUI("Select boat")}</option>${boats.map(b=>`<option value="${esc(b.docId)}" ${b.docId===boatId?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
 <label>${itUI("Customer")}<select name="customerDocId" required ${editing?'disabled':''}><option value="">${itUI("Select customer")}</option>${customers.map(c=>`<option value="${esc(c.docId)}" ${c.docId===stay?.customerDocId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
 ${model.customersTruncated?`<p class="ys-notice">${itUI("Customer selection is limited to the first 1000 records.")}</p>`:''}
 <div class="ys-time-pair"><label>${itUI("First storage day")}<input name="startDate" type="date" value="${esc(start)}" min="2000-01-01" max="2100-12-31" required></label><label>${itUI("Last storage day")}<input name="endDate" type="date" value="${esc(end)}" min="2000-01-01" max="2100-12-31" required></label></div>
 <label>${itUI("Yard space")}<select name="slot" required ${adopt||stay?.status==='IN_STORAGE'?'disabled':''}>${slots.map(s=>`<option value="${esc(s.id)}" ${s.id===(stay?.slot||slotId)?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label><p data-availability class="ys-note"></p>
 ${adopt?`<label>${itUI("Actual arrival ashore")}<input name="actualArrivalDate" type="date" max="`+esc(model.stayToday)+'" required></label>':''}
 <label>${itUI("Stay notes / storage requirements")}<textarea name="notes" maxlength="500">${esc(stay?.notes)}</textarea></label>
 <p>${itUI("Notes record requirements; this version does not validate boat dimensions, weight, cradle suitability or lifting qualifications.")}</p>
 <p class="ys-form-error" role="alert"></p><button ${!boats.length||!customers.length?'disabled':''}>${editing?itUI('Save amendment'):adopt?itUI('Confirm boat is ashore'):itUI('Reserve space')}</button></form>`);
 const form=sheet.querySelector('form');
 const update=()=>{if(adopt)return;const boat=boats.find(b=>b.docId===form.elements.boatDocId.value);const reason=stayAvailability(model,boat,form.elements.slot.value,form.elements.startDate.value,form.elements.endDate.value,stay?.id||'');sheet.querySelector('[data-availability]').textContent=reason||itUI('No date conflict in the loaded records. The server rechecks when you save. A current occupant must still physically depart before arrival.');};
 form.addEventListener('change',update);update();
 form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);mutate({action:editing?'UPDATE_STAY':adopt?'ADOPT_STAY':'RESERVE_STAY',stayId:stay?.id||crypto.randomUUID(),slot:stay?.status==='IN_STORAGE'?stay.slot:adopt?slotId:f.get('slot'),boatDocId:stay?.boatDocId||(adopt?p.boatDocId:f.get('boatDocId')),customerDocId:stay?.customerDocId||f.get('customerDocId'),startDate:f.get('startDate'),endDate:f.get('endDate'),notes:f.get('notes'),actualArrivalDate:f.get('actualArrivalDate')||''});};
}
export function renderYardStays(root,{model,manager,dialog,mutate,onBook}){
 let filter='ACTIVE',query='';
 const draw=()=>{
 const current=active(model),history=model.stayHistory||[],unconfirmed=Object.entries(model.yard.spaces).filter(([id,s])=>s.boatDocId&&!occupiedStay(model,id));
 const rows=[...current,...history].filter(s=>(filter==='ALL'||filter==='ACTIVE'||s.status===filter)&&(filter!=='ACTIVE'||['RESERVED','IN_STORAGE'].includes(s.status))&&`${s.boatName} ${s.customerName} ${s.slot}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.slot.localeCompare(b.slot));
 root.innerHTML=`<div class="ys-planner-toolbar"><button data-stay-help>${itUI("How reservations work")}</button>${manager?`<button data-new-stay>${itUI("Reserve storage")}</button>`:''}<label>${itUI("Show")}<select data-stay-filter>${[['ACTIVE','Active stays'],['RESERVED','Reservations'],['IN_STORAGE','In storage'],['DEPARTED','Departed'],['CANCELLED','Cancelled'],['ALL','All loaded stays']].map(([v,l])=>`<option value="${v}" ${v===filter?'selected':''}>${itUI(l)}</option>`).join('')}</select></label><input data-stay-search type="search" placeholder="${itUI("Boat, customer or space")}" value="${esc(query)}"></div>
 <div class="ys-planner-summary"><span>${current.filter(s=>s.status==='RESERVED').length} ${itUI("reservations")}</span><span>${current.filter(s=>s.status==='IN_STORAGE').length} ${itUI("recorded ashore")}</span><span>${current.filter(s=>s.status==='IN_STORAGE'&&s.endDate<model.stayToday).length} ${itUI("overdue departures")}</span><span>${unconfirmed.length} ${itUI("assignments awaiting arrival confirmation")}</span></div>
 <p class="ys-note">${itUI("Dates use")} ${esc(model.yard.planning?.timeZone||itUI('the marina time zone (not set)'))}${itUI(". Expiry never clears an occupied space. Later reservations are expectations; actual arrival rechecks the space. Refresh for other users’ changes.")}</p>
 ${model.stayHistoryTruncated?`<p class="ys-notice">${itUI("History shows closed stays found among the latest 100 updated stay records. Older records remain stored.")}</p>`:''}
 ${unconfirmed.length?`<details class="ys-history"><summary>${itUI("Existing assignments — confirm actual arrival (")}${unconfirmed.length})</summary>${unconfirmed.map(([id,s])=>`<p>${esc(id)} · ${esc(s.boatName)} ${manager?`<button data-adopt="${esc(id)}">${itUI("Record existing stay")}</button>`:''}</p>`).join('')}</details>`:''}
 <div class="ys-stay-list">${rows.map(s=>{
  const blockers=s.status==='IN_STORAGE'?model.yard.spaces[s.slot]?.blockers:s.blockers;
  const booked=jobs(model,s),overdue=s.status==='IN_STORAGE'&&s.endDate<model.stayToday,missed=s.status==='RESERVED'&&s.startDate<model.stayToday;
  return `<article class="ys-stay-card"><div><strong>${esc(s.boatName)}</strong><span>${esc(s.slot)} · ${esc(s.customerName)}</span><b>${title(s)}</b></div><p>${esc(s.startDate)} → ${esc(s.endDate)}</p>${s.actualArrivalDate?`<p>${itUI("Actual arrival:")} ${esc(s.actualArrivalDate)}</p>`:''}${s.actualDepartureDate?`<p>${itUI("Actual departure:")} ${esc(s.actualDepartureDate)}</p>`:''}${overdue?`<p class="ys-job-warning">${itUI("Overdue departure — space remains occupied")}</p>`:''}${missed?`<p class="ys-job-warning">${itUI("Arrival date passed — confirm arrival, amend or cancel")}</p>`:''}${s.notes?`<p>${esc(s.notes)}</p>`:''}${blockers?`<p class="ys-job-warning">${esc(blockers)}</p>`:''}${s.departureReason?`<p>${esc(s.departureReason)}</p>`:''}${booked.length?`<p>${booked.length} ${itUI("linked appointment(s) — use Day planner to start, complete or cancel.")}</p>`:''}
  ${manager&&['RESERVED','IN_STORAGE'].includes(s.status)?`<div class="ys-actions"><button data-amend="${esc(s.id)}">${itUI("Amend stay")}</button><button data-book-stay="${esc(s.id)}">${itUI("Book")} ${itUI(s.status==='RESERVED'?'haul-out':'haul-out / launch')}</button>${s.status==='RESERVED'?`<button data-arrive="${esc(s.id)}" ${booked.length?'disabled':''}>${itUI("Record actual arrival")}</button><button data-cancel-stay="${esc(s.id)}" ${booked.length?'disabled':''}>${itUI("Cancel reservation")}</button>`:`<a href="#/maintenance?boatId=${Number(s.boatId)}">${itUI("Maintenance")}</a><button data-depart="${esc(s.id)}" ${booked.length?'disabled':''}>${itUI("Record departure / transfer")}</button>`}</div>`:''}</article>`;
 }).join('')||`<p class="ys-empty">${itUI("No stays match this view.")}</p>`}</div>`;
 root.querySelector('[data-stay-help]').onclick=()=>dialog(itUI('Reservations & stays help'),`<ol><li>${itUI("Set the marina time zone in Day planner settings and create the boat and customer records.")}</li><li>${itUI("Reserve a space for a date range. Both first and last dates are included. A reservation does not mean the boat is ashore.")}</li><li>${itUI("Book its haul-out from the reservation. Staff and equipment are checked by the Day planner.")}</li><li>${itUI("Complete the booked haul-out to record arrival automatically, or explicitly record an actual arrival if no appointment is booked.")}</li><li>${itUI("Manage maintenance from the boat’s space details. Launch readiness still requires unfinished launch-critical or unreviewed maintenance, unresolved package reviews and manual blockers to be resolved.")}</li><li>${itUI("Completing a launch records departure and retains stay history. For a physical road transfer, use Record departure / transfer with a date and reason.")}</li></ol><p>${itUI("For an existing assignment, choose Record existing stay and confirm its actual arrival. The system does not infer that it is ashore.")}</p><p>${itUI("An overdue boat continues occupying its space. If it remains beyond booked dates, amend the stay; conflicting future reservations must be resolved first.")}</p><p>${itUI("Storage stays hold space and dates. They do not validate vessel dimensions or generate contracts, charges or invoices in this release.")}</p>`);
 root.querySelector('[data-stay-filter]').onchange=e=>{filter=e.target.value;draw();};
 root.querySelector('[data-stay-search]').onchange=e=>{query=e.target.value;draw();};
 root.querySelector('[data-new-stay]')?.addEventListener('click',()=>showStayForm({model,dialog,mutate}));
 root.querySelectorAll('[data-adopt]').forEach(b=>b.onclick=()=>showStayForm({model,dialog,mutate,slotId:b.dataset.adopt,adopt:true}));
 root.querySelectorAll('[data-amend]').forEach(b=>b.onclick=()=>showStayForm({model,dialog,mutate,stay:current.find(s=>s.id===b.dataset.amend)}));
 root.querySelectorAll('[data-book-stay]').forEach(b=>b.onclick=()=>onBook(current.find(s=>s.id===b.dataset.bookStay)));
 for(const [attr,action,label] of [['arrive','ARRIVE_STAY','Record actual arrival'],['cancel-stay','CANCEL_STAY','Cancel reservation'],['depart','DEPART_STAY','Record departure / transfer']])root.querySelectorAll(`[data-${attr}]`).forEach(b=>b.onclick=()=>{
  const s=current.find(s=>s.id===b.getAttribute('data-'+attr));const arriving=action==='ARRIVE_STAY',departing=action==='DEPART_STAY';
  const sheet=dialog(label,`<p>${esc(s.boatName)} · ${esc(s.slot)}</p><p>${arriving?itUI('Confirm the boat has physically arrived ashore. This does not operate lifting equipment.'):departing?itUI('Confirm the boat has physically left the yard, for example by road transfer. This records an actual departure; it does not approve or record a launch. Use Day planner or Record launch for a launch.'):itUI('Cancel this reservation and release its booked storage dates.')}</p><form>${arriving||departing?`<label>${itUI("Actual")} ${arriving?'arrival':'departure'} ${itUI("date")}<input name="actualDate" type="date" max="${esc(model.stayToday)}" required></label>`:''}${!arriving?`<label>${itUI("Reason / destination")}<textarea name="reason" maxlength="500" required></textarea></label>`:''}<button>${label}</button></form>`);
  sheet.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);mutate({action,stayId:s.id,actualArrivalDate:arriving?f.get('actualDate'):'',actualDepartureDate:departing?f.get('actualDate'):'',reason:f.get('reason')||''});};
 });
 };draw();
}
