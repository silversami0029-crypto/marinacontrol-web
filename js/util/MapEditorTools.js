import {confirmSheet} from '../ui/confirm.js';

// Keep the existing synchronous dialog contract while the confirmation is open.
export function mapEditorConfirmation(sheet,active){
 let waiting=false;
 const abort=new AbortController();
 const observer=new MutationObserver(()=>{if(!sheet.isConnected){abort.abort();observer.disconnect();}});
 observer.observe(sheet.parentNode,{childList:true});
 return async options=>{
  if(waiting||!active())return false;
  waiting=true;sheet.inert=true;
  try{return await confirmSheet({...options,signal:abort.signal})&&active();}
  finally{waiting=false;if(sheet.isConnected)sheet.inert=false;}
 };
}

// Rotate the entire drawing, including marker centres and labels. Record IDs stay intact.
export async function rotateMapPlan(layout,direction){
 const next=structuredClone(layout),right=direction>0,w=layout.width,h=layout.height;
 let bitmap;
 try{
  if(layout.background){
   bitmap=await createImageBitmap(await (await fetch(layout.background)).blob());
   const budget=Math.min(136000,210000-JSON.stringify({...layout,background:''}).length);
   let scale=Math.min(1,1600/Math.max(w,h)),url='';
   do{
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(h*scale));canvas.height=Math.max(1,Math.round(w*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.scale(canvas.width/h,canvas.height/w);
    if(right){ctx.translate(h,0);ctx.rotate(Math.PI/2);}else{ctx.translate(0,w);ctx.rotate(-Math.PI/2);}
    ctx.drawImage(bitmap,0,0,layout.backgroundWidth||w,layout.backgroundHeight||h);
    url=canvas.toDataURL('image/jpeg',.65);scale*=.75;
   }while(url.length>budget&&scale*Math.max(w,h)>=200);
   if(url.length>budget)throw Error('This plan is too detailed to rotate within the image limit.');
   next.background=url;
   if('backgroundWidth' in next){next.backgroundWidth=h;next.backgroundHeight=w;}
  }
  for(const item of next.items){const {x,y,width,height}=item;item.x=right?h-y-height:y;item.y=right?x:w-x-width;item.width=height;item.height=width;}
  for(const label of next.labels){const {x,y}=label;label.x=right?h-y:y;label.y=right?x:w-x;label.rotation=((label.rotation||0)+(right?90:-90)+540)%360-180;}
  next.width=h;next.height=w;return next;
 }finally{bitmap?.close();}
}
