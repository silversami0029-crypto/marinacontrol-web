import {renderYardDayPlanner,showYardJobDialog} from './YardDayPlanner.js';
import {store} from '../store.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {app} from '../firebase.js';
import {getLocale,t} from '../i18n.js';
import {yardSlots,mountYardStorageMap,mountYardStorageList} from '../components/YardStorageMap.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));



const ar={'Yard Storage':'التخزين البري','Virtual yard':'ساحة افتراضية','Refresh':'تحديث','Configure yard':'إعداد الساحة','Map':'الخريطة','List':'القائمة','Launch schedule':'جدول الإنزال','All zones':'كل المناطق','Search boats or spaces':'البحث عن القوارب أو الأماكن','All statuses':'كل الحالات','Available':'متاح','Assigned':'مخصص','Unavailable':'غير متاح','Ready to launch':'جاهز للإنزال','Work / review needed':'يتطلب عملاً أو مراجعة','Loading…':'جارٍ التحميل…','Close':'إغلاق','Save':'حفظ','Boat':'القارب','No boat assigned':'لم يتم تخصيص قارب','Planned haul-out date':'تاريخ الرفع المخطط','Planned launch date':'تاريخ الإنزال المخطط','Notes':'ملاحظات','Launch blockers':'عوائق الإنزال','Maintenance':'الصيانة','Move boat':'نقل القارب','Release space':'إخلاء المكان','Confirm ready':'تأكيد الجاهزية','Record launch':'تسجيل الإنزال','Cancel':'إلغاء','No matches':'لا توجد نتائج','No yard configured yet.':'لم يتم إعداد ساحة بعد.','Destination':'الوجهة','Make available':'جعله متاحاً','Mark unavailable':'جعله غير متاح','Back':'رجوع','Zoom in':'تكبير','Zoom out':'تصغير','Reset view':'إعادة ضبط العرض','Zone':'المنطقة'};
const L=s=>getLocale().startsWith('ar')?(ar[s]||t(s)):t(s);
let dispose=null;
export function unmountYardStorageScreen(){dispose?.();dispose=null;}
export function mountYardStorageScreen(){
  unmountYardStorageScreen();
  const href=new URL('../../css/yard-storage.css',import.meta.url).href;
  if(![...document.querySelectorAll('link')].some(x=>x.href===href)){const css=document.createElement('link');css.rel='stylesheet';css.href=href;document.head.append(css);}
  const screen=document.getElementById('screen');screen.innerHTML='<section class="ys-screen"></section>';
  const root=screen.firstElementChild,clientId=Number(store.activeClientId),uid=store.authUser?.uid;
  let dead=false,model=null,busy=false,message='',error=false,zone='',search='',filter='',mode='map',size=112,modalClose=null,pending=null;
  const active=()=>!dead&&root.isConnected&&Number(store.activeClientId)===clientId&&store.authUser?.uid===uid;
  const cameraState={};let mapController=null,plannerDay='';
  const fetchModel=async()=>{const result=await call('getYardStorage',{day:plannerDay});if(active()&&result.plannerDay)plannerDay=result.plannerDay;return result;};
  const functions=getFunctions(app,'us-central1');
  const call=(name,data)=>httpsCallable(functions,name)({clientId,...data}).then(r=>r.data);
  const writer=()=>model?.writable&&['admin','manager','staff','inspector'].includes(store.activeRole);
  const manager=()=>model?.writable&&['admin','manager'].includes(store.activeRole);
  const date=s=>s?new Intl.DateTimeFormat(getLocale(),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z')):'—';
  async function load(){if(busy||!active())return;busy=true;message=L('Loading…');error=false;render();try{const data=await fetchModel();if(!active())return;model=data;message='';}catch(e){if(!active())return;message=e.message||'Could not load yard.';error=true;}finally{busy=false;if(active())render();}}
  async function mutate(args,command=null){
    if(busy||!active())return;
    const payload=command||{...args,revision:model.yard.revision,commandId:crypto.randomUUID()};
    pending=payload;busy=true;message=L('Loading…');error=false;modalClose?.();render();
    try{await call('changeYardStorage',payload);if(!active())return;pending=null;if(payload.action==='SCHEDULE_JOB')plannerDay=payload.day;const data=await fetchModel();if(active()){model=data;message='Saved.';}}
    catch(e){if(!active())return;message=e.message||'Save failed. Refresh before making another change.';error=true;
      if(['functions/aborted','functions/failed-precondition','functions/permission-denied','functions/invalid-argument','functions/not-found','functions/already-exists','functions/resource-exhausted'].includes(e.code))pending=null;
    }finally{busy=false;if(active())render();}
  }
  function status(space){if(!space?.boatDocId)return space?.unavailable?'unavailable':'available';if(model.maintenanceTruncated||space.blockers||(model.unfinished[String(space.boatId)]||0)>0)return 'blocked';return space.readyAt?'ready':'occupied';}
  function visibleSlots(){return yardSlots(model.yard.zones).filter(slot=>{
    const s=model.yard.spaces[slot.id];return(!zone||slot.zone===zone)&&(!filter||status(s)===filter)&&(`${slot.label} ${slot.id} ${s?.boatName||''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  });}
  function render(){if(!active())return;if(zone&&model&&!model.yard.zones.some(z=>z.id===zone))zone='';const yard=model?.yard,slots=yard?yardSlots(yard.zones):[],occupied=slots.filter(s=>yard.spaces[s.id]?.boatDocId).length,unavailable=slots.filter(s=>yard.spaces[s.id]?.unavailable).length;
    root.innerHTML=`<div class="c360-header"><div class="c360-header-row"><button class="mt-icon-btn" data-back
        aria-label="${esc(L('Back'))}"
        style="border:0;background:transparent;padding:0;width:44px;display:grid;place-items:center;">
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
</button><div class="c360-pill">${esc(L('Yard Storage'))}</div>
<div class="c360-spacer"></div>
<button type="button" class="ys-icon" data-help aria-label="Yard Storage help"
        style="border:0;background:transparent;box-shadow:none;padding:0;width:44px;height:44px;display:grid;place-items:center;">
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
       stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 11v6M12 7v1"/>
  </svg>
</button>
<button data-refresh ${busy?'disabled':''}>${esc(L('Refresh'))}</button>${manager()?`<button data-config ${busy||pending?'disabled':''}>${esc(L('Configure yard'))}</button>`:''}</div></div>
    <p class="ys-status ${error?'ys-error':''}" role="status">${esc(message)}</p>
    ${pending&&!busy?'<div class="ys-notice">The save result is uncertain. Retry the same request safely, or refresh to inspect the yard.<button data-retry>Retry same request</button></div>':''}
    ${!model?'':`<div class="ys-summary"><strong>${esc(L('Virtual yard'))}</strong><span>${slots.length} spaces · ${occupied} assigned · ${slots.length-occupied-unavailable} available · ${unavailable} unavailable</span></div>
    <p class="ys-note">Numbered storage spaces, not a surveyed yard layout. Yard assignments do not change wet-berth bookings. Refresh to see other users’ changes.</p>
    ${!model.writable?'<p class="ys-notice">This marina is unavailable for changes. Yard records are read-only.</p>':''}
    ${model.boatsTruncated||model.maintenanceTruncated?'<p class="ys-notice">Some records exceed the loading limit. Boat selection may be incomplete; launch readiness is blocked if maintenance is incomplete.</p>':''}
    ${!yard.zones.length?`<div class="ys-empty">${esc(L('No yard configured yet.'))}${manager()?`<button data-create>${esc(L('Configure yard'))}</button>`:' Ask a marina administrator or manager to configure the yard.'}</div>`:`
    <div class="ys-controls"><button data-mode="list" aria-pressed="${mode==='list'}">${esc(L('List'))}</button><button data-mode="map" aria-pressed="${mode==='map'}">${esc(L('Map'))}</button><button data-mode="planner" aria-pressed="${mode==='planner'}">Day planner</button><button data-mode="schedule" aria-pressed="${mode==='schedule'}">${esc(L('Launch schedule'))}</button>
    <select data-zone aria-label="${esc(L('Zone'))}"><option value="">${esc(L('All zones'))}</option>${yard.zones.map(z=>`<option ${zone===z.id?'selected':''} value="${esc(z.id)}">${esc(z.id)} (${z.capacity})</option>`).join('')}</select>
    <select data-filter aria-label="Status"><option value="">${esc(L('All statuses'))}</option>${[['available','Available'],['occupied','Assigned'],['blocked','Work / review needed'],['ready','Ready to launch'],['unavailable','Unavailable']].map(([v,l])=>`<option value="${v}" ${filter===v?'selected':''}>${esc(L(l))}</option>`).join('')}</select>
    <input data-search type="search" placeholder="${esc(L('Search boats or spaces'))}" value="${esc(search)}"></div>
    <div class="ys-legend"><span class="available">● ${esc(L('Available'))}</span><span class="occupied">● ${esc(L('Assigned'))}</span><span class="blocked">● ${esc(L('Work / review needed'))}</span><span class="ready">● ${esc(L('Ready to launch'))}</span><span class="unavailable">● ${esc(L('Unavailable'))}</span></div>
    ${['map','list'].includes(mode)?`<div class="ys-controls"><button data-zoom="1" aria-label="${esc(L('Zoom in'))}">+</button><button data-zoom="-1" aria-label="${esc(L('Zoom out'))}">−</button><button data-reset>${esc(L('Reset view'))}</button></div>${mode==='map'?'<p class="ys-note">Virtual arrangement · drag to pan · use +/− or pinch to zoom · select a space to open it. Filter a zone for a closer view. Lanes are illustrative.</p><div class="ys-map-host"></div>':`<div class="ys-grid" style="--ys-cell:${size}px"></div>`}`:mode==='planner'?'<div class="ys-day-planner"></div>':'<div class="ys-schedule"></div>'}`}`}`;
    root.querySelector('[data-back]').onclick=()=>{location.hash='#/home';};
    root.querySelector('[data-help]').onclick = showYardHelp;
    root.querySelector('[data-refresh]').onclick=()=>{modalClose?.();load();};
    root.querySelector('[data-retry]')?.addEventListener('click',()=>mutate({},pending));
    root.querySelectorAll('[data-config],[data-create]').forEach(b=>b.onclick=configureDialog);
    root.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;render();});
    root.querySelector('[data-zone]')?.addEventListener('change',e=>{zone=e.target.value;render();});
    root.querySelector('[data-filter]')?.addEventListener('change',e=>{filter=e.target.value;render();});
    root.querySelector('[data-search]')?.addEventListener('input',e=>{search=e.target.value;drawContent();});
    root.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{if(mode==='map'){Number(b.dataset.zoom)>0?mapController?.zoomIn():mapController?.zoomOut();return;}size=Math.max(84,Math.min(220,size+Number(b.dataset.zoom)*24));root.querySelector('.ys-grid').style.setProperty('--ys-cell',`${size}px`);});
    root.querySelector('[data-reset]')?.addEventListener('click',()=>{if(mode==='map'){mapController?.reset();return;}size=112;render();});
    if(model?.events?.length){const details=document.createElement('details');details.className='ys-history';const summary=document.createElement('summary');summary.textContent='Recent yard activity (latest 20)';details.append(summary);for(const event of model.events){const row=document.createElement('p');row.textContent=`${new Intl.DateTimeFormat(getLocale(),{dateStyle:'short',timeStyle:'short'}).format(event.recordedAt)} · ${event.action} · ${event.slot||'Yard'} ${event.target?'→ '+event.target:''} · ${event.boatName||''}`;details.append(row);}root.append(details);}
    drawContent();root.querySelectorAll('button,input,select').forEach(el=>{if(busy)el.disabled=true;});
  }
  function drawContent(){if(!model?.yard.zones.length)return;const slots=visibleSlots();
    const grid=root.querySelector('.ys-grid');if(grid){mountYardStorageList(grid,{slots,spaces:model.yard.spaces,boats:model.boats,unfinished:model.unfinished,unknown:model.maintenanceTruncated,onOpen:openSpace,L});if(!slots.length)grid.textContent=L('No matches');}
    const map=root.querySelector('.ys-map-host,.ys-map-viewport');if(map){mapController=mountYardStorageMap(map,{zones:model.yard.zones,slots,spaces:model.yard.spaces,boats:model.boats,unfinished:model.unfinished,unknown:model.maintenanceTruncated,onOpen:openSpace,L,cameraState,zone});}
    const board=root.querySelector('.ys-day-planner');if(board){
      root.querySelectorAll('[data-zone],[data-filter],[data-search],.ys-legend').forEach(el=>el.style.display='none');
      if(model.plannerVersion!==1)board.innerHTML='<p class="ys-notice">Deploy the updated getYardStorage and changeYardStorage functions to enable the Day planner.</p>';
      else renderYardDayPlanner(board,{model,manager:manager()&&!pending,writer:writer()&&!pending,day:plannerDay,onDay:value=>{plannerDay=value;load();},dialog,mutate,onBook:job=>showYardJobDialog({model,day:plannerDay,dialog,mutate,job})});
    }
    const list=root.querySelector('.ys-schedule');if(list){const assigned=slots.filter(s=>model.yard.spaces[s.id]?.boatDocId).sort((a,b)=>(model.yard.spaces[a.id].launchDate||'9999').localeCompare(model.yard.spaces[b.id].launchDate||'9999')||a.id.localeCompare(b.id));list.innerHTML=assigned.map(s=>{const p=model.yard.spaces[s.id];return `<button class="ys-launch" data-slot="${esc(s.id)}"><strong>${esc(s.label)} · ${esc(p.boatName)}</strong><span>${esc(date(p.launchDate))}</span><span>${esc(L(status(p)==='ready'?'Ready to launch':status(p)==='blocked'?'Work / review needed':'Assigned'))}</span></button>`;}).join('')||`<p>${esc(L('No matches'))}</p>`;list.querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>openSpace(slots.find(s=>s.id===b.dataset.slot)));}
  }
  function dialog(title,body){modalClose?.();const previous=document.activeElement,backdrop=document.createElement('div'),sheet=document.createElement('div');backdrop.className='sheet-backdrop is-open';sheet.className='sheet ys-sheet is-open';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label',title);sheet.innerHTML=`<div class="ys-sheet-header"><h2>${esc(title)}</h2><button type="button" data-close aria-label="${esc(L('Close'))}">×</button></div><div class="ys-sheet-body">${body}</div>`;document.getElementById('modalRoot').append(backdrop,sheet);
    const close=()=>{document.removeEventListener('keydown',key);sheet.remove();backdrop.remove();modalClose=null;if(previous?.isConnected)previous.focus();};
    const key=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const nodes=[...sheet.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&!x.hidden);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
    sheet.querySelector('[data-close]').onclick=close;backdrop.onclick=close;document.addEventListener('keydown',key);modalClose=close;sheet.querySelector('[data-close]').focus();return sheet;
  }
function showYardHelp() {
  dialog('Yard Storage help', `
    <div class="help-scroll">
      <div class="help-pill">Yard Storage & Day planner</div>

      <p class="help-desc">
        Track boat locations, plan haul-outs and launches,
        and coordinate staff and equipment.
      </p>

      <div class="help-section-title">Here’s the workflow</div>

      <div class="help-step">
        <div class="help-step-num">1</div>
        <div class="help-step-text">
          <b>Set up the planner once</b><br>
          Open <b>Day planner → Planner settings & equipment</b>.
          Set the marina’s timezone and add your hoist, crane or trailer.
          Staff are selected from <b>Crew</b>.
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">2</div>
        <div class="help-step-text">
          <b>Assign a boat to a yard space</b><br>
          Use the yard map or list—for example,
          boat “Shore Sami” in <b>A1</b>.
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">3</div>
        <div class="help-step-text">
          <b>Book a haul-out or launch</b><br>
          Choose the boat, date, start/end time, equipment and staff.<br>
          Example: <b>Haul-out · 09:00–09:30 · Hoist 1 · Ahmed and John.</b>
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">4</div>
        <div class="help-step-text">
          <b>The planner checks for clashes</b><br>
          It rejects overlapping bookings involving the same boat,
          equipment or staff. Different teams and equipment can
          work simultaneously.
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">5</div>
        <div class="help-step-text">
          <b>Start and complete the operation</b><br>
          During the booked time, staff can press <b>Start</b>.
          An admin or manager confirms <b>Complete</b>
          after the physical work finishes.
          <p><b>Haul-out completed:</b>
          the boat remains assigned to its yard space.</p>
          <p><b>Launch completed:</b>
          its yard space becomes available.</p>
        </div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">Launch readiness</div>
      <p>
        A launch cannot start while the boat has launch blockers,
        unfinished maintenance, or hasn’t been marked ready.
      </p>

      <div class="help-section-title">Interrupted work</div>
      <p>
        Use <b>Stop</b> and give a reason.
        This records the interruption and adds a blocker
        without claiming the operation finished.
      </p>
    </div>
  `);
}

  function configureDialog(){if(!manager()||pending)return;const sheet=dialog(L('Configure yard'),`<p>Enter one zone per line: code, number of spaces. Example: A,150 then B,150 then C,150 creates 450 spaces. Maximum 1000 spaces across 20 zones. Space IDs remain stable when capacity grows.</p><form><label>Zones<textarea name="zones" rows="5" required>${esc(model.yard.zones.map(z=>`${z.id},${z.capacity}`).join('\n')||'A,150\nB,150\nC,150')}</textarea></label><p>Occupied spaces and spaces with notes cannot be removed. This changes yard capacity, not existing boat records.</p><p class="ys-form-error" role="alert"></p><button>${esc(L('Save'))}</button></form>`);
    sheet.querySelector('form').onsubmit=e=>{e.preventDefault();const rows=new FormData(e.target).get('zones').trim().split(/\n/).map(line=>line.split(',').map(s=>s.trim()));if(rows.some(row=>row.length!==2||!/^\d+$/.test(row[1]))){sheet.querySelector('.ys-form-error').textContent='Use one zone per line: A,150';return;}mutate({action:'CONFIGURE',zones:rows.map(([id,capacity])=>({id:id.toUpperCase(),capacity:Number(capacity)}))});};
  }
  function confirmAction(title,description,args){const sheet=dialog(title,`<p>${esc(description)}</p><button data-confirm>${esc(title)}</button>`);sheet.querySelector('[data-confirm]').onclick=()=>mutate(args);}
  function openSpace(slot){if(!active()||busy)return;const space=model.yard.spaces[slot.id]||{},occupied=!!space.boatDocId,canWrite=writer()&&!pending;
    const tasks=model.unfinished[String(space.boatId)]||0,known=model.boats.some(b=>b.docId===space.boatDocId),eligible=occupied&&known&&!!space.launchDate&&!space.blockers&&!tasks&&!model.maintenanceTruncated;
    const boats=model.boats.filter(b=>b.docId===space.boatDocId||!Object.values(model.yard.spaces).some(s=>s.boatDocId===b.docId));
    const sheet=dialog(`${L('Yard Storage')} · ${slot.label}`,`<form class="ys-form"><label>${esc(L('Boat'))}<select name="boatDocId" ${!canWrite||occupied||space.unavailable?'disabled':''}><option value="">${esc(L('No boat assigned'))}</option>${occupied&&!known?`<option selected value="${esc(space.boatDocId)}">${esc(space.boatName)} — record needs review</option>`:''}${boats.map(b=>`<option value="${esc(b.docId)}" ${b.docId===space.boatDocId?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
    <label>${esc(L('Planned haul-out date'))}<input name="haulDate" type="date" min="2000-01-01" max="2100-12-31" value="${esc(space.haulDate)}" ${!canWrite?'disabled':''}></label>
    <label>${esc(L('Planned launch date'))}<input name="launchDate" type="date" min="2000-01-01" max="2100-12-31" value="${esc(space.launchDate)}" ${!canWrite?'disabled':''}></label>
    <label>${esc(L('Notes'))}<textarea name="notes" maxlength="500" ${!canWrite?'disabled':''}>${esc(space.notes)}</textarea></label>
    <label>${esc(L('Launch blockers'))}<textarea name="blockers" maxlength="500" ${!canWrite?'disabled':''}>${esc(space.blockers)}</textarea></label>
    ${canWrite&&occupied&&known?'<button type="button" data-add-yard-maintenance>Add maintenance</button>':''}
    ${occupied?`<p>${model.maintenanceTruncated?'Maintenance review is incomplete.':`${tasks} unfinished maintenance task(s), including unfinished archived tasks.`}</p><a href="#/maintenance?boatId=${Number(space.boatId)}">${esc(L('Maintenance'))}</a><p>A manager confirms readiness after reviewing preparation and outstanding work. Save edits before confirming readiness. Recording launch clears the yard space and keeps an audit record.</p>`:''}
    ${canWrite?`<button>${esc(L('Save'))}</button>`:''}</form>
    <div class="ys-actions">${canWrite&&!occupied?`<button data-availability>${esc(L(space.unavailable?'Make available':'Mark unavailable'))}</button>`:''}
    ${manager()&&occupied&&!pending&&model.plannerVersion===1?'<button data-plan>Book yard operation</button>':''}
    ${canWrite&&occupied?`<button data-move>${esc(L('Move boat'))}</button><button data-release>${esc(L('Release space'))}</button>`:''}
    ${manager()&&occupied&&!pending?`<button data-ready ${!eligible?'disabled':''}>${esc(L('Confirm ready'))}</button><button data-launch ${!eligible||!space.readyAt?'disabled':''}>${esc(L('Record launch'))}</button>`:''}</div>`);
    sheet.querySelector('form').addEventListener('input',()=>sheet.querySelectorAll('[data-ready],[data-launch]').forEach(b=>{b.disabled=true;}));
    sheet.querySelector('form').onsubmit=e=>{e.preventDefault();if(!canWrite)return;const form=new FormData(e.target);mutate({action:'SAVE',slot:slot.id,boatDocId:occupied?space.boatDocId:String(form.get('boatDocId')||''),haulDate:String(form.get('haulDate')||''),launchDate:String(form.get('launchDate')||''),notes:String(form.get('notes')||''),blockers:String(form.get('blockers')||'')});};
    sheet.querySelector('[data-availability]')?.addEventListener('click',()=>mutate({action:'AVAILABILITY',slot:slot.id,unavailable:!space.unavailable}));
    sheet.querySelector('[data-release]')?.addEventListener('click',()=>confirmAction(L('Release space'),`Release ${space.boatName} from ${slot.label}? This records a release, not a launch.`,{action:'RELEASE',slot:slot.id}));
    sheet.querySelector('[data-ready]')?.addEventListener('click',()=>confirmAction(L('Confirm ready'),`Confirm that ${space.boatName} has been reviewed and is ready for its planned launch? The server will recheck unfinished maintenance.`,{action:'READY',slot:slot.id}));
    sheet.querySelector('[data-launch]')?.addEventListener('click',()=>confirmAction(L('Record launch'),`Confirm ${space.boatName} has actually been launched? This frees ${slot.label}; it does not assign a wet berth or operate lifting equipment.`,{action:'LAUNCH',slot:slot.id}));
    sheet.querySelector('[data-add-yard-maintenance]')?.addEventListener('click',async()=>{
      if(!active()||busy||!writer()||pending)return;
      modalClose?.();
      try {
        const {showAddMaintenanceSheet}=await import('./AddMaintenanceSheet.js');
        if(!active()||!writer())return;
        const closeAdd=await showAddMaintenanceSheet({
          boatId:space.boatId,yardSpaceId:slot.id,yardSpaceLabel:slot.label,
          canSave:()=>active()&&writer()&&!pending,
          onSaved:async()=>{await load();if(active()&&!error&&model.yard.spaces[slot.id]?.boatDocId===space.boatDocId)openSpace(slot);}
        });
        if(active()){if(typeof closeAdd==='function')modalClose=closeAdd;}
        else closeAdd?.();
      } catch(e){if(active())dialog('Unable to open maintenance',`<p>${esc(e.message||'Please refresh and try again.')}</p>`);}
    });
    sheet.querySelector('[data-plan]')?.addEventListener('click',()=>showYardJobDialog({model,day:plannerDay,dialog,mutate,slotId:slot.id}));
    sheet.querySelector('[data-move]')?.addEventListener('click',()=>{const targets=yardSlots(model.yard.zones).filter(s=>s.id!==slot.id&&!model.yard.spaces[s.id]?.boatDocId&&!model.yard.spaces[s.id]?.unavailable&&!model.yard.spaces[s.id]?.notes);const move=dialog(L('Move boat'),`<form><label>${esc(L('Destination'))}<select name="target" required>${targets.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select></label><p>Moves preserve dates and work links; readiness must be confirmed again.</p><button ${!targets.length?'disabled':''}>${esc(L('Move boat'))}</button></form>`);move.querySelector('form').onsubmit=e=>{e.preventDefault();mutate({action:'MOVE',slot:slot.id,target:new FormData(e.target).get('target')});};});
  }
  const clear=store.subscribe(()=>{if(!active())unmountYardStorageScreen();});
  dispose=()=>{dead=true;modalClose?.();clear();};
  load();
}
