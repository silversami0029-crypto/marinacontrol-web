import {mountLayoutCanvas,reconcileYardLayout} from './YardLayoutCanvas.js';
// A virtual layout: stable space IDs are independent of their display position.
export function yardSlots(zones) {
  return zones.flatMap(zone => Array.from({length:zone.capacity},(_,i)=>({id:`${zone.id}-${i+1}`,zone:zone.id,label:`${zone.id}${i+1}`})));
}
export function mountYardStorageList(root,{slots,spaces,boats,unfinished,unknown,onOpen,L}) {
  root.replaceChildren();
  const byBoat=new Map(boats.map(b=>[b.docId,b]));
  for(const slot of slots){
    const space=spaces[slot.id], boat=space?.boatDocId && byBoat.get(space.boatDocId);
    const occupied=!!space?.boatDocId, blocked=occupied && (!!space.blockers || unknown || (unfinished[String(space.boatId)]||0)>0);
    const state=occupied?(blocked?'blocked':space.readyAt?'ready':'occupied'):space?.unavailable?'unavailable':'available';
    const button=document.createElement('button');button.type='button';button.className=`ys-space ys-${state}`;
    const title=document.createElement('strong');title.textContent=slot.label;
    const name=document.createElement('span');name.textContent=occupied?(boat?.name||space.boatName):L(space?.unavailable?'Unavailable':'Available');
    const status=document.createElement('small');status.textContent=L({blocked:'Work / review needed',ready:'Ready to launch',occupied:'Assigned',unavailable:'Unavailable',available:'Available'}[state]);
    button.append(title,name,status);button.setAttribute('aria-label',`${slot.label}: ${name.textContent}; ${status.textContent}`);
    button.onclick=()=>onOpen(slot);root.append(button);
  }
}

