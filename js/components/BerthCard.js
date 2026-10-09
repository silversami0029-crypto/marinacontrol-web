import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/components/BerthCard.js
// Renders one berth card — mirrors item_berth.xml

import { esc } from '../utils.js';

const KE_BAB = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
  <circle cx="12" cy="5"  r="1.6"/>
  <circle cx="12" cy="12" r="1.6"/>
  <circle cx="12" cy="19" r="1.6"/>
</svg>`;

export function renderBerthCard(berth) {
  const status = (berth.status || 'AVAILABLE').toUpperCase();
  const statusClass = status.toLowerCase();   // available | occupied | maintenance
  const confirmedBooking = status === 'AVAILABLE' &&
    String(berth.activeBooking?.status || '').toUpperCase() === 'CONFIRMED';
  const boatName = berth.assignedBoatName || (confirmedBooking ? berth.activeBooking?.vesselName : '');
  const showBoat = !!boatName;

  return `
    <div class="berth-card berth-card--${statusClass}" data-berth-id="${esc(berth.id)}">
      <div class="berth-card-num">${esc(berth.berthNumber || '?')}</div>
      <button class="berth-card-kebab" data-action="kebab" aria-label="${tr("Berth menu")}">
        ${KE_BAB}
      </button>
      ${confirmedBooking ? `
        <div class="berth-card-booking" aria-label="${tr('Confirmed booking')}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="7"/><line x1="16" y1="2" x2="16" y2="7"/>
          </svg>
        </div>
      ` : ''}
      ${showBoat ? `
        <div class="berth-card-boat${confirmedBooking ? ' berth-card-boat--booked' : ''}">${esc(boatName)}</div>
      ` : ''}
    </div>
  `;
}
