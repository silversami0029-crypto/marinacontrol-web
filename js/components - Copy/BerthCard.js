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
  const showBoat = !!berth.assignedBoatName;

  return `
    <div class="berth-card berth-card--${statusClass}" data-berth-id="${esc(berth.id)}">
      <div class="berth-card-num">${esc(berth.berthNumber || '?')}</div>
      <button class="berth-card-kebab" data-action="kebab" aria-label="Berth menu">
        ${KE_BAB}
      </button>
      ${showBoat ? `
        <div class="berth-card-boat">${esc(berth.assignedBoatName)}</div>
      ` : ''}
    </div>
  `;
}