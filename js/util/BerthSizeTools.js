import {pierGroups} from './ArrangePier.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function copyBerthSize(layout,sourceId,targetIds,includeRotation=false){
 const source=layout.items.find(i=>i.id===sourceId),ids=new Set(targetIds),known=new Set(layout.items.map(i=>i.id));
 if(!source||!ids.size||[...ids].some(id=>!known.has(id)))throw Error('Choose existing berths to receive this size.');
 if(!Number.isFinite(source.width)||!Number.isFinite(source.height)||source.width<8||source.height<8||source.width>1000||source.height>1000)throw Error('Set a valid width and height on the template berth first.');
 if(includeRotation&&(!Number.isFinite(source.rotation)||Math.abs(source.rotation)>360))throw Error('Set a valid template rotation.');
 const next=structuredClone(layout);
 for(const item of next.items){if(!ids.has(item.id))continue;if(item.x+source.width>layout.width||item.y+source.height>layout.height)throw Error('This size would extend a selected berth outside the canvas. No sizes changed.');item.width=source.width;item.height=source.height;if(includeRotation)item.rotation=source.rotation;}
 return next;
}
export function showBerthSizeTools({root,layout,slots,sourceId,onApply,onCancel}){
 const source=layout.items.find(i=>i.id===sourceId),slot=slots.find(s=>s.id===sourceId);if(!source||!slot)return;
 if(!document.querySelector('[data-berth-size-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../../css/berth-size-tools.css',import.meta.url).href;link.setAttribute('data-berth-size-css','');document.head.append(link);}
 const group=pierGroups(slots).find(g=>g.slots.some(s=>s.id===sourceId)),pierIds=group.slots.map(s=>s.id),chosen=new Set(pierIds),sorted=[...slots].sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
 root.innerHTML=`<section class="be-size-panel" aria-label="Apply berth size"><header><strong>Apply size from ${esc(slot.label)}</strong><span>${Math.round(source.width)} × ${Math.round(source.height)} · positions stay unchanged</span></header><div class="be-size-fields"><label>Apply to<select data-size-scope><option value="pier">All ${pierIds.length} berths on this pier</option><option value="selected">Choose berths…</option></select></label><p class="be-size-note">${esc(group.label)}</p><div data-size-choices hidden><label>Find berth<input data-size-search type="search" placeholder="Name or pier" autocomplete="off"></label><div class="be-size-pick-actions"><button type="button" data-size-select-all>Select shown</button><button type="button" data-size-clear>Clear</button></div><div class="be-size-list" role="group" aria-label="Choose destination berths">${sorted.map(s=>`<label data-size-row data-search="${esc((s.label+' '+(s.record?.dockName||'')+' '+s.zone).toLowerCase())}"><input type="checkbox" data-size-id="${esc(s.id)}" ${chosen.has(s.id)?'checked':''}><span>${esc(s.label)}${s.id===sourceId?' (template)':''}</span></label>`).join('')}</div></div><label class="be-size-check"><input type="checkbox" data-size-rotation>Also copy rotation (${Math.round(source.rotation||0)}°)</label></div><footer><p data-size-count role="status"></p><p data-size-error class="ys-error" role="alert"></p><button type="button" data-size-apply>Apply size</button><button type="button" data-size-cancel>Cancel</button></footer></section>`;
 const scope=root.querySelector('[data-size-scope]'),choices=root.querySelector('[data-size-choices]'),count=root.querySelector('[data-size-count]'),apply=root.querySelector('[data-size-apply]'),error=root.querySelector('[data-size-error]');
 const ids=()=>scope.value==='pier'?pierIds:[...chosen];
 const update=()=>{const n=ids().length;count.textContent=n+' berth'+(n===1?'':'s')+' selected';apply.disabled=n===0;error.textContent='';};
 scope.onchange=()=>{choices.hidden=scope.value!=='selected';update();};
 root.querySelectorAll('[data-size-id]').forEach(n=>n.onchange=()=>{n.checked?chosen.add(n.dataset.sizeId):chosen.delete(n.dataset.sizeId);update();});
 root.querySelector('[data-size-search]').oninput=e=>{const q=e.target.value.trim().toLowerCase();root.querySelectorAll('[data-size-row]').forEach(n=>n.hidden=!n.dataset.search.includes(q));};
 root.querySelector('[data-size-select-all]').onclick=()=>{root.querySelectorAll('[data-size-row]:not([hidden]) [data-size-id]').forEach(n=>{n.checked=true;chosen.add(n.dataset.sizeId);});update();};
 root.querySelector('[data-size-clear]').onclick=()=>{chosen.clear();root.querySelectorAll('[data-size-id]').forEach(n=>n.checked=false);update();};
 root.querySelector('[data-size-cancel]').onclick=onCancel;
 apply.onclick=()=>{try{const selected=ids(),next=copyBerthSize(layout,sourceId,selected,root.querySelector('[data-size-rotation]').checked);onApply(next,selected.length);}catch(e){error.textContent=e.message;}};
 update();
}
