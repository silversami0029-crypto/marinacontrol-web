import {store} from '../store.js';
import {getLocale} from '../i18n.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const info = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7" r=".8" fill="currentColor"/></svg>';
const words = {
  'Pedestal Simulator':'محاكي منصات الخدمات', 'TEST ONLY':'اختبار فقط',
  'Loading…':'جارٍ التحميل…', 'Start New Test':'بدء اختبار جديد', 'Select berth':'اختر الرصيف',
  'Berth':'الرصيف', 'No berths available in this marina.':'لا توجد أرصفة متاحة في هذا المرسى.',
  'Connection':'الاتصال', 'Equipment':'المعدات', 'UNKNOWN':'غير معروف', 'ONLINE':'متصل', 'OFFLINE':'غير متصل',
  'No open fault reported':'لا يوجد عطل مفتوح مُبلّغ عنه', 'Fault reported':'تم الإبلاغ عن عطل',
  'Last contact':'آخر اتصال', 'Not received yet':'لم يتم الاستلام بعد', 'Electricity':'الكهرباء', 'Water':'المياه',
  'Meter reading':'قراءة العداد', 'Consumption in this test':'الاستهلاك في هذا الاختبار',
  'First reading establishes the baseline.':'القراءة الأولى تحدد خط الأساس.',
  'Send Reading':'إرسال القراءة', 'Report Fault':'الإبلاغ عن عطل', 'Simulate Offline':'محاكاة انقطاع الاتصال',
  'Send Heartbeat':'إرسال إشارة اتصال', 'Simulated repair workflow':'مسار إصلاح تجريبي',
  'Inspection note':'ملاحظة الفحص', 'Record Inspection':'تسجيل الفحص', 'Repair assignee (test label)':'المكلّف بالإصلاح (اسم تجريبي)',
  'Assign Repair':'تعيين الإصلاح', 'Repair completion note':'ملاحظة إكمال الإصلاح', 'Resolve Fault':'إغلاق العطل',
  'REPORTED':'تم الإبلاغ', 'INSPECTED':'تم الفحص', 'ASSIGNED':'تم التعيين', 'RESOLVED':'تم الحل',
  'Fault occurrences in this test':'مرات حدوث العطل في هذا الاختبار', 'Resolution time':'مدة الحل',
  'seconds':'ثوانٍ', 'Recent test events':'أحداث الاختبار الأخيرة', 'Replay Last Event':'إعادة إرسال الحدث الأخير',
  'Retry Same Request':'إعادة محاولة الطلب نفسه', 'Refresh Test':'تحديث الاختبار',
  'Duplicate ignored. Consumption and workflow unchanged.':'تم تجاهل الحدث المكرر. لم يتغير الاستهلاك أو مسار العمل.',
  'Test event recorded.':'تم تسجيل حدث الاختبار.', 'Test pedestal created.':'تم إنشاء منصة خدمات تجريبية.',
  'Request failed. You can retry the same request.':'فشل الطلب. يمكنك إعادة محاولة الطلب نفسه.',
  'Test not deployed yet or backend unavailable.':'لم يتم نشر الاختبار بعد أو أن الخدمة غير متاحة.',
  'Details':'التفاصيل', 'Help':'المساعدة', 'Back':'رجوع', 'Got it':'فهمت', 'READING':'قراءة', 'FAULT':'عطل', 'HEARTBEAT':'إشارة اتصال',
  'INSPECT':'فحص', 'ASSIGN':'تعيين', 'RESOLVE':'إغلاق', 'Test events':'أحداث الاختبار',
  'Only marina administrators can run this simulator.':'يمكن لمسؤولي المرسى فقط تشغيل هذا المحاكي.',
  'Simulated data only. No hardware is connected. Live readings, invoices, inspections and tasks remain unchanged.':
    'بيانات محاكاة فقط. لا توجد أجهزة متصلة. تبقى القراءات والفواتير والفحوصات والمهام الفعلية دون تغيير.',
  'Offline means communication is unavailable; it does not prove the supply has failed.':
    'عدم الاتصال يعني غياب التواصل؛ ولا يثبت تعطل الإمداد.',
  'This records a test workflow only. No real staff assignment or notification is sent.':
    'يُسجل هذا مساراً تجريبياً فقط. لا يتم تعيين موظفين فعليين أو إرسال إشعارات.',
};
export function pedestalLabel(en) {return getLocale().startsWith('ar') ? words[en] || en : en;}
const key = () => crypto.randomUUID();

