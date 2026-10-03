import { t, getLanguage } from '../i18n.js';
import { store } from '../store.js';
import { auth } from '../firebase.js';
import { loadUserProfile, saveOwnProfile } from '../auth.js';
import { toast } from '../ui/toast.js';

const label = (en, ar) => getLanguage() === 'ar' ? ar : en;
export async function showEditProfileSheet(onSaved) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  let profile;
  try { profile = await loadUserProfile(auth.currentUser); }
  catch (error) { toast(label('Could not load profile', 'تعذر تحميل الملف الشخصي'), { kind:'error' }); return; }
  if (!profile || auth.currentUser?.uid !== uid) return;
  const parts = String(profile.name || '').trim().split(/\s+/);
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;min-height:48px;background:var(--color-surface,#1C222A);">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${t('Edit Profile')}</div>
      <button type="button" id="epClose" aria-label="${t('Close')}" style="position:absolute;inset-inline-end:0;top:2px;width:44px;height:44px;border:0;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <form id="epForm" class="add-form">
      <div class="add-scroll">
        <label class="add-label" for="epFirst">${label('First name','الاسم الأول')}</label>
        <input class="add-input" id="epFirst" autocomplete="given-name" maxlength="100" required>
        <label class="add-label" for="epLast">${label('Last name','اسم العائلة')}</label>
        <input class="add-input" id="epLast" autocomplete="family-name" maxlength="100">
        <label class="add-label" for="epEmail">${t('Email')}</label>
        <input class="add-input" id="epEmail" type="email" dir="ltr" readonly>
        <p style="color:var(--color-text-secondary,#AEB6C1);font-size:12px;">${label('Your sign-in email is read-only here.','البريد الإلكتروني لتسجيل الدخول للقراءة فقط هنا.')}</p>
        <label class="add-label" for="epPhone">${label('Phone, including country code','الهاتف مع رمز الدولة')}</label>
        <input class="add-input" id="epPhone" type="tel" dir="ltr" autocomplete="tel" maxlength="40">
        <p id="epError" role="alert" style="color:#F44336;"></p>
      </div>
      <button type="submit" class="add-save" id="epSave">${t('Save')}</button>
    </form>`;
  const $ = id => sheet.querySelector('#' + id);
  $('epFirst').value = parts.shift() || '';
  $('epLast').value = parts.join(' ');
  $('epEmail').value = profile.email || auth.currentUser.email || '';
  $('epPhone').value = profile.phone || '';
  let saving = false;
  const close = () => {
    if (saving) return;
    backdrop.classList.remove('is-open'); sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };
  backdrop.addEventListener('click', close);
  $('epClose').addEventListener('click', close);
  $('epForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || auth.currentUser?.uid !== uid) return;
    const first = $('epFirst').value.trim();
    const name = [first, $('epLast').value.trim()].filter(Boolean).join(' ');
    if (!first || name.length > 100) { $('epError').textContent = label('Enter a name of up to 100 characters.','أدخل اسماً لا يتجاوز 100 حرف.'); return; }
    saving = true; $('epSave').disabled = true; $('epClose').disabled = true; $('epError').textContent = '';
    try {
      const updated = await saveOwnProfile({ name, phone:$('epPhone').value });
      if (auth.currentUser?.uid === uid) {
        store.userProfile = { ...store.userProfile, ...updated, role:store.activeRole || updated.role };
        store.emit();
        saving = false; close(); onSaved?.();
        toast(label('Profile updated','تم تحديث الملف الشخصي'), {kind:'success'});
      } else { saving = false; close(); }
    } catch (error) {
      console.error('[edit profile]', error);
      $('epError').textContent = label('Could not save profile. Please try again.','تعذر حفظ الملف الشخصي. حاول مرة أخرى.');
    } finally { saving = false; $('epSave').disabled = false; $('epClose').disabled = false; }
  });
  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => { backdrop.classList.add('is-open'); sheet.classList.add('is-open'); });
}
