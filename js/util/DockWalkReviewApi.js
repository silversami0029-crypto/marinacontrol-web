import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {app} from '../firebase.js';
import {store} from '../store.js';
const callable=httpsCallable(getFunctions(app,'us-central1'),'dockWalkReview');
export async function dockWalkReview(action,input={}){
 const clientId=Number(store.activeClientId),uid=store.authUser?.uid;
 if(!uid||!clientId||store.marinaSwitching)throw Error('Sign in to a marina first.');
 const result=(await callable({...input,clientId,action})).data;
 if(store.authUser?.uid!==uid||Number(store.activeClientId)!==clientId||store.marinaSwitching)throw Error('Workspace changed. Refresh.');
 return result;
}
