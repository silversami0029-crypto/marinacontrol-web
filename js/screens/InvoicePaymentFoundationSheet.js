import { getLocale } from '../i18n.js';
import { store } from '../store.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

export function showInvoicePaymentFoundation(inv) {
  const clientId = Number(store.activeClientId);
  const arabic = getLocale().startsWith('ar');
  const label = (en, ar) => arabic ? ar : en;
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div class="sheet-title">${label('Invoice Payment Setup','إعداد دفع الفاتورة')}</div>
      <button type="button" id="pfClose" aria-label="${label('Close','إغلاق')}"
        style="color:#F5F7F9;width:44px;height:44px;font-size:26px;">×</button>
    </div>
    <div class="md-body">
      <p>${label('Online payments are not connected yet. No money will be collected.','الدفع الإلكتروني غير متصل بعد. لن يتم تحصيل أي أموال.')}</p>
      <p id="pfStatus" role="status" aria-live="polite">${label('Loading…','جارٍ التحميل…')}</p>
      <p id="pfValue"></p>
      <p id="pfWarning" style="color:#AEB6C1;"></p>
      <button type="button" id="pfTest" class="add-save" hidden>${label('Start Payment Test','بدء اختبار الدفع')}</button>
      <p id="pfNote" style="color:#AEB6C1;">${label('Simulation only. The invoice status and balance stay unchanged.','محاكاة فقط. تبقى حالة الفاتورة ورصيدها دون تغيير.')}</p>
    </div>`;
  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {backdrop.classList.add('is-open');sheet.classList.add('is-open');});
  let closed = false, busy = false, sessionId = null, key = null;
  const close = () => {
    closed = true;
    backdrop.classList.remove('is-open'); sheet.classList.remove('is-open');
    setTimeout(() => {backdrop.remove();sheet.remove();},220);
  };
  backdrop.addEventListener('click',close);
  sheet.querySelector('#pfClose').addEventListener('click',close);
  const status = sheet.querySelector('#pfStatus');
  const button = sheet.querySelector('#pfTest');
  const functions = getFunctions(getApp(), 'us-central1');
  const call = (name, data) => httpsCallable(functions, name)(data);
  const stillHere = () => !closed && Number(store.activeClientId) === clientId;
  const showError = error => {
    console.error('[invoice payment foundation]',error);
    status.textContent = error.code === 'functions/permission-denied' ?
      label('Only a marina administrator can use payment setup.','يمكن لمسؤول المرسى فقط استخدام إعداد الدفع.') :
      label('Could not complete the operation. Check the connection and deployed payment functions.','تعذر إكمال العملية. تحقق من الاتصال ووظائف الدفع المنشورة.');
  };
  call('getInvoicePaymentFoundation',{clientId, invoiceDocId:inv._docId})
    .then(({data}) => {
      if (!stillHere()) return;
      status.textContent = label('Live payment provider: not connected.','مزود الدفع الفعلي: غير متصل.');
      sheet.querySelector('#pfValue').textContent = new Intl.NumberFormat(getLocale(), {
        style:'currency',currency:data.currency
      }).format(data.amountMinor / 100);
      if (data.legacyCurrency) sheet.querySelector('#pfWarning').textContent =
        label('This existing invoice has no saved currency. GBP is assumed to match the current invoice screen. Confirm currency before enabling real payments.',
          'لا تحتوي هذه الفاتورة على عملة محفوظة. تم افتراض الجنيه الإسترليني لمطابقة شاشة الفواتير الحالية. تأكد من العملة قبل تفعيل الدفع الفعلي.');
      button.hidden = !data.testEnabled || !['PENDING','OVERDUE'].includes(data.invoiceStatus.toUpperCase());
    }).catch(error => {if(stillHere()) showError(error);});
  button.addEventListener('click',async () => {
    if (busy || !stillHere()) return;
    busy = true; button.disabled = true;
    try {
      if (!sessionId) {
        key ||= crypto.randomUUID();
        const {data} = await call('createInvoicePaymentTest',{
          clientId,invoiceDocId:inv._docId,idempotencyKey:key
        });
        sessionId = data.sessionId;
        if (!stillHere()) return;
        status.textContent = label('Test session created. No payment has been taken.','تم إنشاء جلسة اختبار. لم يتم تحصيل أي دفعة.');
        button.textContent = label('Simulate Successful Payment','محاكاة دفع ناجح');
      } else {
        await call('completeInvoicePaymentTest',{clientId,sessionId});
        if (!stillHere()) return;
        status.textContent = label('TEST succeeded. Your real invoice remains unchanged.','نجح الاختبار. بقيت الفاتورة الفعلية دون تغيير.');
        button.hidden = true;
      }
    } catch(error) {if(stillHere()) showError(error);}
    finally {busy = false;if(stillHere()) button.disabled = false;}
  });
}
