import { app } from '../firebase.js';
import { store } from '../store.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

export const setupSteps = [
  {id:'details',title:'Marina details',description:'Review the marina name, country and contact details. Ask MarinaControl to correct anything that is wrong.'},
  {id:'records',title:'Bring in records',description:'Add or import customers, boats and berths. Check a small sample before bringing in the rest.',skippable:true},
  {id:'team',title:'Set up the team',description:'Ask a marina administrator to add users and assign the right roles. Mark Not needed if you are running the pilot alone.',skippable:true},
  {id:'workflow',title:'Try one workflow',description:'Record an inspection, create its maintenance follow-up, assign responsibility and check the result with your team.'},
  {id:'review',title:'Review together',description:'Review the setup with MarinaControl and agree the pilot workflow, support arrangements and success measures.'}
];
export const canUseMarinaSetup = () => !!store.authUser?.uid && Number(store.activeClientId)>0 && !store.marinaSwitching
  && ['admin','manager'].includes(store.activeRole) && store.activeMarina?.clientType!=='yacht_operator';
export function setupContext() { return {uid:store.authUser?.uid,clientId:Number(store.activeClientId)}; }
export const setupContextCurrent = context => canUseMarinaSetup() && context.uid===store.authUser?.uid && context.clientId===Number(store.activeClientId);
export async function setupRequest(name, context, values={}) {
  if (!setupContextCurrent(context)) throw new Error('Your marina, role or session changed. Reopen Marina setup.');
  const {data}=await httpsCallable(getFunctions(app,'us-central1'),name)({clientId:context.clientId,...values});
  if (!setupContextCurrent(context) || Number(data.clientId)!==context.clientId) throw new Error('Your marina, role or session changed. Reopen Marina setup.');
  return data;
}
export function setupCompletedCount(data) {
  return setupSteps.filter(step=>['COMPLETE','NOT_NEEDED'].includes(data?.steps?.[step.id]?.status)).length;
}
export function setupSupportUrl(context, marinaName, review=false) {
  const subject=`MarinaControl ${review?'pilot review':'remote setup'} — ${marinaName}`;
  const body=`Hello MarinaControl,\n\nPlease help us arrange a ${review?'pilot setup review':'remote setup session'}.\nMarina: ${marinaName}\nMarina ID: ${context.clientId}\n\nOur preferred times and time zone:\n\nWhat we need help with:\n\n`;
  return `mailto:support@marinacontrol.co.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
