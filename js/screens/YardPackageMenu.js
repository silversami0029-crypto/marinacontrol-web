import {store} from '../store.js';
import {showYardEstimates} from './YardEstimates.js';
import {showYardJobCosts} from './YardJobCosts.js';
import {showYardPackageInvoice} from './YardPackageInvoice.js';
export function showYardPackageMenu({packageId,dialog}){
 const clientId=Number(store.activeClientId),uid=store.authUser?.uid,sheet=dialog('Work package',`<button type="button" class="sheet-item maintenance-menu-action" data-action="estimate"><span class="sheet-item-text"><span class="sheet-item-title">Estimates</span></span></button><button type="button" class="sheet-item maintenance-menu-action" data-action="cost"><span class="sheet-item-text"><span class="sheet-item-title">Job costs</span></span></button><button type="button" class="sheet-item maintenance-menu-action" data-action="invoice"><span class="sheet-item-text"><span class="sheet-item-title">Prepare / view invoice</span></span></button>`);
 sheet.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{sheet.querySelector('[data-close]').click();setTimeout(()=>{if(Number(store.activeClientId)!==clientId||store.authUser?.uid!==uid)return;if(b.dataset.action==='estimate')showYardEstimates({packageId,dialog});else if(b.dataset.action==='cost')showYardJobCosts({packageId});else showYardPackageInvoice({packageId,dialog});},250);});
}
