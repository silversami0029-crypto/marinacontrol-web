import {t, getLocale} from '../i18n.js';
import {store} from '../store.js';
import {toast} from '../ui/toast.js';
import {db} from '../firebase.js';
import {doc, runTransaction} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {wireSafetyDatePicker} from '../ui/SafetyDatePicker.js';
import {calculateSafetyDates, localDateValue} from './SafetyDateCore.js';

export function showSafetyDates(item) {
  const clientId = Number(store.activeClientId);
  if (!clientId || Number(item.clientId) !== clientId || !item._docId) {
    toast(t('No active client'), {kind:'error'}); return;
  }
  const backdrop = document.createElement('div'); backdrop.className='sheet-backdrop';
  const sheet = document.createElement('div'); sheet.className='sheet';
  const hasValidity = Number(item.validityYears)>0 || Number(item.validityMonths)>0;
  sheet.innerHTML=`
    <div style="position:relative;min-height:48px;">
      <div class="sheet-title" style="margin:0;padding:12px 48px;text-align:center;">${escapeHtml(t('Set Purchase Date'))}</div>
      <button type="button" data-close aria-label="${escapeHtml(t('Close'))}" style="position:absolute;right:0;top:2px;width:44px;height:44px;border:0;background:transparent;color:#F5F7F9;font-size:28px;cursor:pointer;">&times;</button>
    </div>
    <form class="add-form" novalidate>
      <div class="add-scroll">
        <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(item.title)}</div>
        <div style="color:var(--color-text-secondary,#AAB5C2);font-size:13px;margin-bottom:16px;">${escapeHtml(t('Boat:'))} ${escapeHtml(item.boatName || t('Unknown'))}</div>
        <label class="add-label">${escapeHtml(t('Purchase Date'))}</label>
        <input data-purchase type="date">
        <p style="font-size:13px;color:var(--color-text-secondary,#AAB5C2);line-height:1.5;">${escapeHtml(hasValidity ? t('Expiry will be calculated from the item’s existing validity. You can specify an expiry date below.') : t('This item has no validity period. Set an expiry date if applicable; a purchase date alone will not calculate expiry.'))}</p>
        <label class="add-label">${escapeHtml(t('Expiry Date'))} (${escapeHtml(t('Optional'))})</label>
        <input data-expiry type="date">
        <button type="button" data-clear style="border:0;background:transparent;color:#65BEFF;padding:8px 0;cursor:pointer;">${escapeHtml(t('Clear expiry date'))}</button>
        <div data-preview style="font-size:13px;margin:8px 0;"></div>
        <div data-error role="alert" style="color:#FF8686;font-size:13px;"></div>
      </div>
      <button type="submit" class="add-save">${escapeHtml(t('Set Date'))}</button>
    </form>`;
  const purchase=sheet.querySelector('[data-purchase]'), expiry=sheet.querySelector('[data-expiry]');
  purchase.value=localDateValue(Number(item.purchaseDate)>0 ? Number(item.purchaseDate) : Date.now());
  let busy=false; const calendars=[];
  const close=()=>{if(busy)return;calendars.forEach(c=>c.close());backdrop.classList.remove('is-open');sheet.classList.remove('is-open');setTimeout(()=>{sheet.remove();backdrop.remove();},220);};
  const preview=()=>{
    const el=sheet.querySelector('[data-preview]');
    try {const dates=calculateSafetyDates(item,purchase.value,expiry.value);
      el.textContent=dates.expiryDate ? `${t('Expires:')} ${new Date(dates.expiryDate).toLocaleDateString(getLocale(),{day:'numeric',month:'short',year:'numeric'})}` : t('No expiry date set');
    } catch(error) {el.textContent=t(error.message);}
  };
  document.getElementById('modalRoot').append(backdrop,sheet);
  calendars.push(wireSafetyDatePicker(purchase,{label:t('Purchase Date'),locale:getLocale(),onChange:preview}));
  calendars.push(wireSafetyDatePicker(expiry,{label:t('Select expiry date'),locale:getLocale(),onChange:preview}));
  sheet.querySelector('[data-clear]').onclick=()=>{expiry.value='';calendars[1].refresh();preview();};
  sheet.querySelector('[data-close]').onclick=close;backdrop.onclick=close;preview();
  requestAnimationFrame(()=>{sheet.classList.add('is-open');backdrop.classList.add('is-open');});
  sheet.querySelector('form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    const errorEl=sheet.querySelector('[data-error]');errorEl.textContent='';
    try {
      const proposedDates = calculateSafetyDates(
  item, purchase.value, expiry.value
);
if (!(proposedDates.expiryDate > 0)) {
  throw new Error('Select an expiry date before saving');
}
      if(Number(store.activeClientId)!==clientId) throw new Error('Active marina changed; reopen the item');
      busy=true;sheet.querySelectorAll('button').forEach(button=>button.disabled=true);
      await runTransaction(db,async transaction=>{
        const ref=doc(db,'safety_items',String(item._docId)); const snap=await transaction.get(ref);
        if(!snap.exists()) throw new Error('This safety item no longer exists');
        const live=snap.data();
        if(Number(live.clientId)!==clientId || Number(live.boatId)!==Number(item.boatId) || live.status==='DELETED')
          throw new Error('This item is no longer available in the selected marina');
        if(Number(live.expiryDate)>0) throw new Error('Dates have already been set. Reopen the item to review them');
        for(const field of ['purchaseDate','validityYears','validityMonths','alertDaysBefore']) {
          if(Number(live[field] ?? (field==='alertDaysBefore'?30:0)) !== Number(item[field] ?? (field==='alertDaysBefore'?30:0)))
            throw new Error('This item changed. Reopen it before setting dates');
        }
        const dates=calculateSafetyDates(live,purchase.value,expiry.value), now=Date.now();

if (!(dates.expiryDate > 0)) {
  throw new Error('Select an expiry date before saving');
}
        transaction.update(ref,{...dates,updatedAt:now,lastModified:now,lastModifiedBy:String(store.userProfile?.userId || 0)});
      });
      busy=false;close();toast(t('Safety item updated'),{kind:'success'});
    } catch(error) {
      busy=false;sheet.querySelectorAll('button').forEach(button=>button.disabled=false);
      errorEl.textContent=t(error.message || 'Failed to save.');
    }
  };
}
function escapeHtml(value){return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
