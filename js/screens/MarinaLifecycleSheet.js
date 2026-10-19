import {getLanguage} from '../i18n.js';
import {esc} from '../utils.js';

export const lifecycleText = (en, ar) => getLanguage() === 'ar' ? ar : en;
export function confirmMarinaLifecycle(preview, action) {
  const deleting = action === 'DELETE';
  const restoring = action === 'RESTORE';
  const text = deleting ? lifecycleText('Delete marina', 'حذف المارينا') : restoring ? lifecycleText('Restore marina', 'استعادة المارينا') : lifecycleText('Archive marina', 'أرشفة المارينا');
  return new Promise(resolve => {
    const backdrop = document.createElement('div'); backdrop.className = 'confirm-backdrop';
    const sheet = document.createElement('div'); sheet.className = `confirm-sheet marina-lifecycle-confirm ${deleting ? '' : 'marina-lifecycle-safe'}`;
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', text);
    const prior = document.activeElement;
    const icon = deleting ? '<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>' : restoring ? '<path d="M4 8h16v13H4zM3 3h18v5H3zM12 17v-6m-3 3 3-3 3 3"/>' : '<path d="M4 8h16v13H4zM3 3h18v5H3zM9 12h6"/>';
    const svg = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
    sheet.innerHTML = `<div class="confirm-handle"></div><div class="confirm-warn-circle">${svg}</div>
      <div class="confirm-title">${esc(text)}: ${esc(preview.name)}</div>
      <div class="confirm-message">${esc(deleting ? lifecycleText('Permanently delete this test marina and its linked Firestore records, nested records, memberships, invites and procedure files. This cannot be undone. Shared user accounts and other marinas are kept. Files on devices or external services are not removed.', 'حذف مارينا الاختبار وبياناتها المرتبطة وسجلاتها الفرعية والعضويات والدعوات وملفات الإجراءات نهائياً. لا يمكن التراجع. تبقى حسابات المستخدمين المشتركة والمارينات الأخرى. لن تُحذف الملفات الموجودة على الأجهزة أو الخدمات الخارجية.') : restoring ? lifecycleText('Return this marina to the active list, with its existing history and memberships.', 'إعادة المارينا إلى القائمة النشطة مع سجلها وعضوياتها الحالية.') : lifecycleText('Remove this marina from active operations. Keep its records, procedures and memberships. You can restore it here later.', 'إزالة المارينا من العمليات النشطة مع الاحتفاظ بسجلاتها وإجراءاتها وعضوياتها. يمكن استعادتها هنا لاحقاً.'))}</div>
      ${deleting ? `<div class="ml-delete-fields">${preview.countsAvailable === false ? '' : `<p>${lifecycleText('Linked top-level records found', 'السجلات المرتبطة المكتشفة')}: ${preview.counts.reduce((sum, row) => sum + row.records, 0)}. ${lifecycleText('Nested records and procedure files are additional.', 'السجلات الفرعية وملفات الإجراءات إضافية.')}</p>`}
        <label for="mlName">${lifecycleText('Type the marina name exactly', 'اكتب اسم المارينا تماماً')}<input class="add-input" id="mlName" autocomplete="off"></label>
        <label class="ml-check"><input type="checkbox" id="mlTest">${lifecycleText('I confirm this marina contains disposable test data only.', 'أؤكد أن هذه المارينا تحتوي على بيانات اختبار قابلة للحذف فقط.')}</label></div>` : ''}
      <div class="confirm-actions"><button class="confirm-btn confirm-btn--cancel" type="button">${lifecycleText('Cancel', 'إلغاء')}</button><button class="confirm-btn confirm-btn--confirm" type="button" ${deleting ? 'disabled' : ''}>${svg}<span>${esc(text)}</span></button></div>`;
    let closed = false;
    function close(value) {
      if (closed) return; closed = true; document.removeEventListener('keydown', keys);
      backdrop.remove(); sheet.remove(); if (prior?.isConnected) prior.focus(); resolve(value);
    }
    function keys(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(null); }
      if (event.key !== 'Tab') return;
      const items = [...sheet.querySelectorAll('button:not(:disabled),input')];
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    sheet.querySelector('.confirm-btn--cancel').onclick = () => close(null);
    sheet.querySelector('.confirm-btn--confirm').onclick = () => close({confirmationName: deleting ? sheet.querySelector('#mlName').value : '', confirmTestData: deleting});
    if (deleting) {
      const validate = () => { sheet.querySelector('.confirm-btn--confirm').disabled = sheet.querySelector('#mlName').value !== preview.name || !sheet.querySelector('#mlTest').checked; };
      sheet.querySelector('#mlName').oninput = validate; sheet.querySelector('#mlTest').onchange = validate;
    }
    backdrop.onclick = () => close(null); document.addEventListener('keydown', keys);
    document.getElementById('modalRoot').append(backdrop, sheet);
    requestAnimationFrame(() => { if (closed) return; backdrop.classList.add('is-open'); sheet.classList.add('is-open'); sheet.querySelector(deleting ? '#mlName' : '.confirm-btn--cancel').focus(); });
  });
}
