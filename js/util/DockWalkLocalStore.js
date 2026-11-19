// Browser-local only. Never cache credentials or bypass Firebase sign-in.
const DATABASE='marinacontrol-dock-walk-offline';
function operation(storeName, mode, action) {
  return new Promise((resolve,reject)=>{
    const opening=indexedDB.open(DATABASE,1);
    opening.onupgradeneeded=()=>{for(const name of ['drafts','snapshots'])if(!opening.result.objectStoreNames.contains(name))opening.result.createObjectStore(name,{keyPath:'key'});};
    opening.onerror=()=>reject(opening.error||new Error('Browser storage unavailable.'));
    opening.onblocked=()=>reject(new Error('Close other MarinaControl tabs and retry browser storage.'));
    opening.onsuccess=()=>{
      const database=opening.result;let result;
      const transaction=database.transaction(storeName,mode);
      transaction.oncomplete=()=>{database.close();resolve(result);};
      transaction.onabort=()=>{database.close();reject(transaction.error||new Error('Could not save in this browser.'));};
      try { action(transaction.objectStore(storeName), value=>{result=value;}, transaction); }
      catch(error){transaction.abort();reject(error);}
    };
  });
}
export const dockWalkScopeKey=context=>JSON.stringify([context.uid,Number(context.clientId)]);
const draftKey=(context,cloudId)=>JSON.stringify([context.uid,Number(context.clientId),cloudId]);
export function listDockWalkDrafts(context){return operation('drafts','readonly',(store,done)=>{const request=store.getAll();request.onsuccess=()=>done(request.result.filter(row=>row.uid===context.uid&&row.clientId===Number(context.clientId)).sort((a,b)=>b.updatedAt-a.updatedAt));});}
export function saveDockWalkDraft(context,draft){return operation('drafts','readwrite',(store,done,tx)=>{
  const key=draftKey(context,draft.cloudId),get=store.get(key);
  get.onsuccess=()=>{
    if(get.result && get.result.state!=='DRAFT'){tx.abort();return;}
    const value={...draft,key,uid:context.uid,clientId:Number(context.clientId),state:'DRAFT',updatedAt:Date.now()};store.put(value);done(value);
  };
});}
export function queueDockWalkDraft(context,draft){return operation('drafts','readwrite',(store,done)=>{
  const key=draftKey(context,draft.cloudId),get=store.get(key);
  get.onsuccess=()=>{
    // A queued submission is immutable. Reuse it after an uncertain acknowledgement.
    if(get.result && get.result.state!=='DRAFT'){done(get.result);return;}
    const value={...draft,key,uid:context.uid,clientId:Number(context.clientId),state:'PENDING',updatedAt:Date.now(),lastError:''};store.put(value);done(value);
  };
});}
export function dockWalkDraftError(context,draft,message){return operation('drafts','readwrite',(store,done)=>{
  const get=store.get(draftKey(context,draft.cloudId));get.onsuccess=()=>{const row=get.result;if(row&&row.state!=='DRAFT'){row.lastError=String(message||'Sync failed.');store.put(row);}done(row);};
});}
export function deleteDockWalkDraft(context,cloudId){return operation('drafts','readwrite',(store,done)=>{store.delete(draftKey(context,cloudId));done(true);});}
export function saveDockWalkSnapshot(context,name,rows){return operation('snapshots','readwrite',(store,done)=>{store.put({key:dockWalkScopeKey(context)+':'+name,rows,updatedAt:Date.now()});done(true);});}
export function getDockWalkSnapshot(context,name){return operation('snapshots','readonly',(store,done)=>{const request=store.get(dockWalkScopeKey(context)+':'+name);request.onsuccess=()=>done(request.result||null);});}
