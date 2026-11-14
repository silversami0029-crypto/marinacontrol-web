import {berthPlanLabelKey,matchBerthPlan} from '../util/BerthPlanMatching.js?v=small-labels';
import { italianUI as itUI } from '../i18n.js';
import {installBerthMapHelp} from '../util/BerthMapHelp.js';
import {showBerthSizeTools} from '../util/BerthSizeTools.js';
import {showArrangePier,pierGroups} from '../util/ArrangePier.js';
import {mapEditorConfirmation,rotateMapPlan} from '../util/MapEditorTools.js';
import {store} from '../store.js';
import {berthSlots,defaultBerthLayout,simpleBerthGrid} from '../components/BerthMapGeometry.js';
import {mountLayoutCanvas,reconcileBerthLayout} from '../components/BerthLayoutCanvas.js?v=berth-review';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function showBerthMapEditor({records,planSlots,planUrl,dialog,call,onPublished}){
 const clientId=Number(store.activeClientId),uid=store.authUser?.uid;let dirty=false,busy=false,pending=null;
 const sheet=dialog(itUI('Edit berth layout'),`<p role="status" class="ys-status ys-saving-feedback"><span class="spinner-ring" aria-hidden="true"></span>${itUI("Loading layout…")}</p>`,{beforeClose:()=>{if(!dirty&&!busy)return true;if(busy)return false;ask({title:'Discard layout changes?',message:'Your unsaved layout changes will be lost.',confirmText:'Discard changes',cancelText:'Keep editing'}).then(discard=>{if(discard){dirty=false;sheet.querySelector('[data-close]').click();}});return false;}});sheet.classList.add('be-editor');installBerthMapHelp(sheet);
 const active=()=>sheet.isConnected&&Number(store.activeClientId)===clientId&&store.authUser?.uid===uid;
 const ask=mapEditorConfirmation(sheet,active);
 const body=sheet.querySelector('.ys-sheet-body');let state;
 try{state=await call('getBerthMapLayout',{});if(!active())return;if(!state.canEdit)throw Error('An admin or manager of an active marina can edit this map.');}catch(e){if(active())body.textContent=e.message||itUI('Could not load map editor.');return;}
 if(state.truncated||!state.berths.length){body.textContent=itUI('This editor supports 1–1,000 berth records per marina. Add berths before positioning them.');return;}
 const projected=new Map(records.map(b=>[b._docId,b]));
 const slots=berthSlots(state.berths.map(b=>({...b,...projected.get(b._docId),_docId:b._docId,berthNumber:b.berthNumber,dockName:b.dockName}))).map(s=>({...s,record:projected.get(s.id)||null}));
 const existing=async()=>{const value=defaultBerthLayout(state.berths,planSlots);try{const response=await fetch(planUrl);if(!response.ok)throw Error('Plan unavailable');const bitmap=await createImageBitmap(await response.blob()),canvas=document.createElement('canvas');canvas.width=800;canvas.height=850;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,800,850);ctx.drawImage(bitmap,24,5,724,776);bitmap.close();value.background=canvas.toDataURL('image/jpeg',.65);}catch{}return value;};
 const initial=state.draft||state.published||await existing();if(!active())return;
 const canonicalSlots=berthSlots(state.berths),groups=pierGroups(canonicalSlots);
 let groupReference='', blockSelected=false, blockSelectionArmed=false, planMeasurementArmed=false, rowFit=null;
 let groupIds=[],groupMove=true,arrangePreferences=null,groupLast=null;
 let layout=reconcileBerthLayout(initial,slots),selected='',preview=false,snap=true,controller,camera={},saved=JSON.stringify(layout),history=[saved],historyIndex=0;
 let unmatched=new Set(),placementId='';
 const reviewHistory=[[]];
 body.innerHTML=`<div class="be-toolbar"><p><strong>${state.draft?itUI('Saved draft'):state.published?itUI('Published layout'):itUI('Existing berth plan')}</strong> · ${slots.length} ${itUI("berths")}</p><button type="button" data-undo aria-label="${itUI("Undo layout change")}">${itUI("Undo")}</button><button type="button" data-in>+</button><button type="button" data-out>−</button><button type="button" data-fit>${itUI("Reset view")}</button><button type="button" data-preview>${itUI("Preview")}</button><details><summary aria-label="${itUI("Layout options")}"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></summary><div><button type="button" data-auto-place>${itUI("Upload and match berth labels")}</button><button type="button" data-background>${itUI("Upload plan")}</button><button type="button" data-rotate-left>${itUI("Rotate plan left")}</button><button type="button" data-rotate-right>${itUI("Rotate plan right")}</button><button type="button" data-arrange-pier>${itUI("Arrange a pier")}</button><button type="button" data-add-label>${itUI("Add label")}</button><button type="button" data-map-settings>${itUI("Canvas settings")}</button><button type="button" data-previous ${state.previous?'':'disabled'}>${itUI("Use previous layout")}</button><button type="button" data-default>${itUI("Use simple grid")}</button><button type="button" data-remove-background ${layout.background?'':'hidden'}>${itUI("Remove plan")}</button></div></details></div><div class="be-pier-controls"><label>${itUI("Select pier")}<select data-select-pier aria-label="${itUI("Select pier")}"><option value="">${itUI("Individual berths")}</option>${groups.map(g=>`<option value="${esc(g.key)}">${esc(g.label)} · ${g.slots.length}</option>`).join('')}</select></label><span data-pier-count role="status"></span><button type="button" data-select-block aria-pressed="false">${itUI("Select block")}</button><button type="button" data-align-pier disabled>${itUI("Align pier")}</button><button type="button" data-pier-done hidden>${itUI("Done")}</button></div><input class="be-background-input" type="file" accept="image/jpeg,image/png,image/webp"><p data-preview-note hidden>${itUI("Preview only · bookings, assignments and selected-date colours are unchanged.")}</p><div class="be-main"><div class="be-canvas-frame"><div class="be-canvas"></div></div><div class="be-properties"></div></div><div class="be-footer"><p data-save-state class="ys-status" role="status">${itUI("Drag berths into position. Their IDs stay unchanged.")}</p><button type="button" data-save>${itUI("Save draft")}</button><button type="button" data-publish hidden>${itUI("Publish layout")}</button></div>`;
 const props=body.querySelector('.be-properties'),status=body.querySelector('[data-save-state]');
 if(!document.querySelector('[data-pier-select-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../../css/pier-selection.css',import.meta.url).href;link.setAttribute('data-pier-select-css','');document.head.append(link);}
 function setStatus(t,error=false){if(!active())return;status.textContent=t;status.classList.toggle('ys-error',error);status.classList.toggle('ys-saving-feedback',busy);}
 function record(){const s=JSON.stringify(layout);if(s!==history[historyIndex]||JSON.stringify([...unmatched])!==JSON.stringify(reviewHistory[historyIndex])){history=history.slice(0,historyIndex+1);history.push(s);reviewHistory.splice(historyIndex+1,Infinity,[...unmatched]);if(history.length>25){history.shift();reviewHistory.shift();}historyIndex=history.length-1;}dirty=s!==saved;setStatus(dirty?itUI('Unsaved layout changes'):itUI('Draft saved'));body.querySelector('[data-undo]').disabled=historyIndex===0;}
 function target(){return layout.items.find(i=>i.id===selected)||layout.labels.find(l=>'label:'+l.id===selected);}
 const canvasFrame=body.querySelector('.be-canvas-frame');
 function draw(){if(!active())return;
 const reviewing=unmatched.size>0;
 canvasFrame.parentElement.classList.toggle('be-review-layout',reviewing);
 body.querySelector('.be-toolbar details').hidden=preview||reviewing;
 for(const selector of ['[data-save]','[data-preview]'])body.querySelector(selector).disabled=reviewing||busy||!!pending;
canvasFrame.style.setProperty('--be-plan-ratio',layout.width/layout.height);const anchor=target();groupLast=anchor?{x:anchor.x,y:anchor.y}:null;syncPierControls();body.querySelector('[data-remove-background]').hidden=!layout.background;controller=mountLayoutCanvas(body.querySelector('.be-canvas'),{layout,slots,cameraState:camera,editing:!preview,hiddenBerths:unmatched,onPlaceBerth:placementId&&!planMeasurementArmed?placeBerth:undefined,selected,snap,onBlockSelect:selectBlock,isBlockSelectionArmed:()=>blockSelectionArmed,onMeasurePlan:placementId||(!blockSelected&&planMeasurementArmed)?placeMeasuredBerth:measurePlanBox,onSelect:id=>{selected=id;if(!groupIds.includes(id))clearPier();syncPierControls();paintPier();const i=target();groupLast=i?{x:i.x,y:i.y}:null;properties();},onMove:()=>{const i=target();if(i&&groupMove&&groupIds.includes(selected)&&groupLast){let dx=i.x-groupLast.x,dy=i.y-groupLast.y;const rest=layout.items.filter(t=>groupIds.includes(t.id)&&t.id!==selected);dx=Math.max(Math.max(...rest.map(t=>-t.x),-Infinity),Math.min(dx,Math.min(...rest.map(t=>layout.width-t.width-t.x),Infinity)));dy=Math.max(Math.max(...rest.map(t=>-t.y),-Infinity),Math.min(dy,Math.min(...rest.map(t=>layout.height-t.height-t.y),Infinity)));i.x=groupLast.x+dx;i.y=groupLast.y+dy;for(const t of rest){t.x+=dx;t.y+=dy;}groupLast={x:i.x,y:i.y};paintPier();}if(i)for(const k of ['x','y']){const input=props.querySelector(`[name=${k}]`);if(input)input.value=Math.round(i[k]);}},onMoveEnd:()=>{record();if(groupIds.includes(selected))draw();},onOpen:s=>setStatus('Preview · '+s.label)});controller.setPlanMeasurement(planMeasurementArmed);paintPier();properties();}
 function placeMeasuredBerth({x,y,width,height}){
   planMeasurementArmed=false;
   if(width<8||height<8||width>1000||height>1000||x<0||y<0||
       x+width>layout.backgroundWidth||y+height>layout.backgroundHeight){
     draw();
     setStatus(itUI('Draw a box inside the printed berth. Zoom in for a closer view.'),true);
     return;
   }
   if(placementId){
     placeBerth({x:x+width/2,y:y+height/2},{width,height,rotation:0});
     return;
   }
   const item=layout.items.find(entry=>entry.id===selected);
   if(!item||busy||pending||preview)return;
   Object.assign(item,{x,y,width,height,rotation:0});
   record();
   draw();
   setStatus(itUI('Berth fitted to the printed box.'));

 }
 function placeBerth({x,y},size){
   if(busy||pending||x<0||y<0||x>layout.backgroundWidth||y>layout.backgroundHeight)return;
   const item=layout.items.find(entry=>entry.id===placementId);
   if(!item)return;
   if(size)Object.assign(item,size);
   item.x=Math.max(0,Math.min(layout.width-item.width,x-item.width/2));
   item.y=Math.max(0,Math.min(layout.height-item.height,y-item.height/2));
   const placedLabel=slots.find(slot=>slot.id===placementId)?.label||placementId;
   unmatched.delete(placementId);
   placementId=unmatched.values().next().value||'';
   record();
   draw();
   setStatus(placedLabel+' '+itUI('placed')+' · '+(unmatched.size?unmatched.size+' '+itUI('berths left to place'):itUI('All berths placed. Preview or save draft.')));
 }
 function properties(){
 if(unmatched.size){
   props.innerHTML=`<section class="be-pier-card"><strong>${itUI('Review unmatched berths')} · ${unmatched.size}</strong><label>${itUI('Berth to place')}<select data-place-berth>${slots.filter(s=>unmatched.has(s.id)).map(s=>`<option value="${esc(s.id)}" ${s.id===placementId?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label><button type="button" data-fit-berth aria-pressed="${planMeasurementArmed}">${itUI(planMeasurementArmed?'Cancel box':'Fit to printed box')}</button><p>${itUI(planMeasurementArmed?'Drag from one corner of the printed berth to the opposite corner.':'Click the printed berth to place it, or fit its size by drawing a box. The next berth is selected automatically.')}</p></section>`;
   const select=props.querySelector('[data-place-berth]');
   select.disabled=busy||!!pending;
   select.onchange=()=>{placementId=select.value;};
   const fit=props.querySelector('[data-fit-berth]');
   fit.disabled=busy||!!pending;
   fit.onclick=()=>{planMeasurementArmed=!planMeasurementArmed;draw();};
   return;
 }

 if(preview){props.innerHTML=`<p>${itUI("Preview")}</p><p class="ys-note">${itUI("Check labels, positions and zoom before publishing. Select Back to editing to make changes.")}</p>`;return;}
 if(blockSelected){blockProperties();return;}
 const activeGroup=currentPier();if(activeGroup&&groupMove){
 const ref=canonicalSlots.find(s=>s.id===groupReference)||activeGroup.slots[0];groupReference=ref.id;
 props.innerHTML=`<section class="be-pier-card"><strong>${esc(activeGroup.label)}</strong><p>${groupIds.length} ${itUI("berths selected. Drag any highlighted berth to move them together.")}</p><label>${itUI("Reference berth")}<select data-pier-reference>${activeGroup.slots.map(s=>`<option value="${esc(s.id)}" ${s.id===groupReference?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label><button type="button" data-pier-card-align>${itUI("Align pier")}</button><button type="button" data-pier-card-size>${itUI("Apply reference size…")}</button><button type="button" data-pier-edit-one>${itUI("Edit reference berth")}</button><p>${itUI("Align uses this berth as the fixed reference. Undo reverses each move or alignment.")}</p></section>`;
 props.querySelector('[data-pier-reference]').onchange=e=>{groupReference=e.target.value;selected=groupReference;const i=target();groupLast={x:i.x,y:i.y};draw();};
 props.querySelector('[data-pier-card-align]').onclick=arrange;
 props.querySelector('[data-pier-card-size]').onclick=()=>copySize(groupReference);
 props.querySelector('[data-pier-edit-one]').onclick=()=>{selected=groupReference;clearPier();draw();};return;
 }
 const i=target();if(!i){props.innerHTML=`<p>${itUI("Select a berth or label")}</p><p class="ys-note">${itUI("Drag to move. Use arrow keys for small adjustments. Choose Select block to select several berths.")}</p><label class="ys-inline-label"><input data-snap type="checkbox" ${snap?'checked':''}>${itUI("Snap to grid")}</label><label>${itUI("Find berth")}<select data-find><option value="">${itUI("Choose berth")}</option>${slots.map(s=>`<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select></label>`;props.querySelector('[data-snap]').onchange=e=>{snap=e.target.checked;draw();};props.querySelector('[data-find]').onchange=e=>{if(!e.target.value)return;selected=e.target.value;draw();controller.focus(selected);};return;}
 const label=!layout.items.some(i=>i.id===selected);props.innerHTML=`<p><strong>${esc(label?itUI('Map label'):slots.find(s=>s.id===selected)?.label||selected)}</strong></p>${label?`<label>${itUI("Text")}<input name="text" maxlength="80" value="${esc(i.text)}"></label>`:`<p class="ys-note">${itUI("Display position only")}</p>`}<div class="be-pair">${(label?['x','y','size','rotation']:['x','y','width','height','rotation']).map(k=>`<label>${({x:'Across',y:'Down',size:'Text size',rotation:'Rotation',width:'Width',height:'Height'})[k]}<input name="${k}" type="number" step="1" value="${Math.round(i[k]||0)}"></label>`).join('')}</div>${label?`<button type="button" data-remove-label>${itUI("Remove label")}</button>`:''}${label?'':`${layout.background?`<button type="button" data-fit-selected aria-pressed="${planMeasurementArmed}">${itUI(planMeasurementArmed?'Cancel box':'Fit to printed box')}</button>`:''}<button type="button" data-copy-size>${itUI("Apply size to…")}</button>`}<button type="button" data-deselect>${itUI("Done")}</button>`;
 if(!label&&groupIds.includes(selected)){const panel=document.createElement('div');panel.innerHTML=`<label class="ys-inline-label"><input data-move-pier type="checkbox" ${groupMove?'checked':''}>${itUI("Drag this pier together (")}${groupIds.length} ${itUI("berths)")}</label><button type="button" data-adjust-pier>${itUI("Adjust pier spacing / size")}</button>`;props.prepend(panel);panel.querySelector('[data-move-pier]').onchange=e=>{groupMove=e.target.checked;};panel.querySelector('[data-adjust-pier]').onclick=arrange;}
 props.querySelectorAll('input[name]').forEach(input=>input.onchange=()=>{const k=input.name;if(k==='text')i[k]=input.value;else{const value=Number(input.value);if(!Number.isFinite(value))return;const limits={x:[0,layout.width-(i.width||0)],y:[0,layout.height-(i.height||0)],size:[12,120],rotation:[-360,360],width:[8,Math.min(1000,layout.width-i.x)],height:[8,Math.min(1000,layout.height-i.y)]};i[k]=Math.max(limits[k][0],Math.min(limits[k][1],value));}record();draw();});
 props.querySelector('[data-fit-selected]')?.addEventListener('click',()=>{
   clearPier();
   planMeasurementArmed=props.querySelector('[data-fit-selected]').getAttribute('aria-pressed')!=='true';
   draw();
   if(planMeasurementArmed)setStatus(itUI('Drag from one corner of the printed berth to the opposite corner.'));
 });
 props.querySelector('[data-copy-size]')?.addEventListener('click',()=>copySize(selected));
 props.querySelector('[data-remove-label]')?.addEventListener('click',()=>{layout.labels=layout.labels.filter(l=>'label:'+l.id!==selected);selected='';record();draw();});props.querySelector('[data-deselect]').onclick=()=>{selected='';draw();};
 }
 function selectBlock(ids){
   clearPier();
   groupIds=ids;
   blockSelected=ids.length>0;
   groupMove=true;
   selected=ids[0]||'';
   draw();
   setStatus(ids.length
     ? ids.length+' '+itUI('berths selected. Drag any highlighted berth to move the block.')
     : itUI('No berths selected. Choose Select block and draw around the marker centres.'));
 }
 function blockProperties(){
   const reference=target();
   const members=layout.items.filter(item=>groupIds.includes(item.id));
   const row=layout.background?numberedRow(members):null;
   props.innerHTML=`<section class="be-pier-card">
     <strong>${members.length} ${itUI('berths selected')}</strong>
     <p>${itUI('Drag any highlighted berth to move the block.')}</p>
     <div class="be-pair">
       <label>${itUI('Width')}<input name="width" type="number" min="8" max="1000" value="${Math.round(reference.width)}"></label>
       <label>${itUI('Height')}<input name="height" type="number" min="8" max="1000" value="${Math.round(reference.height)}"></label>
     </div>
     <p>${itUI('Width and height apply to every selected berth.')}</p>
     ${layout.background?`<button type="button" data-match-plan-size aria-pressed="${planMeasurementArmed}">${itUI(planMeasurementArmed&&!rowFit?'Cancel measurement':'Match size on plan')}</button>`:''}
     ${row?`<button type="button" data-fit-row aria-pressed="${!!rowFit}">${itUI(rowFit?'Cancel row fit':'Fit row to plan')}</button>`:''}
     ${rowFit?`<p role="status">${esc(rowFitInstruction())}</p>`:''}
     <label>${itUI('Rotate block (degrees)')}<input name="blockRotation" type="number" min="-360" max="360" value="0"></label>
     <button type="button" data-rotate-block>${itUI('Rotate block')}</button>
     <button type="button" data-block-done>${itUI('Done')}</button>
   </section>`;
   for(const dimension of ['width','height']){
     const input=props.querySelector(`[name=${dimension}]`);
     input.onchange=()=>{
       const size=input.valueAsNumber;
       if(!Number.isFinite(size)||size<8||size>1000){properties();setStatus(itUI('Enter a size between 8 and 1,000.'),true);return;}
       const axis=dimension==='width'?'x':'y';
       applyBlock(members,members.map(item=>({...item,[axis]:item[axis]+(item[dimension]-size)/2,[dimension]:size})));
     };
   }
   const matchButton=props.querySelector('[data-match-plan-size]');
   if(matchButton)matchButton.onclick=()=>{
     if(busy||pending)return;
     setBlockSelectionArmed(false);
     const wasMeasuringSize=planMeasurementArmed&&!rowFit;
     rowFit=null;
     planMeasurementArmed=!wasMeasuringSize;
     controller.setPlanMeasurement(planMeasurementArmed);
     properties();
     setStatus(itUI(planMeasurementArmed
       ? 'Drag from one corner of a grey berth box to the opposite corner.'
       : 'Measurement cancelled.'));
   };
   const fitButton=props.querySelector('[data-fit-row]');
   if(fitButton)fitButton.onclick=()=>{
     if(busy||pending)return;
     setBlockSelectionArmed(false);
     rowFit=rowFit?null:{row,first:null};
     planMeasurementArmed=!!rowFit;
     controller.setPlanMeasurement(planMeasurementArmed);
     properties();
     setStatus(rowFit?rowFitInstruction():itUI('Row fit cancelled.'));
   };
   props.querySelector('[data-rotate-block]').onclick=()=>{
     const degrees=props.querySelector('[name=blockRotation]').valueAsNumber;
     if(!Number.isFinite(degrees)||Math.abs(degrees)>360){setStatus(itUI('Enter an angle between −360 and 360 degrees.'),true);return;}
     if(degrees%360===0)return;
     const x=(Math.min(...members.map(i=>i.x))+Math.max(...members.map(i=>i.x+i.width)))/2;
     const y=(Math.min(...members.map(i=>i.y))+Math.max(...members.map(i=>i.y+i.height)))/2;
     const angle=degrees*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
     applyBlock(members,members.map(item=>{
       const dx=item.x+item.width/2-x,dy=item.y+item.height/2-y;
       return {...item,x:x+dx*cos-dy*sin-item.width/2,y:y+dx*sin+dy*cos-item.height/2,
         rotation:((item.rotation||0)+degrees)%360};
     }));
   };
   props.querySelector('[data-block-done]').onclick=()=>{clearPier();draw();};
 }
 function numberedRow(members){
   if(members.length<2)return null;
   const row=members.map(item=>{
     const label=slots.find(slot=>slot.id===item.id)?.label||'';
     const match=label.match(/^(.+?)([0-9]+)$/);
     return {item,label,prefix:match?.[1],number:Number(match?.[2])};
   }).sort((a,b)=>a.number-b.number);
   return row.every((entry,index)=>entry.prefix&&entry.prefix===row[0].prefix&&
     (index===0||entry.number>row[index-1].number))?row:null;
 }
 function rowFitInstruction(){
   const {row,first}=rowFit;
   const label=first?row.at(-1).label:row[0].label;
   return itUI('Drag across the grey box for')+' '+label+' '+itUI('from corner to corner.');
 }
 function measurePlanBox(box){
   if(!rowFit){matchPlanSize(box);return;}
   if(!blockSelected||busy||pending||preview)return;
   if(box.width<8||box.height<8||box.width>1000||box.height>1000){
     controller.setPlanMeasurement(true);
     setStatus(rowFitInstruction(),true);return;
   }
   if(!rowFit.first){
     rowFit.first=box;
     controller.setPlanMeasurement(true);
     properties();setStatus(rowFitInstruction());return;
   }
   const {row,first}=rowFit;
   const dx=box.x+box.width/2-first.x-first.width/2;
   const dy=box.y+box.height/2-first.y-first.height/2;
   if(Math.abs(dx)<(first.width+box.width)/2&&Math.abs(dy)<(first.height+box.height)/2){
     controller.setPlanMeasurement(true);
     setStatus(itUI('Trace a different grey box for the last berth.'),true);return;
   }
   const range=row.at(-1).number-row[0].number;
   const next=row.map(({item,number})=>{
     const fraction=(number-row[0].number)/range;
     const width=first.width+(box.width-first.width)*fraction;
     const height=first.height+(box.height-first.height)*fraction;
     return {...item,width,height,rotation:0,
       x:first.x+first.width/2+dx*fraction-width/2,
       y:first.y+first.height/2+dy*fraction-height/2};
   });
   applyBlock(row.map(entry=>entry.item),next);
 }
 function matchPlanSize({width,height}){
   planMeasurementArmed=false;
   if(!blockSelected||busy||pending||preview)return;
   const members=layout.items.filter(item=>groupIds.includes(item.id));
   if(width<8||height<8||width>1000||height>1000){
     properties();setStatus(itUI('Trace one grey berth box from corner to corner.'),true);return;
   }
   if(members.some(item=>Math.abs((item.rotation||0)/90-Math.round((item.rotation||0)/90))>1e-6)){
     properties();setStatus(itUI('Match size on plan works with horizontal or vertical markers. Adjust the block rotation first.'),true);return;
   }
   applyBlock(members,members.map(item=>{
     const quarterTurn=Math.abs(Math.round((item.rotation||0)/90))%2===1;
     const w=quarterTurn?height:width,h=quarterTurn?width:height;
     return {...item,width:w,height:h,x:item.x+(item.width-w)/2,y:item.y+(item.height-h)/2};
   }));
 }
 function applyBlock(members,next){
   rowFit=null;planMeasurementArmed=false;controller.setPlanMeasurement(false);
   const epsilon=1e-8;
   if(next.some(item=>item.x < -epsilon||item.y < -epsilon||
       item.x+item.width > layout.width+epsilon||item.y+item.height > layout.height+epsilon)){
     properties();setStatus(itUI('Move the block away from the map edge before resizing or rotating it.'),true);return;
   }
   next.forEach((item,index)=>Object.assign(members[index],item,{
     x:Math.max(0,Math.min(layout.width-item.width,item.x)),
     y:Math.max(0,Math.min(layout.height-item.height,item.y))
   }));
   record();draw();
 }
 function currentPier(){if(blockSelected)return;return groups.find(g=>g.slots.length===groupIds.length&&g.slots.every(s=>groupIds.includes(s.id)));}
 function syncPierControls(){const group=currentPier();body.querySelector('.be-pier-controls').hidden=preview||unmatched.size>0;body.querySelector('[data-select-pier]').value=group?.key||'';body.querySelector('[data-pier-count]').textContent=groupIds.length?groupIds.length+' selected':'';body.querySelector('[data-align-pier]').disabled=!group||busy||!!pending;body.querySelector('[data-pier-done]').hidden=!group;}
 const blockButton=body.querySelector('[data-select-block]');
 blockButton.onclick=()=>{
   if(busy||pending||preview)return;
   setBlockSelectionArmed(!blockSelectionArmed);
   setStatus(blockSelectionArmed
     ? itUI('Drag a box around the berth markers you want to select, then release the mouse.')
     : itUI('Block selection cancelled.'));
 };
 function setBlockSelectionArmed(armed){
   blockSelectionArmed=armed;
   if(armed&&planMeasurementArmed){rowFit=null;planMeasurementArmed=false;controller.setPlanMeasurement(false);properties();}
   blockButton.setAttribute('aria-pressed',String(armed));
   blockButton.textContent=itUI(armed?'Cancel selection':'Select block');
 }
 function clearPier(){rowFit=null;planMeasurementArmed=false;controller?.setPlanMeasurement(false);setBlockSelectionArmed(false);blockSelected=false;groupIds=[];groupReference='';groupLast=null;syncPierControls();}
 function paintPier(){const chosen=new Set(!preview&&groupMove?groupIds:[]),items=new Map(layout.items.map(i=>[i.id,i]));for(const n of body.querySelectorAll('.be-canvas [data-layout-id]')){const id=n.getAttribute('data-layout-id'),yes=chosen.has(id);n.classList.toggle('be-pier-selected',yes);if(n.tagName.toLowerCase()==='g'){n.setAttribute('aria-pressed',String(yes));const r=n.querySelector('rect');r?.setAttribute('stroke',yes?'#fff':r.getAttribute('fill'));r?.setAttribute('stroke-width',yes||id===selected?5:2);if(yes){const i=items.get(id);n.setAttribute('transform',`translate(${i.x+i.width/2} ${i.y+i.height/2}) rotate(${i.rotation||0}) translate(${-i.width/2} ${-i.height/2})`);}}}}
 function copySize(id){if(busy||pending)return;showBerthSizeTools({root:props,layout,slots:canonicalSlots,sourceId:id,onCancel:properties,onApply:(next,count)=>{layout=next;clearPier();record();draw();setStatus(itUI('Size applied to ')+count+' berth'+(count===1?'':'s')+itUI(' · positions unchanged. Undo reverses this change.'));}});}
 body.querySelector('[data-select-pier]').onchange=e=>{if(busy||pending)return;rowFit=null;planMeasurementArmed=false;setBlockSelectionArmed(false);const group=groups.find(g=>g.key===e.target.value);if(!group){clearPier();draw();return;}blockSelected=false;groupIds=group.slots.map(s=>s.id);groupMove=true;groupReference=groupIds.includes(selected)?selected:group.slots[0].id;selected=groupReference;const i=target();groupLast={x:i.x,y:i.y};draw();setStatus(groupIds.length+itUI(' berths selected · drag any highlighted berth, then Align pier.'));};
 body.querySelector('[data-align-pier]').onclick=arrange;
 body.querySelector('[data-pier-done]').onclick=()=>{clearPier();draw();setStatus(itUI('Individual berth editing'));};
 function lock(value){busy=value;const blocked=value||!!pending;body.querySelector('.be-canvas').inert=blocked;body.querySelector('.be-canvas').style.pointerEvents=blocked?'none':'';body.querySelectorAll('button,input,select,summary').forEach(n=>{if(n.tagName==='SUMMARY'){n.style.pointerEvents=blocked?'none':'';return;}n.disabled=blocked;});if(!blocked){for(const selector of ['[data-save]','[data-preview]'])body.querySelector(selector).disabled=unmatched.size>0;syncPierControls();body.querySelector('[data-previous]').disabled=!state.previous;body.querySelector('[data-undo]').disabled=historyIndex===0;}}
 async function save(action){if(!active()||busy||unmatched.size)return;try{if(!pending)pending={action,revision:state.revision,commandId:crypto.randomUUID(),layout:structuredClone(layout)};lock(true);setStatus(pending.action==='PUBLISH'?itUI('Publishing layout…'):itUI('Saving draft…'));const result=await call('changeBerthMapLayout',pending);if(!active())return;state.revision=result.revision;saved=JSON.stringify(layout);dirty=false;const published=pending.action==='PUBLISH';pending=null;lock(false);body.querySelector('[data-save]').textContent=itUI('Save draft');setStatus(published?itUI('Layout published'):itUI('Draft saved · operational map is unchanged'));if(published){sheet.querySelector('[data-close]').click();onPublished();}}
 catch(e){if(!active())return;const uncertain=!e.code||/unavailable|deadline|internal|unknown|network/.test(e.code);if(!uncertain)pending=null;lock(false);if(pending){body.querySelectorAll('button,input,select').forEach(n=>n.disabled=true);body.querySelector('[data-save]').disabled=false;body.querySelector('[data-save]').textContent=itUI('Retry save');}setStatus((e.message||itUI('Save failed.'))+(pending?itUI(' Retry uses the same request.'):''),true);}}
 function arrange(){if(preview||busy||pending)return;body.querySelector('.be-toolbar details').open=false;showArrangePier({root:props,layout,slots:canonicalSlots,selected:groupIds.includes(groupReference)?groupReference:selected,previous:arrangePreferences,onCancel:properties,onApply:(next,ids,id,preferences)=>{layout=next;rowFit=null;planMeasurementArmed=false;blockSelected=false;groupIds=ids;groupMove=true;groupReference=id;selected=id;arrangePreferences=preferences;const i=target();groupLast={x:i.x,y:i.y};record();draw();setStatus(itUI('Pier aligned · drag it together, or choose Done to edit individual berths.'));}});}
 body.querySelector('[data-arrange-pier]').onclick=arrange;
 body.querySelector('[data-save]').onclick=()=>save('SAVE_DRAFT');body.querySelector('[data-publish]').onclick=()=>save('PUBLISH');
 body.querySelector('[data-preview]').onclick=()=>{rowFit=null;planMeasurementArmed=false;setBlockSelectionArmed(false);preview=!preview;body.querySelector('[data-preview]').textContent=preview?itUI('Back to editing'):itUI('Preview');body.querySelector('[data-preview-note]').hidden=!preview;body.querySelector('[data-publish]').hidden=!preview;body.querySelector('details').hidden=preview;camera={};draw();};
 body.querySelector('[data-in]').onclick=()=>controller?.zoomIn();body.querySelector('[data-out]').onclick=()=>controller?.zoomOut();body.querySelector('[data-fit]').onclick=()=>controller?.reset();
 body.querySelector('[data-undo]').onclick=()=>{if(historyIndex===0)return;historyIndex--;clearPier();layout=JSON.parse(history[historyIndex]);unmatched=new Set(reviewHistory[historyIndex]);placementId=unmatched.values().next().value||'';dirty=JSON.stringify(layout)!==saved;selected='';draw();setStatus(dirty?itUI('Unsaved layout changes'):itUI('Draft saved'));body.querySelector('[data-undo]').disabled=historyIndex===0;};
 body.querySelector('[data-add-label]').onclick=()=>{if(layout.labels.length>=50){setStatus(itUI('Use up to 50 labels.'),true);return;}const l={id:crypto.randomUUID(),text:'New label',x:layout.width/2,y:layout.height/2,size:26,rotation:0};layout.labels.push(l);clearPier();selected='label:'+l.id;record();draw();body.querySelector('details').open=false;};
 body.querySelector('[data-default]').onclick=async()=>{if(!await ask({title:'Replace draft layout?',message:"Replace this draft with a simple grid? Publish only when ready.",confirmText:'Replace draft',cancelText:'Keep editing',action:'restore'}))return;layout=simpleBerthGrid(state.berths);clearPier();selected='';camera={};record();draw();};
 body.querySelector('[data-previous]').onclick=()=>{if(!state.previous)return;layout=reconcileBerthLayout(state.previous,slots);clearPier();selected='';camera={};record();draw();setStatus(itUI('Previous layout loaded as an unsaved draft. Preview before publishing.'));};
 body.querySelector('[data-map-settings]').onclick=()=>{props.innerHTML=`<p><strong>${itUI("Canvas settings")}</strong></p><div class="be-pair"><label>${itUI("Width")}<input name="canvasWidth" type="number" min="200" max="20000" value="${layout.width}"></label><label>${itUI("Height")}<input name="canvasHeight" type="number" min="200" max="20000" value="${layout.height}"></label></div><button type="button" data-apply-canvas>${itUI("Apply")}</button>`;props.querySelector('[data-apply-canvas]').onclick=()=>{const w=Number(props.querySelector('[name=canvasWidth]').value),h=Number(props.querySelector('[name=canvasHeight]').value);if(!Number.isFinite(w)||!Number.isFinite(h)||w<200||h<200||w>20000||h>20000){setStatus(itUI('Canvas sizes must be between 200 and 20,000.'),true);return;}resize(w,h);record();draw();};body.querySelector('details').open=false;};
 function resize(w,h){const sx=w/layout.width,sy=h/layout.height;for(const i of layout.items){i.width=Math.max(8,Math.min(1000,i.width*sx));i.height=Math.max(8,Math.min(1000,i.height*sy));i.x=Math.max(0,Math.min(w-i.width,i.x*sx));i.y=Math.max(0,Math.min(h-i.height,i.y*sy));}for(const l of layout.labels){l.x=Math.min(w,l.x*sx);l.y=Math.min(h,l.y*sy);}layout.width=w;layout.height=h;if(layout.background){layout.backgroundWidth=Math.min(w,(layout.backgroundWidth||w/sx)*sx);layout.backgroundHeight=Math.min(h,(layout.backgroundHeight||h/sy)*sy);}camera={};}
 const file=body.querySelector('[type=file]');
 let scanOnUpload=false;
 body.querySelector('[data-background]').onclick=()=>{scanOnUpload=false;file.click();};
 body.querySelector('[data-auto-place]').onclick=()=>{scanOnUpload=true;file.click();};

 function beginReview(matchedIds){
   unmatched=new Set(slots.filter(slot=>!matchedIds.has(slot.id)).map(slot=>slot.id));
   placementId=unmatched.values().next().value||'';
   body.querySelector('.be-toolbar details').open=false;
   clearPier();selected='';camera={};record();draw();
 }
 async function autoPlace(bitmap){
   setStatus(itUI('Reading berth labels…'));
   const {width,height}=bitmap;
   async function scanRegion(x,y,w,h,scale){
     const scan=document.createElement('canvas');
     scan.width=Math.max(1,Math.round(w*scale));
     scan.height=Math.max(1,Math.round(h*scale));
     const context=scan.getContext('2d');
     context.fillStyle='#fff';
     context.fillRect(0,0,scan.width,scan.height);
     context.drawImage(bitmap,x,y,w,h,0,0,scan.width,scan.height);
     const imageBase64=scan.toDataURL('image/jpeg',.92).split(',')[1];
     if(imageBase64.length>8_000_000)throw Error(itUI("Choose a smaller plan image for scanning."));
     const {labels}=await call('scanBerthPlan',{imageBase64});
     return labels.map(label=>({...label,x:x+label.x*w/scan.width,y:y+label.y*h/scan.height}));
   }
   const labels=await scanRegion(0,0,width,height,Math.min(1,4096/Math.max(width,height)));
   if(!active())return;
   const {matches,review}=matchBerthPlan(state.berths,labels,width,height);
   const missing=new Set(review.filter(entry=>entry.reason==='not found').map(entry=>entry.name));
   if(missing.size){
     setStatus(itUI('Reading small berth labels…'));
     const remaining=state.berths.filter(berth=>missing.has(berthPlanLabelKey(berth.berthNumber)));
     const candidates=[];
     const w=Math.ceil(width*.56),h=Math.ceil(height*.56);
     for(const y of [0,height-h]){
       for(const x of [0,width-w]){
         try{
           const hits=await scanRegion(x,y,w,h,Math.min(4,4096/Math.max(w,h)));
           if(!active())return;
           const prior=candidates.slice();
           for(const hit of hits){
             const name=berthPlanLabelKey(hit.text);
             if(!missing.has(name))continue;
             // Overlapping crops can report the same physical label twice.
             if(prior.some(p=>p.name===name&&Math.abs(p.x-hit.x)<width*.003&&Math.abs(p.y-hit.y)<height*.003))continue;
             candidates.push({...hit,name});
           }
         }catch(error){
           console.warn('[berth plan] Section scan failed',error);
           break;
         }
       }
       if(!active())return;
     }
     const retry=matchBerthPlan(remaining,candidates,width,height);
     matches.push(...retry.matches);
     review.splice(0,review.length,...review.filter(entry=>!missing.has(entry.name)),...retry.review);
   }
   const items=new Map(layout.items.map(item=>[item.id,item]));
   for(const match of matches){
     const item=items.get(match.id);
     if(!item)continue;
     item.x=Math.max(0,Math.min(layout.width-item.width,match.x*layout.backgroundWidth-item.width/2));
     item.y=Math.max(0,Math.min(layout.height-item.height,match.y*layout.backgroundHeight-item.height/2));
   }
   beginReview(new Set(matches.map(match=>match.id)));
   setStatus(itUI('Berths placed')+' '+matches.length+' · '+itUI('Labels to review')+' '+unmatched.size);
 }

 file.onchange=async()=>{const f=file.files[0];if(!f)return;let bitmap;try{if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>15*1024*1024)throw Error('Choose a PNG, JPEG or WebP image under 15 MB.');lock(true);setStatus('Preparing background image…');bitmap=await createImageBitmap(f);if(bitmap.width>20000||bitmap.height>20000)throw Error('Image dimensions are too large.');const budget=Math.min(136000,210000-JSON.stringify({...layout,background:''}).length);if(budget<10000)throw Error('This layout is too large for a background image.');let width=Math.min(1600,bitmap.width),url='';const canvas=document.createElement('canvas');while(width>=200){canvas.width=Math.round(width);canvas.height=Math.max(1,Math.round(width*bitmap.height/bitmap.width));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);url=canvas.toDataURL('image/jpeg',.65);if(url.length<=budget)break;width*=.75;}if(url.length>budget)throw Error('Choose a simpler or smaller background image.');if(!active())return;const h=Math.max(200,Math.min(20000,Math.round(3200*bitmap.height/bitmap.width)));resize(3200,h);layout.background=url;layout.backgroundWidth=layout.width;layout.backgroundHeight=layout.height;if(!scanOnUpload){record();draw();setStatus(itUI('Plan added to draft. Drag berths into position.'));}
 if(scanOnUpload){
   try{await autoPlace(bitmap);}catch(error){
     if(active()){beginReview(new Set());setStatus(itUI('Automatic matching failed. Place berths on the plan manually.'),true);}
   }
 }
 }catch(e){if(active())setStatus(e.message||itUI('Could not prepare image.'),true);}finally{bitmap?.close();if(active())lock(false);file.value='';}};
 body.querySelector('[data-remove-background]')?.addEventListener('click',()=>{layout.background='';record();draw();});

 for(const [selector,direction]of [['[data-rotate-left]',-1],['[data-rotate-right]',1]])body.querySelector(selector).onclick=async()=>{if(busy||pending)return;lock(true);setStatus(itUI('Rotating plan…'));body.querySelector('details').open=false;try{const rotated=await rotateMapPlan(layout,direction);if(!active())return;layout=rotated;clearPier();selected='';camera={};record();draw();setStatus(itUI('Plan rotated · save draft or preview and publish.'));}catch(e){if(active())setStatus(e.message||itUI('Could not rotate plan.'),true);}finally{if(active())lock(false);}};
 draw();body.querySelector('[data-undo]').disabled=true;
}
