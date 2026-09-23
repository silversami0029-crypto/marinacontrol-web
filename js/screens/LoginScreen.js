// js/screens/LoginScreen.js
// Mirrors activity_login.xml + LoginActivity.handleSignIn()

import { login, resetPassword, friendlyError } from '../auth.js';

const LOGO_SVG = `
<div class="login-logo-circle">
  <img src="assets/icons/marina_logo.png" alt="Marina Control">
</div>`;

export function mountLoginScreen() {
  const screen = document.getElementById('screen');

  // Hide topbar + bottomnav on login
  document.getElementById('topbar').style.display = 'none';
  document.getElementById('bottomnav').style.display = 'none';

  screen.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">${LOGO_SVG}</div>

        <h1 class="login-title">Welcome Back</h1>
        <p class="login-subtitle">Sign in to continue</p>

        <form id="loginForm" autocomplete="on">
          <div class="login-field">
            <input id="loginEmail" type="email" placeholder="Email"
                   autocomplete="email" required>
          </div>

          <div class="login-field">
            <input id="loginPassword" type="password" placeholder="Password"
                   autocomplete="current-password" required>
            <button type="button" class="login-pw-toggle" id="pwToggle"
                    aria-label="Show password">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                   stroke="currentColor" stroke-width="1.8"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>

          <div class="login-forgot">
            <button type="button" id="forgotBtn">Reset password?</button>
          </div>

          <div class="login-error" id="loginError" hidden></div>

          <button type="submit" class="login-submit" id="loginSubmit">
            Sign In
          </button>

          <div class="login-spinner" id="loginSpinner" hidden>
            <div class="spinner-ring"></div>
          </div>
        </form>

        <div class="login-divider"></div>

        <button type="button" class="login-secondary" id="joinBtn">
          Join Existing Marina
        </button>

       <p class="login-terms">
  By continuing, you agree to the<br>
  <a href="#" onclick="return false;">Terms of Use</a>
  and
  <a href="#" onclick="return false;">Privacy Policy</a>
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
    toggle.setAttribute('aria-label', isPw ? 'Hide password' : 'Show password');
  });

  // Reset password
  forgot.addEventListener('click', async () => {
    const e = email.value.trim();
    if (!e) {
      email.focus();
      showErr('Enter your email address first.');
      return;
    }
    try {
      await resetPassword(e);
      showErr('Password reset email sent.', 'ok');
    } catch (err) {
      showErr(friendlyError(err));
    }
  });

  // Join marina (stub for now)
  join.addEventListener('click', () => {
    showErr('Join by invite code coming soon.', 'ok');
  });

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;

    const e1 = email.value.trim();
    const p1 = password.value;

    if (!e1) { email.focus();  showErr('Email is required.'); return; }
    if (!p1) { password.focus(); showErr('Password is required.'); return; }

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

  if (on) {
    submit.style.display = 'none';
    spinner.hidden = false;
  } else {
    submit.style.display = '';
    submit.textContent = 'Sign In';
    spinner.hidden = true;
  }
}

  function showErr(msg, kind = 'error') {
    errEl.textContent = msg;
    errEl.hidden = false;
    errEl.dataset.kind = kind;
  }
}