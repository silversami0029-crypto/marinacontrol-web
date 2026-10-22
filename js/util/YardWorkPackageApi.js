import {store} from '../store.js';
import {app} from '../firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {isMaintenanceCompleted} from './MaintenanceState.js';
export const packageManagers=()=>['admin','manager'].includes(store.activeRole);
export function maintenanceScope(task){return JSON.stringify([Number(task.clientId||0),Number(task.boatId||0),String(task.type||''),String(task.notes||''),String(task.source||''),String(task.workPackageId||''),task.requiredBeforeLaunch===true?true:task.requiredBeforeLaunch===false?false:null]);}
export function launchState(task){if(isMaintenanceCompleted(task))return 'COMPLETED';if(task.launchScope===maintenanceScope(task)&&['REQUIRED','OPTIONAL','UNREVIEWED'].includes(task.launchState))return task.launchState;return task.requiredBeforeLaunch===true?'REQUIRED':'UNREVIEWED';}
export function launchLabel(task){return {COMPLETED:'Completed',REQUIRED:'Required before launch',OPTIONAL:'Optional — does not block launch',UNREVIEWED:'Launch review needed — blocks launch'}[launchState(task)];}
export async function readYardWorkPackages(boatId){
 const clientId=Number(store.activeClientId),uid=store.authUser?.uid;if(!clientId||!uid)throw Error('Sign in and select a marina.');
 const result=await httpsCallable(getFunctions(app,'us-central1'),'getYardWorkPackages')({clientId,boatId:Number(boatId)});
 if(Number(store.activeClientId)!==clientId||store.authUser?.uid!==uid)throw Error('The marina or session changed. Reopen this view.');
 return result.data;
}
export function ensureYardWorkStyles(){const href=new URL('../../css/yard-work-packages.css',import.meta.url).href;if(![...document.querySelectorAll('link')].some(l=>l.href===href)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}}
