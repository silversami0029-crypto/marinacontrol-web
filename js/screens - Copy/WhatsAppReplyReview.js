import {collection, query, where, onSnapshot} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {getFunctions, httpsCallable} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import {db} from '../firebase.js';
import {store} from '../store.js';
import {t, getLocale} from '../i18n.js';
import {toast} from '../ui/toast.js';
import {confirmSheet} from '../ui/confirm.js';

const reviewReply = httpsCallable(getFunctions(undefined, 'us-central1'), 'reviewWhatsAppReply');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits = value => String(value || '').replace(/\D/g, '');
const date = value => value ? new Date(Number(value)).toLocaleDateString(getLocale(), {day:'numeric',month:'short',year:'numeric'}) : '';

export function mountWhatsAppReplyReview(host) {
  const clientId = Number(store.activeClientId);
  let replies = [], busy = false;
  host.innerHTML = `<style>
    .wrr{margin:12px 0 18px;border:1px solid #465567;border-radius:12px;padding:14px;background:#1c222a;color:#f5f7f9}
    .wrr h3{margin:0 0 8px;font-size:16px}.wrr p{font-size:13px;line-height:1.5}.wrr article{padding:14px 0;border-top:1px solid #394654}
    .wrr pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:14px;background:#111923;padding:12px;border-radius:8px}
    .wrr select{width:100%;box-sizing:border-box;background:#111923;color:#f5f7f9;border:1px solid #657587;padding:10px;border-radius:8px;margin:8px 0}
    .wrr button{background:#283442;color:#f5f7f9;border:1px solid #657587;border-radius:8px;min-height:44px;padding:10px 14px;cursor:pointer;font:inherit}
    .wrr button[data-action=LINK]{background:#258be0;border-color:#258be0}.wrr button:disabled{opacity:.45;cursor:not-allowed}
    .wrr .wrr-actions{display:flex;flex-wrap:wrap;gap:10px}.wrr button:focus-visible,.wrr select:focus-visible{outline:2px solid #2e9bff;outline-offset:2px}
  </style><section class="wrr"><h3>${t('Replies needing review')} <span data-count></span></h3><p>${t('These replies could not be matched safely. Linking a reply does not accept dates or approve a booking.')}</p><div data-items>${t('Loading…')}</div></section>`;
  function render() {
    if (!host.isConnected || Number(store.activeClientId) !== clientId) return;
    host.querySelector('[data-count]').textContent = `· ${replies.length}`;
    host.querySelector('[data-items]').innerHTML = replies.length ? replies.map((r, index) => {
      const choices = (store.bookingRequests || []).filter(b => Number(b.clientId) === clientId && digits(b.senderPhone) === digits(r.senderPhone) && b.dateProposal?.state === 'PENDING' && b.dateProposal?.delivery === 'SENT');
      return `<article data-index="${index}"><b>${esc(r.senderPhone)}</b> · ${esc(date(r.receivedAt))}<pre>${esc(r.message)}</pre>
        <label for="wrr-${index}">${t('Choose the correct enquiry from this sender')}</label>
        <select id="wrr-${index}" ${busy ? 'disabled' : ''}><option value="">${t('Select an enquiry…')}</option>${choices.map(b => `<option value="${esc(b._docId)}">${esc(b.vesselName || t('Unknown vessel'))} · ${esc(date(b.dateProposal.arrivalDate))} → ${esc(date(b.dateProposal.departureDate))} · ${esc(b.requestUuid || b._docId)}</option>`).join('')}</select>
        ${choices.length ? '' : `<p>${t('No sent, pending date proposal for this sender. Check the booking requests before linking.')}</p>`}
        <div class="wrr-actions"><button type="button" data-action="LINK" ${busy || !choices.length ? 'disabled' : ''}>${t('Link reply')}</button><button type="button" data-action="DISMISS" ${busy ? 'disabled' : ''}>${t('Mark as unrelated')}</button></div></article>`;
    }).join('') : `<p>${t('No unmatched replies awaiting review.')}</p>`;
  }
  host.onclick = async event => {
    const button = event.target.closest('button[data-action]');
    if (!button || busy || Number(store.activeClientId) !== clientId) return;
    const article = button.closest('article');
    const reply = replies[Number(article.dataset.index)];
    const action = button.dataset.action;
    const requestId = article.querySelector('select').value;
    if (action === 'LINK' && !requestId) {article.querySelector('select').focus();toast(t('Choose an enquiry first'), {kind:'error'});return;}
    busy = true;
    host.querySelectorAll('button,select').forEach(el => el.disabled = true);
    try {
      const ok = await confirmSheet({title:t(action === 'LINK' ? 'Link owner reply' : 'Mark reply as unrelated'),message:t(action === 'LINK' ? 'Link this reply to the selected enquiry? Check the vessel and dates. Acceptance and booking approval remain separate.' : 'Remove this reply from the review queue? Its record will be retained.'),confirmText:t('Confirm'),cancelText:t('Cancel')});
      if (!ok || Number(store.activeClientId) !== clientId || !host.isConnected) return;
      await reviewReply({clientId, reviewId:reply._docId, requestId, action});
      toast(t(action === 'LINK' ? 'Reply linked. Review it before recording acceptance.' : 'Reply marked as unrelated.'), {kind:'success'});
    } catch (error) {toast(error.message || t('Could not review reply'), {kind:'error'});}
    finally {busy = false;render();}
  };
  const unsubscribe = onSnapshot(query(collection(db, 'whatsapp_reply_review'), where('clientId', '==', clientId)), snap => {
    replies = snap.docs.map(d => ({...d.data(),_docId:d.id})).filter(r => r.status === 'NEEDS_REVIEW').sort((a,b) => Number(b.receivedAt)-Number(a.receivedAt));render();
  }, error => {if(host.isConnected)host.querySelector('[data-items]').textContent = t('Could not load replies needing review. Check access and retry.');console.error('[reply review]',error.code);});
  const observer = new MutationObserver(() => {if (!host.isConnected) {unsubscribe();observer.disconnect();}});
  observer.observe(document.getElementById('screen'), {childList:true,subtree:true});
  return render;
}
