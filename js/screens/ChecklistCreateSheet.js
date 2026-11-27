import { t } from '../i18n.js';
import { store } from '../store.js';
import { db, collection, doc, writeBatch } from '../firebase.js';
import { sheetCloseButton } from '../ui/sheetClose.js';
import { toast } from '../ui/toast.js';

const DEPARTURE_ITEMS = [
  ['Safety', 'Review weather and departure conditions'],
  ['Safety', 'Check access to lifejackets and safety equipment'],
  ['Engine', 'Check fuel level and engine fluids'],
  ['Engine', 'Check steering and engine controls'],
  ['Deck', 'Secure loose gear and prepare lines and fenders'],
  ['Navigation', 'Check navigation equipment and communications']
];

export const canEditChecklists = () => (['admin', 'manager'].includes(store.activeRole) || store.activeMarina?.clientType === 'yacht_operator' && ['staff', 'inspector'].includes(store.activeRole));

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"') {
      if (field || closed) throw new Error(t('Invalid CSV quoting.'));
      quoted = true;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(field); field = ''; closed = false;
      if (ch !== ',') {
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      }
    } else {
      if (closed && !/\s/.test(ch)) throw new Error(t('Unexpected text after a quoted CSV field.'));
      if (!closed) field += ch;
    }
  }
  if (quoted) throw new Error(t('Unclosed quoted CSV field.'));
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  const header = rows.shift()?.map(value => value.trim().toLowerCase().replace(/^item\s+name$/, 'text'));
  if (!header || !header.some(key => ['text', 'itemtext', 'item'].includes(key)) || new Set(header).size !== header.length) {
    throw new Error(t('CSV needs a text or Item Name column. Category and mandatory are optional.'));
  }
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`Row ${index + 2}: column count does not match the header.`);
    return Object.fromEntries(header.map((key, col) => [key, values[col]]));
  });
}

function normalizeItem(item, index) {
  if (typeof item === 'string') item = { text: item };
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`Item ${index + 1}: invalid item.`);
  }
  const text = String(item.text ?? item.itemText ?? item.itemtext ?? item.item ?? '').trim();
  const category = String(item.category ?? '').trim() || 'General';
  const required = item.mandatory ?? item.isMandatory;
  const value = String(required ?? '').trim().toLowerCase();
  if (!text || text.length > 300 || category.length > 60) {
    throw new Error(`Item ${index + 1}: enter text up to 300 characters and a category up to 60 characters.`);
  }
  if (!['', 'true', 'false', 'yes', 'no', '1', '0'].includes(value)) {
    throw new Error(`Item ${index + 1}: mandatory must be true or false.`);
  }
  return { text, category, mandatory: ['', 'true', 'yes', '1'].includes(value) };
}

