import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/AboutSheet.js

const APP_NAME = 'MarinaControl';
const EXTERNAL_URL = 'https://sites.google.com/view/fethiyemarina/home/';

export function showAboutSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>

    <div class="about-body">
      <div class="about-logo">
        <img src="assets/logo.png" alt="MarinaControl" onerror="this.style.display='none'">
      </div>

      <div class="about-name">${APP_NAME}</div>
 

      <div class="about-desc">${tr("MarinaControl gives marinas a single place to manage boats, berths, crew and customers — from daily operations to compliance.")}</div>

      <div class="about-divider"></div>

      <div class="about-links">
        <button type="button" class="about-link" id="aboutTerms">${tr("Terms")}</button>
        <div class="about-link-sep"></div>
        <button type="button" class="about-link" id="aboutPrivacy">${tr("Privacy")}</button>
      </div>

           <button type="button" class="about-close" id="aboutClose">${tr("Close")}</button>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);
  sheet.querySelector('#aboutClose').addEventListener('click', close);

  sheet.querySelector('#aboutTerms').addEventListener('click', () => {
    window.open(EXTERNAL_URL, '_blank', 'noopener');
  });

  sheet.querySelector('#aboutPrivacy').addEventListener('click', () => {
    window.open(EXTERNAL_URL, '_blank', 'noopener');
  });
}