import { italianUI as itUI } from '../i18n.js';
import { app, db, doc, updateDoc } from '../firebase.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';

export const YACHT_PHOTO_DESKTOP_MIN_WIDTH = 1024;
export const YACHT_PHOTO_DESKTOP_HEIGHT = 260;

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function photoFolder(boat) {
  return `tenants/${Number(boat.clientId)}/yacht-photos/${Number(boat.id)}/`;
}

function savedPhotoPath(boat) {
  const path = boat.yachtPhotoStoragePath;
  const prefix = photoFolder(boat);
  return typeof path === 'string' && path.startsWith(prefix)
    && /^[a-f\d-]{36}$/i.test(path.slice(prefix.length)) ? path : null;
}

async function storageApi() {
  return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
}

export function hasYachtPhoto(boat) {
  return Boolean(savedPhotoPath(boat));
}

export async function loadYachtPhoto(boat) {
  const path = savedPhotoPath(boat);
  if (!path) return null;
  const { getStorage, ref, getBlob } = await storageApi();
  return getBlob(ref(getStorage(app), path), MAX_BYTES);
}

export async function resetYachtBannerPhoto(boat) {
  const uid = store.authUser?.uid;
  const clientId = Number(store.activeClientId);
  const current = () => Boolean(uid) && uid === store.authUser?.uid
    && clientId === Number(store.activeClientId) && clientId === Number(boat.clientId)
    && boat._docId && boat._docId === store.assignedYacht?._docId;
  if (!current() || !hasYachtPhoto(boat)) throw new Error('Assigned yacht photo is unavailable');

  const now = Date.now();
  await updateDoc(doc(db, 'boats', boat._docId), {
    yachtPhotoStoragePath: null,
    lastModified: now,
    lastModifiedBy: String(store.userProfile?.userId ?? ''),
    syncedAt: now
  });

  if (current()) {
    store.assignedYacht.yachtPhotoStoragePath = null;
    boat.yachtPhotoStoragePath = null;
  }
}

export function closeYachtPhoto() {
  document.getElementById('yachtPhotoDialog')?.close();
}

