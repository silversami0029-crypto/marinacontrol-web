import {store} from '../store.js';
import {app} from '../firebase.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
export async function createYardInvoiceThroughBilling(clientId,fields,opts){
 const link=opts.yardPackageInvoice;if(Number(store.activeClientId)!==Number(clientId)||store.authUser?.uid!==link.uid)throw Error('Marina/session changed. Reopen invoice preparation.');
 const payload={clientId:Number(clientId),packageId:link.packageId,estimateId:link.estimateId,estimateVersion:link.estimateVersion,estimateRevision:link.estimateRevision,taskScopeHash:link.taskScopeHash,taxAmount:link.taxAmount,reviewed:opts.yardInvoiceReviewed===true,customerId:fields.customerId,boatId:fields.boatId,currency:fields.currency,amount:fields.amount,status:fields.status,invoiceNumber:fields.invoiceNumber,issueDay:opts.yardInvoiceDates?.issueDay,dueDay:opts.yardInvoiceDates?.dueDay,commandId:link.commandId};
 if(link.pending&&JSON.stringify(link.pending)!==JSON.stringify(payload))throw Error('A save result is uncertain. Keep the original fields to retry, or close and check the package’s linked invoice before trying again.');link.pending=payload;
 try{const result=await httpsCallable(getFunctions(app,'us-central1'),'createYardPackageInvoice')(payload);if(Number(store.activeClientId)!==Number(clientId)||store.authUser?.uid!==link.uid)throw Error('Invoice request finished after a session change. Check the original marina’s package invoice.');link.pending=null;return result.data;}
 catch(e){if(['functions/failed-precondition','functions/invalid-argument','functions/permission-denied','functions/not-found','functions/already-exists','functions/unauthenticated'].includes(e.code))link.pending=null;throw e;}
}
