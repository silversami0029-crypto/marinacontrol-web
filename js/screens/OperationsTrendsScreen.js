import { store } from '../store.js';
import { t, getLocale } from '../i18n.js';
import { db, collection, query, where, getDocs } from '../firebase.js';
import { calculateTrends, monthStart } from '../analytics/operationsTrends.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const info = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7" r=".8" fill="currentColor"/></svg>';
const unusedCross = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const metrics = ['Booked berth-days','Electricity consumption (kWh)','Water consumption (L)','Maintenance by scheduled month','Paid invoices by issue month'];
const notes = [
  'Assigned confirmed, checked-in and checked-out bookings. Arrival is included; departure is excluded. Overlapping stays at the same berth count once. Booked dates are not proof of actual occupancy. Unassigned or unknown berths are excluded.',
  'Consumption is the difference between cumulative readings, assigned to the later reading’s month. Electricity uses kWh meters. Meter identity includes berth, asset, reading type and unit. Interval and instantaneous readings are excluded; meter resets or replacements need review.',
  'Consumption is the difference between cumulative readings, assigned to the later reading’s month. Water readings in m³ are converted to litres. Meter identity includes berth, asset, reading type and unit. Interval and instantaneous readings are excluded; meter resets or replacements need review.',
  'Maintenance tasks are grouped by scheduled date, across all statuses. These are not creation or completion dates. Repair duration is not available.',
  'Currently paid invoices are grouped by issue date, not payment date. Currencies are kept separate. Legacy invoices without currency show amounts without a currency symbol. This is not profit or a cash-receipts report.'
];
const labels = ['booked','electricity','water','maintenance','paid'];
export async function mountOperationsTrendsScreen() {
  const styleURL = new URL('../../css/operations-trends.css', import.meta.url).href;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === styleURL)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = styleURL; document.head.append(link);
  }
  const screen = document.getElementById('screen');
  const clientId = Number(store.activeClientId), now = Date.now();
  const root = document.createElement('section'); root.className = 'ot-screen';
  screen.replaceChildren(root);
  root.innerHTML = `<div class="c360-header"><div class="c360-header-row">
    <button type="button" class="c360-icon-btn" data-back aria-label="${t('Back')}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg></button>
    <div class="c360-pill">${t('Operations Trends')}</div>
    <button type="button" class="c360-icon-btn" data-help aria-label="${t('Help')}">${info}</button>
    <div class="c360-header-spacer"></div></div></div>
    <div class="ot-filters"><label>${t('Metric')}<select data-metric>${metrics.map((m,i)=>`<option value="${i}">${t(m)}</option>`).join('')}</select></label>
    <label>${t('Period')}<select data-period><option value="1">${t('Current month + next 5 months')}</option><option value="0">${t('Previous 5 months + current month')}</option></select></label>
    <label data-currency-label hidden>${t('Currency')}<select data-currency></select></label></div>
    <div class="ot-result" aria-live="polite">${t('Loading marina records…')}</div>`;
  let result, helpClose = null;
  const current = () => root.isConnected && Number(store.activeClientId) === clientId && location.hash.split('?')[0] === '#/operations-trends';
  const format = (n, metric) => new Intl.NumberFormat(getLocale(), {maximumFractionDigits:metric===0||metric===3?0:2}).format(n);
  const monthLabel = ms => new Intl.DateTimeFormat(getLocale(),{month:'short',year:'numeric',timeZone:'UTC'}).format(ms);
  function help() {
    if (helpClose || !current()) return;
    const metric = Number(root.querySelector('[data-metric]').value);
    const backdrop = document.createElement('div'); backdrop.className = 'help-backdrop';
    const overlay = document.createElement('div'); overlay.className='help-dialog';
    overlay.innerHTML = `<div class="help-scroll" role="dialog" aria-modal="true" aria-labelledby="otHelpTitle">
      <div class="help-pill" id="otHelpTitle">${t('Operations Trends')}</div>
      <div class="help-section-title">${t(metrics[metric])}</div>
      <p class="help-desc">${t(notes[metric])}</p>
      <p>${t('Current month is incomplete. Missing records do not prove zero activity. Future consumption and income are recorded data, not forecasts.')}</p>
      <p>${t('Reporting dates use UTC. Only records for the selected marina are included. Reopen this screen to refresh the data.')}</p>
      ${result ? `<p>${t('Records excluded')}: ${format(metric===0?result.excludedBookings:metric===3?result.excludedMaintenance:metric===4?result.excludedInvoices:result.excludedReadings,0)}</p>
      ${metric===1||metric===2?`<p>${t('Meter drops skipped')}: ${result.meterDrops}<br>${t('Cross-month reading pairs')}: ${result.crossMonthPairs}</p>`:''}` : ''}
      </div><div class="help-actions"><button type="button" class="help-gotit" data-close>${t('Got it')}</button></div>`;
    const opener = document.activeElement;
    helpClose = () => { overlay.remove(); backdrop.remove(); document.removeEventListener('keydown',key); window.removeEventListener('hashchange',helpClose); helpClose=null; if(root.isConnected) opener?.focus(); };
    const key = e => {
      if(e.key==='Escape') helpClose?.();
      if(e.key==='Tab') {e.preventDefault();overlay.querySelector('[data-close]').focus();}
    };
    backdrop.addEventListener('click', ()=>helpClose?.());
    overlay.querySelector('[data-close]').onclick=()=>helpClose?.();
    document.addEventListener('keydown',key);window.addEventListener('hashchange',helpClose);
    document.getElementById('modalRoot').append(backdrop, overlay);
    requestAnimationFrame(()=>{backdrop.classList.add('is-open');overlay.classList.add('is-open');});
    overlay.querySelector('[data-close]').focus();
  }
  root.querySelector('[data-help]').onclick=help;
  root.querySelector('[data-back]').onclick=()=>{location.hash='#/reports';};
  function render() {
    if(!result || !current()) return;
    const metric = Number(root.querySelector('[data-metric]').value);
    const currency = root.querySelector('[data-currency]').value || 'UNSPECIFIED';
    root.querySelector('[data-currency-label]').hidden=metric!==4;
    const values = metric===4 ? (result.paid[currency] || Array(6).fill(0)) : result[labels[metric]];
    const unit = metric===0?t('berth-days'):metric===1?'kWh':metric===2?'L':metric===3?t('tasks'):currency==='UNSPECIFIED'?'':currency;
    const value = n => format(n,metric) + (unit?' '+unit:'');
    const missing = i => metric===1?result.electricityPairs[i]===0:metric===2?result.waterPairs[i]===0:false;
    const max = Math.max(1,...values), scale = max*1.12;
    // Native SVG: no chart dependency or extra network requests.
    const bars = values.map((v,i)=>{
      const x=80+i*85, height=v/scale*210;
      return `<rect x="${x}" y="${240-height}" width="46" height="${height}" rx="4" fill="#2196f3"><title>${esc(monthLabel(result.months[i])+': '+(missing(i)?t('No comparable readings'):value(v)))}</title></rect>
        <text x="${x+23}" y="270" text-anchor="middle" fill="#aeb6c1" font-size="12">${esc(monthLabel(result.months[i]))}</text>`;
    }).join('');
    const ticks=Array.from({length:5},(_,i)=>{const n=scale*i/4,y=240-i*52.5;return `<line x1="68" x2="600" y1="${y}" y2="${y}" stroke="#37414d"/><text x="60" y="${y+4}" text-anchor="end" fill="#aeb6c1" font-size="11">${esc(format(n,metric))}</text>`;}).join('');
    root.querySelector('.ot-result').innerHTML=`<div class="ot-total"><span>${t('Recorded total')}</span><strong>${esc(value(values.reduce((a,b)=>a+b,0)))}</strong></div>
      ${metric===4&&currency==='UNSPECIFIED'?`<p class="ot-caption">${t('Invoice currency not specified')}</p>`:''}
      <div class="ot-chart"><svg viewBox="0 0 620 300" role="img" aria-label="${esc(t(metrics[metric]))}" direction="ltr">${ticks}${bars}</svg></div>
      <table class="ot-table"><thead><tr><th>${t('Month')}</th><th>${t('Recorded value')}</th></tr></thead><tbody>${values.map((v,i)=>`<tr><td>${esc(monthLabel(result.months[i]))}</td><td>${esc(missing(i)?t('No comparable readings'):value(v))}</td></tr>`).join('')}</tbody></table>`;
  }
  let records;
  async function refresh() {
    const snaps = await Promise.allSettled(['berths','berth_bookings','utility_readings','maintenance','invoices'].map(async name => {
      const snap=await getDocs(query(collection(db,name),where('clientId','==',clientId)));
      return [name,snap.docs.map(d=>({...d.data(),_docId:d.id}))];
    }));
    const failure=snaps.find(x=>x.status==='rejected');
    if(failure) throw failure.reason;
    records=Object.fromEntries(snaps.map(x=>x.value));
  }
  function recalculate() {
    result=calculateTrends(clientId,monthStart(now,root.querySelector('[data-period]').value==='1'?0:-5),records);
    const picker=root.querySelector('[data-currency]'), prior=picker.value;
    const currencies=Object.keys(result.paid).sort();
    if(!currencies.length) currencies.push('UNSPECIFIED');
    picker.innerHTML=currencies.map(c=>`<option value="${c}">${c==='UNSPECIFIED'?t('Unspecified'):c}</option>`).join('');
    if(currencies.includes(prior)) picker.value=prior;
    render();
  }
  root.querySelector('[data-metric]').onchange=()=>render();
  root.querySelector('[data-period]').onchange=()=>{if(records) recalculate();};
  root.querySelector('[data-currency]').onchange=()=>render();
  try {
    if(!clientId || !store.authUser) throw new Error('No active marina');
    await refresh(); if(current()) recalculate();
  } catch(error) {
    console.error('Operations Trends',error);
    if(current()) root.querySelector('.ot-result').textContent=t('Could not load marina records. Reopen this screen to retry.');
  }
}
