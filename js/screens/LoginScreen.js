import { italianUI as itUI } from '../i18n.js';
import { t, getLocale, languagePicker } from '../i18n.js';
// js/screens/LoginScreen.js
// Mirrors activity_login.xml + LoginActivity.handleSignIn()

import { login, resetPassword, friendlyError, joinMarinaWithCode } from '../auth.js';

const LOGO_SVG = `
<div class="login-logo-circle">
  <img src="assets/icons/marina_logo.png" alt="Marina Control">
</div>`;

export function mountLoginScreen() {
  const screen = document.getElementById('screen');

  // Hide topbar + bottomnav on login
 for (const id of ['topbar', 'bottomnav']) {
  const element = document.getElementById(id);
  if (element) element.style.display = 'none';
}

  screen.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        ${languagePicker()}
        <div class="login-logo">${LOGO_SVG}</div>

        <h1 class="login-title">${t("Welcome Back")}</h1>
        <p class="login-subtitle">${t("Sign in to continue")}</p>

        <form id="loginForm" autocomplete="on">
          <div class="login-field">
            <input id="loginEmail" type="email" placeholder="${t("Email")}"
                   autocomplete="email" required>
          </div>

          <div class="login-field">
            <input id="loginPassword" type="password" placeholder="${t("Password")}"
                   autocomplete="current-password" required>
            <button type="button" class="login-pw-toggle" id="pwToggle"
                    aria-label="${t("Show password")}">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                   stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>

          <div class="login-forgot">
            <button type="button" id="forgotBtn">${t("Reset password?")}</button>
          </div>

          <div class="login-error" id="loginError" hidden></div>

          <button type="submit" class="login-submit" id="loginSubmit">${t("Sign In")}</button>

          <div class="login-spinner" id="loginSpinner" hidden>
            <div class="spinner-ring"></div>
          </div>
        </form>

        <div class="login-divider"></div>

        <button type="button" class="login-secondary" id="joinBtn">${t("Join Existing Marina")}</button>

       <p class="login-terms">${t("By continuing, you agree to the")}<br>
  <a href="#" onclick="return false;">${t("Terms of Use")}</a> ${t("and")} <a href="#" onclick="return false;">${t("Privacy Policy")}</a>
</p>
      </div>
    </div>
  `;

  wireLoginForm();
}

function wireLoginForm() {
  const form     = document.getElementById('loginForm');
  const email    = document.getElementById('loginEmail');
  const password = document.getElementById('loginPassword');
  const submit   = document.getElementById('loginSubmit');
  const spinner  = document.getElementById('loginSpinner');
  const errEl    = document.getElementById('loginError');
  const toggle   = document.getElementById('pwToggle');
  const forgot   = document.getElementById('forgotBtn');
  const join     = document.getElementById('joinBtn');

  // Password visibility toggle
  toggle.addEventListener('click', () => {
    const isPw = password.type === 'password';
    password.type = isPw ? 'text' : 'password';
    toggle.setAttribute('aria-label', isPw ? t("Hide password") : t("Show password"));
  });

  // Reset password
  forgot.addEventListener('click', async () => {
    const e = email.value.trim();
    if (!e) {
      email.focus();
      showErr(itUI('Enter your email address first.'));
      return;
    }
    try {
      await resetPassword(e);
      showErr(itUI('Password reset email sent.'), 'ok');
    } catch (err) {
      showErr(friendlyError(err));
    }
  });

  join.addEventListener('click', () => {
    if (document.getElementById('joinMarinaDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'joinMarinaDialog';
    dialog.style.cssText = 'color:#fff;background:#1c252e;border:1px solid #586675;border-radius:16px;padding:24px;width:min(420px,90vw);box-sizing:border-box';
    dialog.innerHTML = `
      <h2>Join Existing Marina</h2>
      <p>Use an invite code provided by your marina administrator.</p>
      <form id="joinMarinaForm">
        <div class="login-field"><input name="inviteCode" placeholder="Invite code" aria-label="Invite code" required></div>
        <div class="login-field"><input name="displayName" placeholder="Full name" aria-label="Full name" autocomplete="name" required maxlength="100"></div>
        <div class="login-field"><input name="email" type="email" placeholder="Email" aria-label="Email" autocomplete="email" required></div>
        <div class="login-field"><input name="password" type="password" placeholder="Password" aria-label="Password" autocomplete="current-password" required minlength="6"></div>
        <p id="joinMarinaError" role="alert" hidden></p>
        <button type="submit" class="login-submit">Join Marina</button>
        <button type="button" class="login-secondary" id="cancelJoinMarina" style="margin-top:12px">Cancel</button>
      </form>`;
    document.body.append(dialog);
    const joinForm = dialog.querySelector('form');
    joinForm.elements.email.value = email.value.trim();
    const message = dialog.querySelector('#joinMarinaError');
    const confirm = joinForm.querySelector('[type="submit"]');
    const cancel = dialog.querySelector('#cancelJoinMarina');
    let busy = false;
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    cancel.addEventListener('click', () => dialog.close());
    joinForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !joinForm.reportValidity()) return;
      const values = Object.fromEntries(new FormData(joinForm));
      busy = true;
      message.hidden = true;
      for (const field of joinForm.elements) field.disabled = true;
      confirm.textContent = 'Joining…';
      try {
        await joinMarinaWithCode(values);
        // Restart with refreshed claims and reload the authorised marina list.
        location.reload();
      } catch (error) {
        console.error('[join marina]', error.code || 'join-failed');
        const authError = String(error.code || '').startsWith('auth/');
        message.textContent = authError ? friendlyError(error)
          : (error.message || 'Unable to join marina. Please try again.');
        message.hidden = false;
        busy = false;
        for (const field of joinForm.elements) field.disabled = false;
        confirm.textContent = 'Join Marina';
      }
    });
    dialog.showModal();
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;

    const e1 = email.value.trim();
    const p1 = password.value;

    if (!e1) { email.focus();  showErr(itUI('Email is required.')); return; }
    if (!p1) { password.focus(); showErr(itUI('Password is required.')); return; }

    setLoading(true);

    try {
      await login(e1, p1);
      // Router will pick up the auth state change and reroute.
    } catch (err) {
      setLoading(false);
      showErr(friendlyError(err));
    }
  });

function setLoading(on) {
  submit.disabled = on;
  email.disabled = on;
  password.disabled = on;
  toggle.disabled = on;
  join.disabled = on;
  forgot.disabled = on;

  if (on) {
    submit.style.display = 'none';
    spinner.hidden = false;
  } else {
    submit.style.display = '';
    submit.textContent = t("Sign In");
    spinner.hidden = true;
  }
}

  function showErr(msg, kind = 'error') {
    errEl.textContent = msg;
    errEl.hidden = false;
    errEl.dataset.kind = kind;
  }
}