export function parseChecklistImport(contents, filename) {
  const input = String(contents).replace(/^\uFEFF/, '').trim();
  const parsed = /\.json$/i.test(filename) || /^[\[{]/.test(input) ? JSON.parse(input) : parseCsv(input);
  const items = Array.isArray(parsed) ? parsed : parsed?.items;
  if (!Array.isArray(items) || !items.length || items.length > 100) {
    throw new Error(t('A checklist must contain between 1 and 100 items.'));
  }
  return { name: Array.isArray(parsed) ? '' : String(parsed.name ?? parsed.checklistName ?? '').trim(), items: items.map(normalizeItem) };
}

export async function createChecklist({ clientId, boatId, name, type, items, createdBy }) {
  const checklist = doc(collection(db, 'checklists'));
  const batch = writeBatch(db);
  const now = Date.now();
  const id = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff || 1;
  batch.set(checklist, {
    id, clientId, boatId, name, type, status: 'IN_PROGRESS',
    totalItems: items.length, completedItems: 0, passedItems: 0, failedItems: 0,
    photoCount: 0, maintenanceCreated: 0, notes: '',
    createdAt: now, createdBy, completedAt: 0, completedBy: '', lastModified: now
  });
  items.forEach((item, index) => {
    batch.set(doc(collection(checklist, 'items'), String(index + 1)), {
      ...item, status: 'NOT_STARTED', notes: '', photoPath: null,
      sortOrder: index, createdAt: now, completedAt: 0, completedBy: ''
    });
  });
  await batch.commit();
}

export function showChecklistCreate(boats, preferredBoatId) {
  if (!canEditChecklists()) return;
  const yacht = store.activeMarina?.clientType === 'yacht_operator';
  const choices = yacht ? [store.assignedYacht].filter(Boolean) : boats;
  if (!choices.length) { toast(t('No boat is available for this checklist.'), { kind: 'error' }); return; }

  const modalRoot = document.getElementById('modalRoot');
  if (modalRoot.querySelector('#addChecklistDialog')) return;
  const clientId = Number(store.activeClientId);
  const uid = store.authUser?.uid;
  const createdBy = store.userProfile?.name || store.authUser?.displayName || '';
  const opener = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const dialog = document.createElement('div');
  dialog.id = 'addChecklistDialog';
  dialog.className = 'sheet';
  dialog.style.width = '100%';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'addChecklistTitle');
  // Imported values are set through DOM properties.
  dialog.innerHTML = `
    ${sheetCloseButton()}
    <div class="sheet-title" id="addChecklistTitle">${t('Add Checklist')}</div>
    <div data-options style="display:grid;gap:8px;margin-block:12px">
      <button class="add-option" type="button" data-template>
        <span style="text-align:start">
          <span class="add-option-title">${t('Use App Template')}</span>
          <span class="add-option-sub" style="display:block">${t('Start with an editable departure checklist.')}</span>
        </span>
      </button>
      <button class="add-option" type="button" data-import>
        <span style="text-align:start">
          <span class="add-option-title">${t('Import My Own')}</span>
          <span class="add-option-sub" style="display:block">${t('Upload a CSV or JSON file with your own checklist items.')}</span>
        </span>
      </button>
    </div>
    <form class="add-form" hidden style="display:none;margin:0">
      <div class="add-scroll">
        <label class="add-label" for="checklistNewBoat">${t('Boat')}</label>
        <select id="checklistNewBoat" class="add-input" name="boat" required></select>
        <label class="add-label" for="checklistNewName">${t('Checklist Name')}</label>
        <input id="checklistNewName" class="add-input" name="name" maxlength="100" required>
        <label class="add-label" for="checklistNewType">${t('Type')}</label>
        <select id="checklistNewType" class="add-input" name="type">
          <option value="DEPARTURE">${t('Departure')}</option><option value="SAFETY">${t('Safety')}</option>
          <option value="INVENTORY">${t('Inventory')}</option><option value="MAINTENANCE">${t('Maintenance')}</option>
          <option value="CUSTOM">${t('Custom')}</option>
        </select>
        <div data-file hidden>
          <label class="add-label" for="checklistNewFile">${t('CSV or JSON file')}</label>
          <input id="checklistNewFile" type="file" accept=".csv,.json,text/csv,application/json">
          <p style="color:var(--color-text-secondary)">${t('CSV needs a text or Item Name column. Category and mandatory are optional.')} ${t('JSON: an item array or an object with name and items.')}</p>
        </div>
        <p data-summary></p>
        <div data-template-items hidden></div>
      </div>
      <button type="submit" class="add-save" disabled>${t('Create checklist')}</button>
    </form>
    <div data-error role="alert" style="color:#ff9999"></div>`;

  const form = dialog.querySelector('form');
  const save = form.querySelector('[type=submit]');
  const fileInput = dialog.querySelector('[type=file]');
  const summary = dialog.querySelector('[data-summary]');
  const error = dialog.querySelector('[data-error]');
  const closeButton = dialog.querySelector('[data-sheet-close]');
  let closed = false;
  let items = [];
  let saving = false;
  let fileGeneration = 0;

  const boat = form.elements.boat;
  if (!yacht && choices.length > 1) boat.add(new Option(t('Select boat'), ''));
  for (const choice of choices) boat.add(new Option(choice.name || t('Boat'), choice.id));
  if (choices.some(choice => Number(choice.id) === preferredBoatId)) boat.value = String(preferredBoatId);
  boat.disabled = yacht;

  function showForm(importing) {
    fileGeneration++;
    items = importing ? [] : DEPARTURE_ITEMS.map(([category, text]) => ({ category: t(category), text: t(text), mandatory: true }));
    form.hidden = false;
    form.style.removeProperty('display');
    dialog.querySelector('[data-file]').hidden = !importing;
    fileInput.value = '';
    form.elements.name.value = importing ? '' : t('Departure Checklist');
    form.elements.type.value = importing ? 'CUSTOM' : 'DEPARTURE';
    summary.textContent = items.length ? `${t('Items')}: ${items.length}` : '';
    const templateItems = dialog.querySelector('[data-template-items]');
    templateItems.hidden = importing;
    templateItems.replaceChildren();
    items.forEach((item, index) => {
      const label = document.createElement('label');
      label.className = 'add-label';
      label.textContent = `${index + 1}. ${item.category}`;
      const field = document.createElement('input');
      field.className = 'add-input';
      field.maxLength = 300;
      field.required = true;
      field.value = item.text;
      field.addEventListener('input', () => { item.text = field.value; });
      label.append(field);
      templateItems.append(label);
    });
    error.textContent = '';
    save.disabled = !items.length;
  }

  dialog.querySelector('[data-template]').onclick = () => showForm(false);
  dialog.querySelector('[data-import]').onclick = () => showForm(true);
  fileInput.onchange = async () => {
    const generation = ++fileGeneration;
    items = [];
    summary.textContent = '';
    error.textContent = '';
    save.disabled = true;
    const file = fileInput.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error(t('Choose a CSV or JSON file under 1 MB.'));
      const parsed = parseChecklistImport(await file.text(), file.name);
      if (generation !== fileGeneration || (closed || !dialog.isConnected)) return;
      items = parsed.items;
      form.elements.name.value = (parsed.name || file.name.replace(/\.[^.]+$/, '')).slice(0, 100);
      summary.textContent = `${t('Items')}: ${items.length}`;
      save.disabled = false;
    } catch (err) {
      if (generation === fileGeneration && !closed && dialog.isConnected) error.textContent = err.message;
    }
  };
  function current() {
    return !closed && dialog.isConnected && uid && store.authUser?.uid === uid
      && Number(store.activeClientId) === clientId && canEditChecklists();
  }
  form.onsubmit = async event => {
    event.preventDefault();
    const boatId = Number(boat.value);
    const name = form.elements.name.value.trim();
    const type = form.elements.type.value;
    if (saving || !current()) return;
    if (!name || !items.length || !choices.some(choice => Number(choice.id) === boatId)
        || (yacht && Number(store.assignedYacht?.id) !== boatId)) {
      error.textContent = t('Choose a boat and enter a checklist name with at least one item.');
      return;
    }
    saving = true;
    closeButton.disabled = true;
    const controls = [...dialog.querySelectorAll('input, select, button')].filter(control => !control.disabled);
    controls.forEach(control => { control.disabled = true; });
    save.disabled = true;
    error.textContent = '';
    try {
      await createChecklist({ clientId, boatId, name, type, items: items.map(normalizeItem), createdBy });
      if (current()) {
        close();
        toast(t('Checklist created'), { kind: 'success' });
      }
    } catch (err) {
      if (current()) error.textContent = err.message || t('Could not create checklist.');
    } finally {
      saving = false;
      controls.forEach(control => { control.disabled = false; });
      closeButton.disabled = false;
    }
  };

  function close() {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('is-open');
    dialog.classList.remove('is-open');
    backdrop.remove();
    dialog.remove();
    if (opener?.isConnected) opener.focus();
  }

  function dismiss() {
    if (!saving) close();
  }

  closeButton.addEventListener('click', dismiss);
  backdrop.addEventListener('click', dismiss);
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    }
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button, input, select')]
        .filter(control => !control.disabled && control.getClientRects().length);
      const boundary = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement !== boundary) return;
      event.preventDefault();
      (event.shiftKey ? controls.at(-1) : controls[0])?.focus();
    }
  });

  modalRoot.append(backdrop, dialog);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    dialog.classList.add('is-open');
    closeButton.focus({ preventScroll: true });
  });
}
