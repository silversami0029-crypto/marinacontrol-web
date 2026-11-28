import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {app} from '../firebase.js';
import {store} from '../store.js';
const call = httpsCallable(getFunctions(app, 'us-central1'), 'staffWork');
const operations = new Map();
export const canManageWork = () => ['admin', 'manager'].includes(store.activeRole);
export async function staffWork(action, input = {}) {
  const clientId = Number(store.activeClientId), uid = store.authUser?.uid;
  if (!uid || !clientId || store.marinaSwitching) throw Error('Sign in to a marina first.');
  const data = {...input, action, clientId};
  let operationKey;
  if (['ASSIGN','CREATE_EQUIPMENT_WORK','CREATE_DOCUMENT_WORK','UPDATE','UPLOAD_PHOTO'].includes(action)) {
    const bytes = new TextEncoder().encode(JSON.stringify([uid,clientId,action,input]));
    const key = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    operationKey = key;
    if (!operations.has(key)) operations.set(key,crypto.randomUUID());
    data.operationId = operations.get(key);
  }
  let result;
  try{result=(await call(data)).data;}catch(error){
    if(operationKey&&['functions/failed-precondition','functions/invalid-argument','functions/permission-denied','functions/aborted'].includes(error.code))operations.delete(operationKey);
    throw error;
  }
  if (operationKey && operations.get(operationKey) === data.operationId) operations.delete(operationKey);
  if (store.authUser?.uid !== uid || Number(store.activeClientId) !== clientId || store.marinaSwitching)
    throw Error('Workspace changed. Refresh the current screen.');
  return result;
}
export const workEscape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const stageLabel = stage => String(stage || '').replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
export async function jpegEvidence(file) {
  const image = await createImageBitmap(file);
  try {
    let width = Math.min(image.width,1200), height = Math.round(image.height * width/image.width);
    const canvas = document.createElement('canvas');
    let blob;
    for (let pass=0;pass<5;pass++) {
      canvas.width=width;canvas.height=height;
      canvas.getContext('2d').drawImage(image,0,0,width,height);
      blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.78-pass*0.08));
      if(blob && blob.size<=250000) break;
      width=Math.round(width*0.75);height=Math.round(height*0.75);
    }
    if(!blob || blob.size>250000) throw Error('Choose a smaller photo.');
    return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
  } finally {image.close();}
}
