import { t } from '../i18n.js';

export function sheetCloseButton() {
  return `<button type="button" class="sheet-close-button" data-sheet-close aria-label="${t('Close')}"><span aria-hidden="true">&times;</span></button>`;
}
