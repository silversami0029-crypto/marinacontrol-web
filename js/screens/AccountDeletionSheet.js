import { auth, app } from '../firebase.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { toast } from '../ui/toast.js';
import { sheetCloseButton } from '../ui/sheetClose.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export async function showAccountDeletionSheet() {
  const user = auth.currentUser, uid = user?.uid;
  if (!uid || uid !== store.authUser?.uid) { toast(t('Sign in before deleting your account.'), { kind: 'error' }); return; }
  const root = document.getElementById('modalRoot');
  if (root.querySelector('[data-account-deletion]')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.dataset.accountDeletion = '1';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  const passwordProvider = user.providerData?.some(provider => provider.providerId === 'password');
  sheet.innerHTML = `${sheetCloseButton()}
    <div class="sheet-title" data-deletion-title></div>
    <div class="add-scroll">
      <p data-retention></p><p role="status" data-deletion-status></p>
      <ul data-deletion-blockers></ul>
      <form data-deletion-form hidden>
        <label class="add-label" data-password-label><span data-password-text></span>
          <input class="add-input" type="password" name="password" autocomplete="current-password" maxlength="128">
        </label>
        <label class="add-checkbox"><input name="confirm" type="checkbox" required><span data-confirm-text></span></label>
        <p role="alert" data-deletion-error style="color:#ff9999"></p>
        <button type="submit" class="add-save" data-delete-submit style="background:#ff4444;color:white"></button>
      </form>
    </div>
    <button type="button" class="md-close-btn" data-deletion-close></button>`;
  sheet.querySelector('[data-deletion-title]').textContent = t('Delete account');
  sheet.querySelector('[data-retention]').textContent = t('Delete your login, personal profile and access to all marinas. Shared marina records, including maintenance, inspections, invoices and their audit history, are retained. A minimal deletion/access record is retained to prevent old access from being restored.');
  sheet.querySelector('[data-deletion-status]').textContent = t('Checking your account and administrator responsibilities…');
  sheet.querySelector('[data-password-text]').textContent = t('Verify your current password');
  sheet.querySelector('[data-confirm-text]').textContent = t('I understand that my account will be deleted permanently and shared marina records will remain.');
  sheet.querySelector('[data-delete-submit]').textContent = t('Permanently delete my account');
  sheet.querySelector('[data-deletion-close]').textContent = t('Cancel');
  const password = sheet.querySelector('[name=password]');
  sheet.querySelector('[data-password-label]').hidden = !passwordProvider;
  password.required = !!passwordProvider;
  root.append(backdrop, sheet);
  requestAnimationFrame(() => { backdrop.classList.add('is-open'); sheet.classList.add('is-open'); });
  let closed = false, busy = false;
  const current = () => !closed && sheet.isConnected && auth.currentUser?.uid === uid && store.authUser?.uid === uid;
  const close = () => {
    if (busy) return;
    closed = true;
    password.value = '';
    backdrop.classList.remove('is-open'); sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };
  backdrop.addEventListener('click', close);
  sheet.querySelector('[data-sheet-close]').onclick = close;
  sheet.querySelector('[data-deletion-close]').onclick = close;
  const functions = getFunctions(app, 'us-central1');
  const call = (name, data) => httpsCallable(functions, name)(data);
  const finish = async status => {
    if (!current()) return;
    password.value = '';
    let signedOut = true;
    try { await signOut(auth); } catch { signedOut = false; }
    busy = false;
    close();
    toast(t(!signedOut ? 'Account deletion was accepted. Sign out of this browser manually.'
      : status === 'DONE' ? 'Your account has been deleted.' : 'Account deletion requested. Your account is being removed; background cleanup will finish automatically.'),
      { kind: signedOut ? 'success' : 'error', duration: 7000 });
  };
  try {
    const { data } = await call('getAccountDeletionPreview', {});
    if (!current()) return;
    if (['PENDING', 'DONE'].includes(data.status)) { await finish(data.status); return; }
    const status = sheet.querySelector('[data-deletion-status]');
    status.textContent = data.canDelete
      ? t('Your account can be deleted. This affects your access to every marina, not only the selected marina.')
      : t('Account deletion is blocked until the following responsibilities are resolved:');
    for (const blocker of data.blockers || []) {
      const item = document.createElement('li');
      item.textContent = `${blocker.name}: ${blocker.reason}`;
      sheet.querySelector('[data-deletion-blockers]').append(item);
    }
    sheet.querySelector('[data-deletion-form]').hidden = !data.canDelete;
  } catch (error) {
    if (current()) sheet.querySelector('[data-deletion-status]').textContent = error.code === 'functions/not-found'
      ? t('Account deletion is not deployed yet. No account data has been changed.')
      : error.message || t('Could not check account deletion. No account data has been changed.');
  }
  sheet.querySelector('[data-deletion-form]').onsubmit = async event => {
    event.preventDefault();
    if (busy || !current() || !sheet.querySelector('[name=confirm]').checked) return;
    const errorEl = sheet.querySelector('[data-deletion-error]');
    errorEl.textContent = '';
    busy = true;
    const buttons = [...sheet.querySelectorAll('button')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      if (passwordProvider) {
        const credential = EmailAuthProvider.credential(user.email, password.value);
        await reauthenticateWithCredential(user, credential);
        password.value = '';
        await user.getIdToken(true);
      }
      if (!current()) return;
      const { data } = await call('deleteMyAccount', { confirm: true, expectedUid: uid });
      if (!['PENDING', 'DONE'].includes(data.status)) throw new Error(t('Could not confirm the deletion request. Please try again.'));
      await finish(data.status);
    } catch (error) {
      if (current()) errorEl.textContent = String(error.code || '').startsWith('auth/')
        ? t('Password verification failed. Check your password, or sign in again and retry.')
        : error.message || t('Could not request account deletion. Please retry.');
    } finally {
      password.value = '';
      busy = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  };
}
