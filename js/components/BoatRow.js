// js/components/BoatRow.js
// Renders one row exactly mirroring item_boat.xml (with bulk-mode checkbox)

import { esc } from '../utils.js';

const ICON_PERSON = `
<svg class="icon" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="8" r="4"/>
  <path d="M4 21a8 8 0 0 1 16 0"/>
</svg>`;

const ICON_LOCATION = `
<svg class="icon" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 22s7-7.6 7-13a7 7 0 1 0-14 0c0 5.4 7 13 7 13z"/>
  <circle cx="12" cy="9" r="2.5"/>
</svg>`;

const ICON_VOICE = `
<svg class="icon" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="2" width="6" height="12" rx="3"/>
  <path d="M5 11a7 7 0 0 0 14 0"/>
  <line x1="12" y1="18" x2="12" y2="22"/>
</svg>`;

const ICON_PHOTO = `
<svg class="icon" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4" width="18" height="16" rx="2"/>
  <circle cx="8.5" cy="9.5" r="1.5"/>
  <path d="M21 15l-5-5L5 21"/>
</svg>`;

const ICON_KEBAB = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
  <circle cx="12" cy="5"  r="1.8"/>
  <circle cx="12" cy="12" r="1.8"/>
  <circle cx="12" cy="19" r="1.8"/>
</svg>`;

/**
 * @param {import('../models/Boat.js').Boat} boat
 * @param {Object} [opts]
 * @param {boolean} [opts.bulkMode=false]
 * @param {boolean} [opts.selected=false]
 */
export function renderBoatRow(boat, opts = {}) {
  const { bulkMode = false, selected = false } = opts;
  const hasCustomer = boat.customerName && boat.customerName.length > 0;

  return `
    <div class="boat-row ${bulkMode ? 'is-bulk' : ''} ${selected ? 'is-selected' : ''}"
         data-boat-id="${esc(boat.id)}">

      ${bulkMode ? `
        <label class="boat-check-wrap" data-action="check">
          <input type="checkbox" class="boat-check"
                 ${selected ? 'checked' : ''}>
        </label>` : ''}

      <div class="boat-avatar">${esc(boat.initials())}</div>

      <div class="boat-info">
        <div class="boat-name-line">
          <span class="boat-name">${esc(boat.name)}</span>
          ${boat.isActive ? '<span class="boat-star">★</span>' : ''}
          ${boat.isActive ? '<span class="boat-status">ACTIVE</span>' : ''}
        </div>

        ${hasCustomer ? `
          <div class="boat-customer">
            ${ICON_PERSON}
            <span>${esc(boat.customerName)}</span>
          </div>` : ''}

        ${boat.port ? `
          <div class="boat-location">
            ${ICON_LOCATION}
            <span>${esc(boat.port)}</span>
          </div>` : ''}
      </div>

      ${!bulkMode && boat.hasVoiceNote() ? `
        <button class="boat-icon-btn" data-action="voice" aria-label="Voice note">
          ${ICON_VOICE}
        </button>` : ''}

      ${!bulkMode && boat.hasPhoto() ? `
        <button class="boat-icon-btn" data-action="photo" aria-label="Photo">
          ${ICON_PHOTO}
        </button>` : ''}

      ${!bulkMode ? `
        <button class="boat-kebab" data-action="menu" aria-label="Boat menu">
          ${ICON_KEBAB}
        </button>` : ''}

      <div class="boat-divider"></div>
    </div>
  `;
}