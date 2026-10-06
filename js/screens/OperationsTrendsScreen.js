import { store } from '../store.js';
import { t, getLocale } from '../i18n.js';
import { db, collection, query, where, getDocs } from '../firebase.js';
import { calculateTrends, monthStart, toMs } from '../analytics/operationsTrends.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const info = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7" r=".8" fill="currentColor"/></svg>';
const unusedCross = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const metrics = ['Booked berth-days','Electricity consumption (kWh)','Water consumption (L)','Maintenance by scheduled month','Paid invoices by issue month'];
const notes = [
  'Assigned confirmed, checked-in and checked-out bookings. Arrival is included; departure is excluded. Overlapping stays at the same berth count once. Booked dates are not proof of actual occupancy. Unassigned or unknown berths are excluded.',
  'Consumption is the difference between cumulative readings, assigned to the later reading’s month. Electricity uses kWh meters. Meter identity includes berth, asset, reading type and unit. Interval and instantaneous readings are excluded; meter resets or replacements need review.',
  'Consumption is the difference between cumulative readings, assigned to the later reading’s month. Water readings in m³ are converted to litres. Meter identity includes berth, asset, reading type and unit. Interval and instantaneous readings are excluded; meter resets or replacements need review.',
  'Maintenance tasks are grouped by scheduled date using the selected status filter. These are not creation or completion dates. Repair duration is not available.',
  'Currently paid invoices are grouped by issue date, not payment date. Currencies are kept separate. Legacy invoices without currency show amounts without a currency symbol. This is not profit or a cash-receipts report.'
];
const labels = ['booked','electricity','water','maintenance','paid'];

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${esc(num)}</div>
      <div class="help-step-text">
        <b>${esc(t(title))}</b> — ${esc(t(body))}
      </div>
    </div>`;
}

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
    <label>${t('Period')}<select data-period><option value="3">${t('Next 3 months')}</option><option value="6" selected>${t('Next 6 months')}</option><option value="12">${t('Next 12 months')}</option><option value="past">${t('Past 12 months')}</option><option value="custom">${t('Custom dates')}</option></select></label>
    <label data-status-label hidden>${t('Maintenance status')}<select data-status><option value="OPEN">${t('Open')}</option><option value="COMPLETED">${t('Completed')}</option><option value="DEFERRED">${t('Deferred')}</option><option value="ALL">${t('All statuses')}</option></select></label>
    <div class="ot-dates" data-dates hidden><label>${t('Start date')}<input type="date" data-start></label><label>${t('End date')}<input type="date" data-end></label><button type="button" class="ot-apply" data-apply>${t('Apply')}</button></div>
    <label data-currency-label hidden>${t('Currency')}<select data-currency></select></label></div>
    <div class="ot-result" aria-live="polite">${t('Loading marina records…')}</div>`;
  let result, helpClose = null, calendarClose = null;
  const current = () => root.isConnected && Number(store.activeClientId) === clientId && location.hash.split('?')[0] === '#/operations-trends';
  const format = (n, metric) => new Intl.NumberFormat(getLocale(), {maximumFractionDigits:metric===0||metric===3?0:2}).format(n);
  const monthLabel = ms => new Intl.DateTimeFormat(getLocale(),{month:'short',year:'numeric',timeZone:'UTC'}).format(ms);
  function help() {
    if (helpClose || !current()) return;
    const metric = Number(root.querySelector('[data-metric]').value);
    const backdrop = document.createElement('div'); backdrop.className = 'help-backdrop';
    const overlay = document.createElement('div'); overlay.className='help-dialog';
overlay.innerHTML = `
  <div class="help-scroll"
       role="dialog"
       aria-modal="true"
       aria-labelledby="otHelpTitle">

    <div class="help-pill" id="otHelpTitle">
      ${t('Operations Trends')}
    </div>

    <p class="help-desc">
      ${t('Understand how your marina records contribute to each monthly total.')}
    </p>

    <div class="help-section-title">
      ${t(metrics[metric])}
    </div>

    ${metric === 0 ? [
      step(
        '1',
        'One berth-day',
        'One berth booked for one day contributes one berth-day. Several berths booked on the same day each contribute, so a monthly total can exceed 30 or 31.'
      ),
      step(
        '2',
        'Arrival and departure',
        'Arrival is included; departure is excluded. A booking from 18–21 November contributes 3 berth-days: the 18th, 19th and 20th. Two different berths booked for those dates contribute 6.'
      ),
      step(
        '3',
        'Monthly allocation',
        'Each booked day belongs to its own month. A 30 November–2 December booking contributes 1 berth-day to November and 1 to December. Only days inside the selected reporting period count.'
      ),
      step(
        '4',
        'Included bookings',
        'Bookings must link to a known berth and have status CONFIRMED, CHECKED_IN or CHECKED_OUT. Pending enquiries, cancelled bookings, invalid dates and missing berth links do not contribute.'
      ),
      step(
        '5',
        'Overlapping bookings',
        'Overlapping bookings for the same berth on the same day count once.'
      ),
      step(
        '6',
        'What the total means',
        'This shows booked demand from recorded reservations. It is not a prediction of new bookings, proof of actual occupancy or an occupancy percentage. A percentage would also require available berth-days for the same period.'
      )
    ].join('') : step(
      '1',
      'How this metric is calculated',
      notes[metric]
    )}

    <div class="help-divider"></div>

    <div class="help-section-title">
      ${t('Reporting notes')}
    </div>

    ${step(
      '•',
      'Selected period',
      metric === 1 || metric === 2
        ? 'Custom dates include both selected days. First and last monthly bars may cover only part of a month. Consumption counts when the later reading falls inside the range; the earlier baseline may be outside it.'
        : 'Custom dates include both selected days. First and last monthly bars may cover only part of a month.'
    )}

    ${metric === 3 ? step(
      '•',
      'Maintenance status',
      root.querySelector('[data-status]')
        .selectedOptions[0].textContent +
      '. Open includes tasks not completed or deferred. Deferred tasks use their scheduled date, not their review date.'
    ) : ''}

    ${step(
      '•',
      'Incomplete records',
      'The current month is incomplete. Missing records do not prove zero activity. Future consumption and income are recorded data, not forecasts.'
    )}

    ${result ? step(
      '•',
      'Records excluded',
      format(
        metric === 0 ? result.excludedBookings :
        metric === 3 ? result.excludedMaintenance :
        metric === 4 ? result.excludedInvoices :
        result.excludedReadings,
        0
      )
    ) : ''}

    ${result && (metric === 1 || metric === 2) ? step(
      '•',
      'Reading checks',
      t('Meter drops skipped') + ': ' +
      result.meterDrops + '. ' +
      t('Cross-month reading pairs') + ': ' +
      result.crossMonthPairs + '.'
    ) : ''}

    <div class="help-divider"></div>

    <div class="help-section-title">
      ${t('Tips')}
    </div>

    <div class="help-tips">
      ${t('• Reporting dates use UTC. • Only records for the selected marina are included. • Reopen this screen to refresh the data.')}
    </div>
  </div>

  <div class="help-actions">
    <button type="button" class="help-gotit" data-close>
      ${t('Got it')}
    </button>
  </div>`;
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
  function openCalendar(input) {
    if (calendarClose || !current()) return;
    const initial=toMs(input.value) || monthStart(now);
    let viewed=monthStart(initial), selected=initial;
    const opener=document.activeElement;
    const overlay=document.createElement('div');overlay.className='ot-calendar-overlay';
    overlay.innerHTML=`<section class="ot-calendar" role="dialog" aria-modal="true" aria-labelledby="otCalendarTitle">
      <div class="ot-header"><h2 id="otCalendarTitle">${t(input.matches('[data-start]')?'Start date':'End date')}</h2><button type="button" class="ot-icon" data-dismiss aria-label="${t('Close')}">${unusedCross}</button></div>
      <div class="ot-calendar-nav"><button type="button" data-prev aria-label="${t('Previous month')}">‹</button><strong data-month aria-live="polite"></strong><button type="button" data-next aria-label="${t('Next month')}">›</button></div>
      <div class="ot-calendar-grid" data-grid></div><button type="button" class="ot-apply" data-today>${t('Today')}</button></section>`;
    function close() {overlay.remove();document.removeEventListener('keydown',keys);window.removeEventListener('hashchange',close);calendarClose=null;if(root.isConnected)opener?.focus();}
    calendarClose=close;
    function choose(ms) {input.value=new Date(ms).toISOString().slice(0,10);close();}
    function draw(focusDay) {
      overlay.querySelector('[data-month]').textContent=new Intl.DateTimeFormat(getLocale(),{month:'long',year:'numeric',timeZone:'UTC'}).format(viewed);
      const d=new Date(viewed), y=d.getUTCFullYear(), m=d.getUTCMonth(), days=new Date(Date.UTC(y,m+1,0)).getUTCDate();
      const offset=(d.getUTCDay()+6)%7;
      const weekday=Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(getLocale(),{weekday:'short',timeZone:'UTC'}).format(Date.UTC(2026,0,5+i)));
      const grid=overlay.querySelector('[data-grid]');
      grid.innerHTML=weekday.map(n=>`<span class="ot-weekday">${esc(n)}</span>`).join('')+Array.from({length:offset},()=>'<span></span>').join('')+
        Array.from({length:days},(_,i)=>{const ms=Date.UTC(y,m,i+1), label=new Intl.DateTimeFormat(getLocale(),{dateStyle:'full',timeZone:'UTC'}).format(ms);
          return `<button type="button" class="ot-day${ms===selected?' is-selected':''}" data-day="${i+1}" aria-label="${esc(label)}" aria-pressed="${ms===selected}">${i+1}</button>`;}).join('');
      grid.querySelectorAll('[data-day]').forEach(btn=>btn.onclick=()=>choose(Date.UTC(y,m,Number(btn.dataset.day))));
      if(focusDay)grid.querySelector(`[data-day="${Math.min(days,focusDay)}"]`)?.focus();
    }
    function keys(e) {
      if(e.key==='Escape'){e.preventDefault();close();return;}
      if(e.key==='Tab'){
        const items=[...overlay.querySelectorAll('button')], first=items[0],last=items[items.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
      const active=document.activeElement;
      if(active?.matches('[data-day]')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        e.preventDefault(); const rtl=document.documentElement.dir==='rtl';
        const delta=e.key==='ArrowDown'?7:e.key==='ArrowUp'?-7:e.key==='ArrowRight'?(rtl?-1:1):(rtl?1:-1);
        const d=new Date(viewed), next=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),Number(active.dataset.day)+delta);
        viewed=monthStart(next);draw(new Date(next).getUTCDate());
      }
    }
    overlay.querySelector('[data-dismiss]').onclick=close;
    overlay.querySelector('[data-prev]').onclick=()=>{viewed=monthStart(viewed,-1);draw();};
    overlay.querySelector('[data-next]').onclick=()=>{viewed=monthStart(viewed,1);draw();};
    overlay.querySelector('[data-today]').onclick=()=>{const d=new Date();choose(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));};
    overlay.onclick=e=>{if(e.target===overlay)close();};
    document.addEventListener('keydown',keys);window.addEventListener('hashchange',close);
    document.getElementById('modalRoot').append(overlay);draw();
    overlay.querySelector('[data-dismiss]').focus();
  }
  root.querySelectorAll('[data-start],[data-end]').forEach(input=>{
    // Retain ISO values used by the calculator, while replacing the native popup.
    input.type='text';input.readOnly=true;input.setAttribute('role','button');
    input.setAttribute('aria-haspopup','dialog');
    input.onclick=()=>openCalendar(input);
    input.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openCalendar(input);}};
  });
  root.querySelector('[data-help]').onclick=help;
  root.querySelector('[data-back]').onclick=()=>{location.hash='#/reports';};
  function render() {
    if(!result || !current()) return;
    const metric = Number(root.querySelector('[data-metric]').value);
    const currency = root.querySelector('[data-currency]').value || 'UNSPECIFIED';
    root.querySelector('[data-currency-label]').hidden=metric!==4;
    root.querySelector('[data-status-label]').hidden=metric!==3;
    const values = metric===4 ? (result.paid[currency] || Array(result.months.length).fill(0)) : result[labels[metric]];
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
    const ticks=Array.from({length:5},(_,i)=>{const n=scale*i/4,y=240-i*52.5;return `<line x1="68" x2="${80+values.length*85}" y1="${y}" y2="${y}" stroke="#37414d"/><text x="60" y="${y+4}" text-anchor="end" fill="#aeb6c1" font-size="11">${esc(format(n,metric))}</text>`;}).join('');
    root.querySelector('.ot-result').innerHTML=`<div class="ot-total"><span>${t(metric===0?'Booked total':'Recorded total')}</span><strong>${esc(value(values.reduce((a,b)=>a+b,0)))}</strong></div>
      ${metric===4&&currency==='UNSPECIFIED'?`<p class="ot-caption">${t('Invoice currency not specified')}</p>`:''}
      <p class="ot-caption">${esc(dateText(selectedFrom))} – ${esc(dateText(selectedEnd-86400000))}</p>
      ${metric===0?`<p class="ot-caption" style="font-size:13px;line-height:1.5;max-width:680px;margin:12px 0 18px;">${t('One berth booked for one day = one berth-day. Totals combine booked days across berths, so a month can exceed 30 or 31. Arrival counts; departure does not. Tap ⓘ for calculation details.')}</p>`:''}
      <div class="ot-chart"><svg viewBox="0 0 ${100+values.length*85} 300" style="min-width:${Math.max(440,100+values.length*70)}px" role="img" aria-label="${esc(t(metrics[metric]))}" direction="ltr">${ticks}${bars}</svg></div>
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
  let selectedFrom = monthStart(now), selectedEnd = monthStart(now,6);
  const dateText = ms => new Date(ms).toISOString().slice(0,10);
  root.querySelector('[data-start]').value=dateText(selectedFrom);
  root.querySelector('[data-end]').value=dateText(selectedEnd-86400000);
  function recalculate() {
    if (!records) return;
    const period=root.querySelector('[data-period]').value;
    let from=selectedFrom, end=selectedEnd;
    if(period==='custom') {
      from=toMs(root.querySelector('[data-start]').value);
      const inclusiveEnd=toMs(root.querySelector('[data-end]').value);
      end=inclusiveEnd+86400000;
      const monthCount=(new Date(end-1).getUTCFullYear()-new Date(from).getUTCFullYear())*12+new Date(end-1).getUTCMonth()-new Date(from).getUTCMonth()+1;
      if(!from || !inclusiveEnd || end<=from || monthCount>60) {
        root.querySelector('.ot-result').textContent=t('Choose valid dates, with the end on or after the start and at most 60 calendar months.');
        result=null; return;
      }
    } else {
      from=monthStart(now,period==='past'?-11:0);
      end=monthStart(now,period==='past'?1:Number(period));
      root.querySelector('[data-start]').value=dateText(from);
      root.querySelector('[data-end]').value=dateText(end-86400000);
    }
    selectedFrom=from; selectedEnd=end;
    result=calculateTrends(clientId,from,records,{from,end,status:root.querySelector('[data-status]').value});
    const picker=root.querySelector('[data-currency]'), prior=picker.value;
    const currencies=Object.keys(result.paid).sort();
    if(!currencies.length) currencies.push('UNSPECIFIED');
    picker.innerHTML=currencies.map(c=>`<option value="${c}">${c==='UNSPECIFIED'?t('Unspecified'):c}</option>`).join('');
    if(currencies.includes(prior)) picker.value=prior;
    render();
  }
  root.querySelector('[data-metric]').onchange=()=>{
    const metric=Number(root.querySelector('[data-metric]').value), period=root.querySelector('[data-period]');
    if(period.value!=='custom') period.value=metric===0||metric===3?'6':'past';
    root.querySelector('[data-status-label]').hidden=metric!==3;
    root.querySelector('[data-currency-label]').hidden=metric!==4;
    recalculate();
  };
  root.querySelector('[data-period]').onchange=()=>{
    root.querySelector('[data-dates]').hidden=root.querySelector('[data-period]').value!=='custom';
    recalculate();
  };
  root.querySelector('[data-apply]').onclick=recalculate;
  root.querySelector('[data-status]').onchange=recalculate;
  root.querySelector('[data-currency]').onchange=()=>render();
  try {
    if(!clientId || !store.authUser) throw new Error('No active marina');
    await refresh(); if(current()) recalculate();
  } catch(error) {
    console.error('Operations Trends',error);
    if(current()) root.querySelector('.ot-result').textContent=t('Could not load marina records. Reopen this screen to retry.');
  }
}