export function mountPedestalFoundationScreen() {
  const url = new URL('../../css/pedestal-foundation.css', import.meta.url).href;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === url)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; document.head.append(link);
  }
  const screen = document.getElementById('screen');
  screen.innerHTML = '<section class="ps-screen"></section>';
  const root = screen.firstElementChild;
  const clientId = Number(store.activeClientId), uid = store.authUser?.uid;
  const L = pedestalLabel;
  const functions = getFunctions(getApp(), 'us-central1');
  const call = (name, args) => httpsCallable(functions, name)({clientId, ...args}).then(result => result.data);
  const active = () => root.isConnected && store.activeClientId === clientId && store.authUser?.uid === uid;
  let berths = [], session = null, busy = false, status = L('Loading…'), failure = false;
  let pending = null, lastEvent = null, selectedBerth = '', truncated = false;
  const memoryKey = `marinacontrol.pedestalTest.${uid}.${clientId}`;
  const stamp = n => n ? new Intl.DateTimeFormat(getLocale(), {dateStyle:'medium',timeStyle:'short'}).format(n) : L('Not received yet');
  const number = n => new Intl.NumberFormat(getLocale(), {maximumFractionDigits:3}).format(n);
  function render() {
    if (!active()) return;
    const s = session?.state, fault = s?.fault, open = fault && fault.status !== 'RESOLVED';
    root.innerHTML = `
      <div class="c360-header"><div class="c360-header-row">
        <button type="button" class="c360-back" id="psBack" aria-label="${esc(L('Back'))}">‹</button>
        <div class="c360-pill">${esc(L('Pedestal Simulator'))}</div>
        <button type="button" class="c360-info-btn" id="psHelp" aria-label="${esc(L('Help'))}">${info}</button>
        <div class="c360-spacer"></div></div></div>
      <div class="ps-banner"><strong>${esc(L('TEST ONLY'))}</strong><p>${esc(L('Simulated data only. No hardware is connected. Live readings, invoices, inspections and tasks remain unchanged.'))}</p></div>
      <p class="ps-status ${failure ? 'ps-error':''}" role="status" aria-live="polite">${esc(status)}</p>
      ${pending && !busy ? `<button type="button" id="psRetry">${esc(L('Retry Same Request'))}</button>` : ''}
      ${store.activeRole !== 'admin' ? `<p>${esc(L('Only marina administrators can run this simulator.'))}</p>` : `
      <div class="ps-panel ps-start"><label>${esc(L('Select berth'))}<select id="psBerth" ${busy ? 'disabled':''}>
        ${berths.map(b => `<option value="${esc(b.docId)}" ${b.docId === selectedBerth?'selected':''}>${esc(b.label)}</option>`).join('')}</select></label>
        <button type="button" id="psStart" ${busy || !berths.length || pending ? 'disabled':''}>${esc(L('Start New Test'))}</button>
        ${!berths.length && !busy && !failure ? `<p>${esc(L('No berths available in this marina.'))}</p>`:''}
        ${truncated ? '<p>First 1,000 berths shown.</p>':''}</div>
      ${s ? `
      <div class="ps-panel ps-overview"><h2>${esc(L('Berth'))}: ${esc(session.berthLabel)}</h2>
        
        <div class="ps-grid"><div><small>${esc(L('Connection'))}</small><strong>${esc(L(s.connection))}</strong></div>
        <div><small>${esc(L('Equipment'))}</small><strong>${esc(L(open ? 'Fault reported':'No open fault reported'))}</strong></div>
        <div><small>${esc(L('Last contact'))}</small><strong>${esc(stamp(s.lastContactAt))}</strong></div></div>
        
      </div>
      <div class="ps-grid">${['electricity','water'].map(type => {
        const meter = s[type], utility = type.toUpperCase();
        return `<div class="ps-panel"><h2>${esc(L(type === 'electricity'?'Electricity':'Water'))}</h2>
          
          <p>${esc(L('Meter reading'))}: <strong>${meter.value == null ? '—':esc(number(meter.value))} ${esc(meter.unit)}</strong></p>
          <p>${esc(L('Consumption in this test'))}: <strong>${esc(number(meter.consumption))} ${esc(meter.unit)}</strong></p>
          
          <form data-meter="${utility}"><label>${esc(L('Meter reading'))}<input name="value" type="number" min="0" max="1000000000000" step="any" required value="${meter.value ?? ''}" ${busy || pending ? 'disabled':''}></label>
          <button ${busy || pending ? 'disabled':''}>${esc(L('Send Reading'))}</button></form></div>`;
      }).join('')}</div>
      <div class="ps-panel ps-actions">
        <button data-action="FAULT" ${busy || pending || open ? 'disabled':''}>${esc(L('Report Fault'))}</button>
        <button data-action="OFFLINE" ${busy || pending ? 'disabled':''}>${esc(L('Simulate Offline'))}</button>
        <button data-action="HEARTBEAT" ${busy || pending ? 'disabled':''}>${esc(L('Send Heartbeat'))}</button>
      </div>
      ${fault ? `<div class="ps-panel"><h2>${esc(L('Simulated repair workflow'))}</h2><p class="ps-note">${esc(L('This records a test workflow only. No real staff assignment or notification is sent.'))}</p>
        <p>${esc(L('Fault occurrences in this test'))}: ${esc(number(s.faultCount))}${fault ? ` · <strong>${esc(L(fault.status))}</strong>`:''}</p>
        ${fault?.inspectionNote ? `<p>${esc(L('Inspection note'))}: ${esc(fault.inspectionNote)}</p>`:''}
        ${fault?.assignee ? `<p>${esc(L('Repair assignee (test label)'))}: ${esc(fault.assignee)}</p>`:''}
        ${fault?.resolutionNote ? `<p>${esc(L('Repair completion note'))}: ${esc(fault.resolutionNote)}</p>`:''}
        ${fault?.resolutionSeconds != null ? `<p>${esc(L('Resolution time'))}: ${esc(number(fault.resolutionSeconds))} ${esc(L('seconds'))}</p>`:''}
        ${fault?.status === 'REPORTED' ? `<form data-workflow="INSPECT"><label>${esc(L('Inspection note'))}<textarea name="note" maxlength="500" required></textarea></label><button ${busy || pending?'disabled':''}>${esc(L('Record Inspection'))}</button></form>`:''}
        ${fault?.status === 'INSPECTED' ? `<form data-workflow="ASSIGN"><label>${esc(L('Repair assignee (test label)'))}<input name="assignee" maxlength="100" required></label><button ${busy || pending?'disabled':''}>${esc(L('Assign Repair'))}</button></form>`:''}
        ${fault?.status === 'ASSIGNED' ? `<form data-workflow="RESOLVE"><label>${esc(L('Repair completion note'))}<textarea name="note" maxlength="500" required></textarea></label><button ${busy || pending?'disabled':''}>${esc(L('Resolve Fault'))}</button></form>`:''}
      </div>
      ` : ''}
      <details class="ps-panel"><summary>${esc(L('Details'))}</summary>
        <p class="ps-id" dir="ltr">${esc(session.assetUuid)}</p>
        ${['electricity','water'].map(type => `<p class="ps-id" dir="ltr">${esc(s[type].meterId)}</p>`).join('')}
        <p class="ps-note">${esc(L('First reading establishes the baseline.'))}</p>
        <p class="ps-note">${esc(L('Offline means communication is unavailable; it does not prove the supply has failed.'))}</p>
      </details>
      <details class="ps-panel"><summary>${esc(L('Recent test events'))} · ${esc(number(session.eventCount))}</summary>
        <div class="ps-actions"><button id="psRefresh" ${busy?'disabled':''}>${esc(L('Refresh Test'))}</button>
        <button id="psReplay" ${busy || pending || !lastEvent?'disabled':''}>${esc(L('Replay Last Event'))}</button></div>
        <ol class="ps-events">${[...session.events].reverse().map(e => `<li><strong>${esc(L(e.action))}</strong> ${esc(e.utilityType || '')} ${e.value == null?'':esc(number(e.value))}<br><small>${esc(stamp(e.recordedAt))}</small><br><code dir="ltr">${esc(e.eventId)}</code></li>`).join('')}</ol>
      </details>`:''}`}`;
    root.querySelector('#psBack').onclick = () => {location.hash = '#/berths';};
    root.querySelector('#psHelp').onclick = showHelp;
    root.querySelector('#psRetry')?.addEventListener('click', () => run(pending));
    root.querySelector('#psBerth')?.addEventListener('change', event => {selectedBerth = event.target.value;});
    root.querySelector('#psStart')?.addEventListener('click', () => {
      const berthDocId = root.querySelector('#psBerth').value;
      run({name:'createPedestalTest', args:{berthDocId, idempotencyKey:key()}});
    });
    root.querySelectorAll('[data-action]').forEach(button => button.onclick = () => send({action:button.dataset.action}));
    root.querySelectorAll('form[data-meter]').forEach(form => form.onsubmit = event => {
      event.preventDefault(); send({action:'READING',utilityType:form.dataset.meter,value:Number(form.elements.value.value)});
    });
    root.querySelectorAll('form[data-workflow]').forEach(form => form.onsubmit = event => {
      event.preventDefault(); const data = Object.fromEntries(new FormData(form)); send({action:form.dataset.workflow,...data});
    });
    root.querySelector('#psReplay')?.addEventListener('click', () => run({name:'applyPedestalTestEvent',args:{sessionId:session.sessionId,event:lastEvent}}));
    root.querySelector('#psRefresh')?.addEventListener('click', () => run({name:'getPedestalFoundation',args:{sessionId:session.sessionId}}));
  }
  function send(fields) {
    run({name:'applyPedestalTestEvent',args:{sessionId:session.sessionId,event:{schemaVersion:1,eventId:key(),...fields}}});
  }
  async function run(request) {
    if (!request || busy || !active()) return;
    busy = true; failure = false; status = L('Loading…'); render();
    try {
      const data = await call(request.name,request.args);
      if (!active()) return;
      session = data;
      if (request.name === 'createPedestalTest') lastEvent = null;
      if (request.args.event) lastEvent = request.args.event;
      pending = null;
      try {sessionStorage.setItem(memoryKey, data.sessionId);} catch {}
      status = L(data.duplicate ? 'Duplicate ignored. Consumption and workflow unchanged.' :
        request.name === 'createPedestalTest' ? 'Test pedestal created.':'Test event recorded.');
    } catch (error) {
      if (!active()) return;
      // Only ambiguous transport failures retain the exact key for safe retry.
      pending = ['functions/unavailable','functions/internal','functions/deadline-exceeded','functions/unknown'].includes(error.code) ? request : null;
      failure = true; status = `${pending ? L('Request failed. You can retry the same request.') : ''} ${error.message || L('Test not deployed yet or backend unavailable.')}`;
    } finally {busy = false; render();}
  }
  function showHelp() {
    const backdrop = document.createElement('div'); backdrop.className = 'help-backdrop';
    const dialog = document.createElement('div'); dialog.className = 'help-dialog'; dialog.role = 'dialog';
    dialog.setAttribute('aria-modal','true'); dialog.setAttribute('aria-label',L('Pedestal Simulator'));
    const paragraph = (en,ar) => `<p>${esc(getLocale().startsWith('ar')?ar:en)}</p>`;
    dialog.innerHTML = `<div class="help-scroll"><div class="help-pill">${esc(L('Pedestal Simulator'))}</div>
      ${paragraph('This is a vendor-neutral test foundation. No manufacturer API or hardware control is connected.','هذا أساس تجريبي مستقل عن المورد. لا توجد واجهة برمجية لمصنع أو تحكم بالأجهزة.')}
      ${paragraph('Choose a berth and start a test. Enter 1,000 kWh, then 1,025 kWh: the test consumption becomes 25 kWh. Water uses litres and its own meter.','اختر رصيفاً وابدأ اختباراً. أدخل 1000 ثم 1025 كيلوواط ساعة: يصبح الاستهلاك التجريبي 25 كيلوواط ساعة. تستخدم المياه اللترات وعدّاداً منفصلاً.')}
      ${paragraph('Report a fault, record an inspection, assign a test repair label and record completion. These steps never create live inspections, tasks or staff notifications.','أبلغ عن عطل وسجّل فحصاً وعيّن اسماً تجريبياً للإصلاح وسجّل الإكمال. لا تُنشئ هذه الخطوات فحوصات أو مهام أو إشعارات فعلية.')}
      ${paragraph('Replay the last event to demonstrate duplicate protection. Offline records communication loss; a heartbeat restores communication but does not resolve a fault.','أعد إرسال الحدث الأخير لإظهار منع التكرار. يسجل عدم الاتصال فقدان التواصل؛ وتستعيد إشارة الاتصال التواصل دون إغلاق العطل.')}
      ${paragraph('Meter decreases are rejected. Start a new test for a meter reset. Each test permits 100 events and displays the most recent 30. Elapsed time measures report-to-resolution in this test, not technician labour.','تُرفض القراءات المتناقصة. ابدأ اختباراً جديداً عند إعادة ضبط العداد. يسمح كل اختبار بمئة حدث ويعرض آخر ثلاثين. تقيس المدة وقت الإبلاغ إلى الحل في الاختبار، وليست ساعات عمل الفني.')}
      ${paragraph('Real integrations will require supplier access, device registration and validation. Live billing will also need readings aligned with vessel berth-assignment intervals.','تتطلب عمليات التكامل الفعلية وصولاً من المورد وتسجيل الأجهزة والتحقق. وتتطلب الفوترة الفعلية مواءمة القراءات مع فترات تخصيص الرصيف للسفن.')}
      </div><div class="help-actions"><button class="help-gotit">${esc(L('Got it'))}</button></div>`;
    (document.getElementById('modalRoot') || document.body).append(backdrop,dialog);
    requestAnimationFrame(() => {backdrop.classList.add('is-open');dialog.classList.add('is-open');});
    const opener = root.querySelector('#psHelp');
    const close = () => {backdrop.remove();dialog.remove();window.removeEventListener('hashchange',close);document.removeEventListener('keydown',keys);if(active())opener.focus();};
    const keys = event => {if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){event.preventDefault();dialog.querySelector('button').focus();}};
    backdrop.onclick = close; dialog.querySelector('button').onclick = close;
    window.addEventListener('hashchange',close);document.addEventListener('keydown',keys);dialog.querySelector('button').focus();
  }
  render();
  if (store.activeRole !== 'admin') {status = L('Only marina administrators can run this simulator.');render();return;}
  busy = true;
  call('getPedestalFoundation',{}).then(async data => {
    if (!active()) return;
    berths = data.berths; truncated = data.truncated; selectedBerth = berths[0]?.docId || '';
    let saved;
    try {saved = sessionStorage.getItem(memoryKey);} catch {}
    if (saved) {
      try {session = await call('getPedestalFoundation',{sessionId:saved});}
      catch {try {sessionStorage.removeItem(memoryKey);} catch {}}
    }
    status = '';
  }).catch(error => {failure=true;status=error.message || L('Test not deployed yet or backend unavailable.');})
    .finally(() => {busy=false;render();});
}