export function showYachtPhoto(boat) {
  const uid = store.authUser?.uid;
  const clientId = Number(store.activeClientId);
  const current = () => Boolean(uid) && uid === store.authUser?.uid
    && clientId === Number(store.activeClientId) && clientId === Number(boat.clientId)
    && boat._docId && boat._docId === store.assignedYacht?._docId
    && location.hash === '#/my-yacht/details';
  if (!current() || document.getElementById('yachtPhotoDialog')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'yachtPhotoDialog';
  dialog.style.cssText = 'width:min(680px,calc(100% - 32px));max-height:85dvh;overflow:auto;margin:auto;padding:20px;border:1px solid var(--color-divider);border-radius:16px;background:var(--color-surface);color:var(--color-text-primary)';
  dialog.setAttribute('aria-labelledby', 'yachtPhotoTitle');
  dialog.innerHTML = `
    <h2 id="yachtPhotoTitle"></h2>
    <img data-photo hidden alt="" style="max-width:100%;max-height:45vh;margin:12px auto;object-fit:contain;border-radius:8px">
    <div data-preview hidden><p></p><img alt="" style="display:block;width:100%;object-fit:cover;object-position:center 55%;border-radius:8px"></div>
    <label style="display:block;margin:16px 0"><span></span>
      <input type="file" accept="image/jpeg,image/png,image/webp" style="display:block;max-width:100%;margin-top:6px">
    </label>
    <p role="status"></p>
    <div style="display:flex;justify-content:flex-end;gap:12px">
      <button type="button" class="dash-filter" data-close></button>
      <button type="button" class="dash-filter is-active" data-save disabled></button>
    </div>`;
  const existing = dialog.querySelector('[data-photo]');
  const preview = dialog.querySelector('[data-preview]');
  const crop = preview.querySelector('img');
  const input = dialog.querySelector('input');
  const message = dialog.querySelector('[role=status]');
  const save = dialog.querySelector('[data-save]');
  const close = dialog.querySelector('[data-close]');
  const heading = dialog.querySelector('h2');
  heading.textContent = itUI(hasYachtPhoto(boat) ? 'Change boat photo' : 'Add boat photo');
  dialog.querySelector('label span').textContent = itUI('Choose a JPEG, PNG or WebP photo under 10 MB');
  preview.querySelector('p').textContent = itUI('Home banner preview');
  crop.alt = itUI('Banner crop preview');
  const screen = document.getElementById('screen');
  const screenStyle = getComputedStyle(screen);
  const bannerWidth = screen.clientWidth - parseFloat(screenStyle.paddingLeft) - parseFloat(screenStyle.paddingRight);
  const bannerHeight = matchMedia(`(min-width: ${YACHT_PHOTO_DESKTOP_MIN_WIDTH}px)`).matches
    ? YACHT_PHOTO_DESKTOP_HEIGHT
    : matchMedia('(max-width: 720px)').matches ? 180 : 200;
  // The photo fills the area inside the banner's one-pixel border.
  crop.style.aspectRatio = `${Math.max(1, bannerWidth - 2)} / ${bannerHeight - 2}`;
  existing.alt = boat.name || itUI('Boat photo');
  save.textContent = itUI('Save photo');
  close.textContent = itUI('Close');

  let previewUrl, existingUrl, selected;
  const cleanup = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (existingUrl) URL.revokeObjectURL(existingUrl);
    dialog.remove();
  };
  dialog.addEventListener('close', cleanup, { once: true });
  dialog.addEventListener('cancel', event => { if (input.disabled) event.preventDefault(); });
  close.addEventListener('click', () => dialog.close());
  document.getElementById('screen').append(dialog);
  dialog.showModal();

  loadYachtPhoto(boat).then(blob => {
    if (!blob || !dialog.open) return;
    existingUrl = URL.createObjectURL(blob);
    existing.src = existingUrl;
    existing.hidden = false;
    existing.style.display = 'block';
  }).catch(() => {
    if (dialog.open && !selected) message.textContent = itUI('The saved photo could not be loaded.');
  });

  input.addEventListener('change', async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    selected = null;
    save.disabled = true;
    preview.hidden = true;
    message.textContent = '';
    const file = input.files[0];
    if (!file) return;
    if (!TYPES.has(file.type) || !file.size || file.size >= MAX_BYTES) {
      message.textContent = itUI('Choose a JPEG, PNG or WebP photo under 10 MB.');
      return;
    }
    const url = previewUrl = URL.createObjectURL(file);
    crop.src = url;
    try {
      await crop.decode();
      if (!dialog.open || previewUrl !== url) return;
      selected = file;
      preview.hidden = false;
      save.disabled = false;
    } catch {
      if (dialog.open && previewUrl === url) message.textContent = itUI('This photo could not be opened.');
    }
  });

  save.addEventListener('click', async () => {
    if (!selected || save.disabled || !current()) return;
    const file = selected;
    input.disabled = save.disabled = close.disabled = true;
    message.textContent = itUI('Saving photo…');
    try {
      const { getStorage, ref, uploadBytes, deleteObject } = await storageApi();
      if (!current() || !dialog.isConnected) throw new Error('Yacht session changed');
      const storage = getStorage(app);
      const path = photoFolder(boat) + crypto.randomUUID();
      const object = ref(storage, path);
      await uploadBytes(object, file, { contentType: file.type });
      try {
        if (!current() || !dialog.isConnected) throw new Error('Yacht session changed');
        await updateDoc(doc(db, 'boats', boat._docId), {
          yachtPhotoStoragePath: path,
          lastModified: Date.now(),
          lastModifiedBy: String(store.userProfile?.userId ?? ''),
          syncedAt: Date.now()
        });
      } catch (error) {
        await deleteObject(object).catch(() => {});
        throw error;
      }
      const previous = savedPhotoPath(boat);
      if (previous) deleteObject(ref(storage, previous)).catch(() => {});
      if (current()) {
        store.assignedYacht.yachtPhotoStoragePath = path;
        boat.yachtPhotoStoragePath = path;
        store.emit();
        toast(itUI('Boat photo saved'), { kind: 'success' });
      }
      if (dialog.open) dialog.close();
    } catch (error) {
      console.warn('[yacht photo] Could not save photo', error);
      if (dialog.open) message.textContent = itUI('Could not save your photo. Check your connection or ask your workspace administrator.');
    } finally {
      input.disabled = save.disabled = close.disabled = false;
    }
  });
}
