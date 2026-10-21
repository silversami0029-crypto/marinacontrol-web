import { store } from '../store.js';
import { getLocale } from '../i18n.js';
import { getActiveTariff } from '../db.js';
import { money } from '../util/BillingCurrency.js';
import { calculatePedestalPreview } from '../util/PedestalInvoicePreview.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function showPedestalInvoicePreview(session, isCurrent = () => true) {
  const clientId = Number(store.activeClientId), uid = store.authUser?.uid;
  const active = () => Number(store.activeClientId) === clientId && store.authUser?.uid === uid && store.activeRole === 'admin' && isCurrent();
  if (!active() || session?.mode !== 'TEST' || Number(session.clientId) !== clientId) throw new Error('Reopen the simulator for the active marina.');
  const ar = getLocale().startsWith('ar');
  const L = (en, arabic) => ar ? arabic : en;
  const at = Date.now();
  const types = ['ELECTRICITY','WATER'].filter(type => session.state?.[type.toLowerCase()]?.value != null);
  const tariffs = Object.fromEntries(await Promise.all(types.map(async type => [type, await getActiveTariff(clientId,type,at)])));
  if (!active()) return;
  const preview = calculatePedestalPreview(session,tariffs);
  const root = document.getElementById('modalRoot');
  if (!root) throw new Error('Unable to open invoice preview.');
  const backdrop = document.createElement('div'); backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div'); sheet.className = 'sheet billing-sheet';
  sheet.style.width = 'calc(100% - 24px)'; sheet.style.boxSizing = 'border-box';
  sheet.role = 'dialog'; sheet.setAttribute('aria-modal','true'); sheet.setAttribute('aria-labelledby','psInvoiceTitle');
  const date = n => new Intl.DateTimeFormat(getLocale(),{dateStyle:'medium',timeStyle:'short'}).format(n);
  const num = n => new Intl.NumberFormat(getLocale(),{maximumFractionDigits:6}).format(n);
  sheet.innerHTML = `<div class="sheet-handle"></div>
    <div style="position:relative;display:flex;align-items:center;min-height:48px;flex-shrink:0;">
      <div class="sheet-title" id="psInvoiceTitle" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${L('Test Invoice Preview','معاينة فاتورة تجريبية')}</div>
      <button type="button" data-preview-close aria-label="${L('Close','إغلاق')}" style="position:absolute;inset-inline-end:0;top:2px;width:44px;height:44px;border:0;background:transparent;color:var(--color-text-primary,#F5F7F9);font-size:26px;cursor:pointer;">×</button>
    </div>
    <div class="md-body" style="overflow-y:auto;min-height:0;overflow-wrap:anywhere;">
      <p style="color:var(--color-warning,#f5d98d);font-weight:700;">${L('TEST ONLY — Not issued. No charges or invoices are saved.','اختبار فقط — لم تُصدر الفاتورة ولم تُحفظ رسوم أو فواتير.')}</p>
      <p><strong>${L('Berth','الرصيف')}:</strong> ${esc(preview.berthLabel)}</p>
      <p><strong>${L('Tariff snapshot','تاريخ التعرفة المستخدمة')}:</strong> ${esc(date(at))}</p>
      <p>${L('The rate active now is applied to the total consumption in this test. This preview does not split tariff changes or allocate usage to a boat or customer.','تُطبّق التعرفة الحالية على إجمالي استهلاك الاختبار. لا تقسم هذه المعاينة تغيّرات التعرفة ولا تخصص الاستهلاك لقارب أو عميل.')}</p>
      ${preview.lines.map(line => `<div style="border-top:1px solid var(--color-divider,#384452);padding:12px 0;">
        <strong>${line.utilityType === 'ELECTRICITY' ? L('Electricity','الكهرباء') : L('Water','المياه')}</strong>
        <p>${L('Baseline → latest','خط الأساس ← الأحدث')}: ${esc(num(line.fromValue))} → ${esc(num(line.toValue))} ${esc(line.unit)}</p>
        <p>${L('Consumption','الاستهلاك')}: ${esc(num(line.quantity))} ${esc(line.unit)}</p>
        <p>${L('Rate','التعرفة')}: ${line.mode === 'INCLUDED' ? L('Included','مشمول') : `${esc(line.currency)} ${esc(num(line.rate))}/${esc(line.tariffUnit)}`}</p>
        <p><strong>${L('Amount','المبلغ')}: ${esc(money(line.amount,line.currency,getLocale()))}</strong></p>
      </div>`).join('')}
      ${preview.totals.map(total => `<p><strong>${L('Test total','إجمالي الاختبار')}: ${esc(money(total.amount,total.currency,getLocale()))}</strong></p>`).join('')}
      <p>${L('No payment is due. This is a consumption-and-tariff demonstration, not a tax invoice.','لا يوجد مبلغ مستحق. هذا عرض لحساب الاستهلاك والتعرفة وليس فاتورة ضريبية.')}</p>
    </div><button type="button" class="md-close-btn" data-preview-close>${L('Close','إغلاق')}</button>`;
  const opener = document.activeElement;
  let closed = false;
  const close = () => {if (closed) return; closed = true; backdrop.remove();sheet.remove();window.removeEventListener('hashchange',close);document.removeEventListener('keydown',keys);if(opener?.isConnected) opener.focus();};
  const keys = event => {
    if (event.key === 'Escape') {event.preventDefault();close();}
    if (event.key === 'Tab') {
      const buttons = [...sheet.querySelectorAll('button')];
      if (event.shiftKey && document.activeElement === buttons[0]) {event.preventDefault();buttons.at(-1).focus();}
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {event.preventDefault();buttons[0].focus();}
    }
  };
  root.append(backdrop,sheet);
  sheet.querySelectorAll('[data-preview-close]').forEach(button => button.onclick = close);
  backdrop.onclick = close;window.addEventListener('hashchange',close);document.addEventListener('keydown',keys);
  requestAnimationFrame(() => {if (!closed && active()) {backdrop.classList.add('is-open');sheet.classList.add('is-open');sheet.querySelector('button').focus();} else close();});
}
