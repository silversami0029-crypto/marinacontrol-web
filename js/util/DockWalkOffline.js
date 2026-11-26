import { app, auth } from '../firebase.js';
import { store } from '../store.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { listDockWalkDrafts, deleteDockWalkDraft, dockWalkDraftError } from './DockWalkLocalStore.js';

export const dockWalkCheckKeys=['lightingOk','shorePowerOk','waterOk','bollardsOk','pontoonDamage'];
export const dockWalkContextCurrent=context=>!!context.uid && auth.currentUser?.uid===context.uid && store.authUser?.uid===context.uid
  && Number(store.activeClientId)===Number(context.clientId) && !store.marinaSwitching
  && store.activeMarina?.clientType!=='yacht_operator' && ['admin','manager','staff','inspector','dockmaster'].includes(store.activeRole);
export function validateDockWalkDraft(draft){
  if(!dockWalkCheckKeys.every(key=>['OK','Fault'].includes(draft.values?.[key])))throw new Error('Complete all five inspection checks.');
  for(const key of ['notes','damageDescription'])if(String(draft.values?.[key]||'').length>8000)throw new Error('Notes and damage description must be 8000 characters or fewer.');
  if(draft.photo?.size && (!draft.photo.type.startsWith('image/')||draft.photo.size>=10*1024*1024))throw new Error('Choose an image under 10 MB.');
}
export function dockWalkSubmission(context,draft){
  validateDockWalkDraft(draft);
  return {expectedUid:context.uid,clientId:Number(context.clientId),inspection:{cloudId:draft.cloudId,berthId:Number(draft.berthId),inspectionDate:draft.inspectionDate,
    ...Object.fromEntries(dockWalkCheckKeys.map(key=>[key,draft.values[key]])),
    notes:String(draft.values.notes||'').trim(),damageDescription:String(draft.values.damageDescription||'').trim(),assignedTo:draft.values.assignedTo||null,
    photoStoragePath:draft.photo?.size?`tenants/${context.clientId}/inspections/${draft.cloudId}/evidence.jpg`:null}};
}
async function uploadPhoto(context,draft){
  if(!draft.photo?.size)return null;
  const path=`tenants/${context.clientId}/inspections/${draft.cloudId}/evidence.jpg`;
  const object=ref(getStorage(app),path);
  const upload=uploadBytesResumable(object,draft.photo,{contentType:draft.photo.type});
  let interrupt;
  const interrupted=new Promise((_,reject)=>{interrupt=()=>{upload.cancel();reject(Object.assign(new Error('Photo transfer interrupted. Browser copy retained; retry when connected.'),{code:'storage/canceled'}));};});
  const timer=setTimeout(interrupt,20000);
  const guard=setInterval(()=>{if(!dockWalkContextCurrent(context)||navigator.onLine===false)interrupt();},250);
  try{return await Promise.race([(async()=>{await upload;return getDownloadURL(object);})(),interrupted]);}
  finally{clearTimeout(timer);clearInterval(guard);}
}
const running=new Map();
export function syncDockWalkPending(context,onChange=()=>{}){
  const scope=JSON.stringify([context.uid,Number(context.clientId)]);
  if(running.has(scope))return running.get(scope);
  const work=(async()=>{
    if(!dockWalkContextCurrent(context)||navigator.onLine===false)return;
    const drafts=await listDockWalkDrafts(context);
    for(const draft of drafts.filter(row=>row.state!=='DRAFT')){
      if(!dockWalkContextCurrent(context)||navigator.onLine===false)return;
      onChange(draft.cloudId,'SYNCING');
      try{
        const payload=dockWalkSubmission(context,draft);
        payload.inspection.photoUrl=await uploadPhoto(context,draft);
        if(!dockWalkContextCurrent(context)||navigator.onLine===false)return;
        const {data}=await httpsCallable(getFunctions(app,'us-central1'),'submitDockWalkInspection',{timeout:20000})(payload);
        if(!dockWalkContextCurrent(context))return;
        if(data?.synced!==true||Number(data.clientId)!==Number(context.clientId)||data.cloudId!==draft.cloudId)throw new Error('The server did not confirm this inspection. Local copy retained.');
        await deleteDockWalkDraft(context,draft.cloudId);
        onChange(draft.cloudId,'SYNCED');
      }catch(error){
        const message=error.code==='functions/not-found'?'Inspection sync service is unavailable. Local copy retained.':error.message||'Sync failed. Local copy retained.';
        if(dockWalkContextCurrent(context))await dockWalkDraftError(context,draft,message);
        onChange(draft.cloudId,'PENDING',message);
        // Stop this pass on service/access/network errors; retry is explicit or on reconnect.
        if(!['functions/invalid-argument','functions/already-exists','functions/failed-precondition'].includes(error.code))return;
      }
    }
  })().finally(()=>running.delete(scope));
  running.set(scope,work);return work;
}