const NS='http://www.w3.org/2000/svg';
const colours={available:'#39ba7b',occupied:'#4b91ef',blocked:'#d7a347',ready:'#aa82ef',unavailable:'#718092'};
function svgNode(tag,attrs={},text){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el;}
/** Display coordinates only: assignment keys remain zone-number and never depend on position. */
export function virtualYardLayout(zones){
  const columns=Math.min(3,zones.length),width=columns*1060+40,items=[],blocks=[];let rowY=100;
  for(let start=0;start<zones.length;start+=columns){
    const batch=zones.slice(start,start+columns),heights=batch.map(z=>Math.ceil(z.capacity/10)*58+190);
    batch.forEach((zone,index)=>{
      const x=30+index*1060,y=rowY,rows=Math.ceil(zone.capacity/10),height=rows*58+140;
      blocks.push({id:zone.id,x,y,width:1020,height,capacity:zone.capacity});
      for(let i=0;i<zone.capacity;i++){
        const col=i%10,row=Math.floor(i/10);
        items.push({id:`${zone.id}-${i+1}`,label:`${zone.id}${i+1}`,zone:zone.id,
          x:x+24+col*90+(col>=5?76:0),y:y+65+row*58,width:80,height:46});
      }
    });
    rowY+=Math.max(...heights);
  }
  return {width,height:rowY+60,items,blocks};
}
export function mountYardStorageMap(root,{zones,slots,spaces,boats,unfinished,unknown,onOpen,L,cameraState,zone='',publishedLayout=null}){
  if(publishedLayout)return mountLayoutCanvas(root,{layout:reconcileYardLayout(publishedLayout,yardSlots(zones)),slots,spaces,boats,unfinished,unknown,onOpen,L,cameraState,zone});
  root.replaceChildren();root.className='ys-map-viewport';root.tabIndex=0;root.setAttribute('aria-label','Virtual yard map. Use zoom controls, drag to pan, and select a numbered space.');
  const layout=virtualYardLayout(zones),shown=new Set(slots.map(s=>s.id)),byBoat=new Map(boats.map(b=>[b.docId,b]));
  const selected=zone?layout.blocks.filter(b=>b.id===zone):layout.blocks;
  const minX=Math.min(...selected.map(b=>b.x))-20,minY=Math.min(...selected.map(b=>b.y))-55;
  const maxX=Math.max(...selected.map(b=>b.x+b.width))+20,maxY=Math.max(...selected.map(b=>b.y+b.height))+65;
  const base={x:minX,y:minY,w:maxX-minX,h:maxY-minY};
  const key=JSON.stringify([zones,zone]);if(cameraState.key!==key){cameraState.key=key;cameraState.view={...base};}
  let view=cameraState.view;
  const svg=svgNode('svg',{viewBox:`${view.x} ${view.y} ${view.w} ${view.h}`,preserveAspectRatio:'xMidYMid meet',role:'group','aria-label':L('Virtual yard')});
  svg.append(svgNode('rect',{x:0,y:0,width:layout.width,height:layout.height,fill:'#121a20'}));
  for(const block of layout.blocks){
    if(zone&&block.id!==zone)continue;
    const group=svgNode('g',{'aria-hidden':'true'});
    group.append(svgNode('rect',{x:block.x,y:block.y,width:block.width,height:block.height,rx:16,fill:'#1c2831',stroke:'#405260','stroke-width':3}));
    group.append(svgNode('text',{x:block.x+24,y:block.y+36,fill:'#e8eef5','font-size':24,'font-weight':700},`${L('Zone')} ${block.id} · ${block.capacity}`));
    group.append(svgNode('rect',{x:block.x+474,y:block.y+56,width:72,height:block.height-74,fill:'#303b44',rx:5}));
    group.append(svgNode('line',{x1:block.x+510,y1:block.y+65,x2:block.x+510,y2:block.y+block.height-24,stroke:'#6c7982','stroke-width':2,'stroke-dasharray':'12 12'}));
    group.append(svgNode('text',{x:block.x+510,y:block.y+block.height+29,'text-anchor':'middle',fill:'#aab8c4','font-size':18},'ACCESS LANE'));
    svg.append(group);
  }
  for(const slot of layout.items){
    if(zone&&slot.zone!==zone)continue;
    const space=spaces[slot.id],boat=space?.boatDocId&&byBoat.get(space.boatDocId),occupied=!!space?.boatDocId;
    const blocked=occupied&&(space.blockers||unknown||(unfinished[String(space.boatId)]||0)>0);
    const state=occupied?(blocked?'blocked':space.readyAt?'ready':'occupied'):space?.unavailable?'unavailable':'available';
    const matches=shown.has(slot.id),name=occupied?(boat?.name||space.boatName):L(space?.unavailable?'Unavailable':'Available');
    const label=`${slot.label}: ${name}; ${L({blocked:'Work / review needed',ready:'Ready to launch',occupied:'Assigned',unavailable:'Unavailable',available:'Available'}[state])}`;
    const node=svgNode('g',{'data-space-id':slot.id,class:'ys-map-space',role:'button',tabindex:matches?'0':'-1','aria-label':label,'aria-disabled':!matches,opacity:matches?1:.12});
    node.append(svgNode('title',{},label));
    node.append(svgNode('rect',{x:slot.x,y:slot.y,width:slot.width,height:slot.height,rx:6,fill:colours[state],'fill-opacity':.18,stroke:colours[state],'stroke-width':2}));
    node.append(svgNode('text',{x:slot.x+slot.width/2,y:slot.y+29,'text-anchor':'middle',fill:'#f5f7f9','font-size':19,'font-weight':700,'pointer-events':'none'},slot.label));
    node.addEventListener('keydown',e=>{if(matches&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onOpen(slot);}});
    node.addEventListener('focus',()=>{if(slot.x<view.x||slot.y<view.y||slot.x+slot.width>view.x+view.w||slot.y+slot.height>view.y+view.h){view={...view,x:slot.x+slot.width/2-view.w/2,y:slot.y+slot.height/2-view.h/2};commit();}});
    svg.append(node);
  }
  if(!slots.length)svg.append(svgNode('text',{x:base.x+base.w/2,y:base.y+base.h/2,'text-anchor':'middle',fill:'#f5f7f9','font-size':30},L('No matches')));
  root.append(svg);
  function commit(){view.x=Math.max(base.x-Math.max(0,view.w-base.w),Math.min(base.x+base.w-view.w,view.x));view.y=Math.max(base.y-Math.max(0,view.h-base.h),Math.min(base.y+base.h-view.h,view.y));cameraState.view=view;svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);}
  function world(x,y){const point=svg.createSVGPoint();point.x=x;point.y=y;const matrix=svg.getScreenCTM();return matrix?point.matrixTransform(matrix.inverse()):null;}
  function zoom(factor,x,y){const anchor=x==null?{x:view.x+view.w/2,y:view.y+view.h/2}:world(x,y);if(!anchor)return;const w=Math.max(base.w/12,Math.min(base.w,view.w*factor)),ratio=w/view.w;view={x:anchor.x-(anchor.x-view.x)*ratio,y:anchor.y-(anchor.y-view.y)*ratio,w,h:view.h*ratio};commit();}
  let points=new Map(),dragged=false,last=null,pinch=null,tapped=null;
  svg.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===1){dragged=false;last={x:e.clientX,y:e.clientY};const id=e.target.closest('[data-space-id]')?.getAttribute('data-space-id');tapped=slots.find(s=>s.id===id)||null;}if(points.size===2){dragged=true;const p=[...points.values()];pinch=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}svg.setPointerCapture(e.pointerId);});
  svg.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2){const p=[...points.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinch&&d>0)zoom(pinch/d,(p[0].x+p[1].x)/2,(p[0].y+p[1].y)/2);pinch=d;dragged=true;return;}if(points.size!==1||!last)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;if(!dragged&&Math.hypot(dx,dy)<4)return;dragged=true;const old=world(last.x,last.y),next=world(e.clientX,e.clientY);if(old&&next){view={...view,x:view.x+old.x-next.x,y:view.y+old.y-next.y};commit();}last={x:e.clientX,y:e.clientY};});
  const up=e=>{const chosen=points.size===1&&!dragged?tapped:null;points.delete(e.pointerId);pinch=null;last=null;tapped=null;if(chosen)onOpen(chosen);};svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',e=>{dragged=true;up(e);});
  svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?.85:1.18,e.clientX,e.clientY);},{passive:false});
  return {zoomIn:()=>zoom(.8),zoomOut:()=>zoom(1.25),reset:()=>{view={...base};commit();}};
}
