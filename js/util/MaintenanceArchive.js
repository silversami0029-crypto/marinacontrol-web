import { store } from '../store.js';
import { auth, db } from '../firebase.js';
import { doc, runTransaction, serverTimestamp, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { isMaintenanceCompleted } from './MaintenanceState.js';

function requireClient(clientId) {
  if (!auth.currentUser) throw new Error('Authenticated session required');
  if (!(clientId > 0) || Number(store.activeClientId) !== clientId) {
    throw new Error('The active marina changed. Reopen the task.');
  }
}

function requireTask(snapshot, clientId) {
  requireClient(clientId);
  if (!snapshot.exists()) throw new Error('Maintenance task no longer exists');
  const task = snapshot.data();
  if (Number(task.clientId) !== clientId) throw new Error('Task belongs to another marina');
  return task;
}

export async function setMaintenanceArchived(item, archived) {
  const clientId = Number(item.clientId);
  requireClient(clientId);
  if (!item._docId) throw new Error('Task document ID is missing');
  const ref = doc(db, 'maintenance', item._docId);
  const userId = String(store.userProfile?.userId || '');
  if (!userId || userId === '0') throw new Error('Unable to identify the current user');
  console.debug('[MAINT_ARCHIVE] START', { clientId, documentId: item._docId, archived });
  try {
    await runTransaction(db, async transaction => {
      const task = requireTask(await transaction.get(ref), clientId);
      if ((task.archived === true) === archived) return;
      if (Number(task.archiveModifiedAt || 0) !== Number(item.archiveModifiedAt || 0)) {
        throw new Error('Archive state changed elsewhere. Reopen the task.');
      }
      if (archived && !isMaintenanceCompleted(task)) throw new Error('Only completed tasks can be archived');
      const now = Math.max(Date.now(), Number(task.archiveModifiedAt || 0) + 1);
      const patch = {
        archived,
        archiveModifiedAt: now,
        archiveModifiedBy: userId,
        syncTime: serverTimestamp(),
        archiveEvents: arrayUnion({ action: archived ? 'ARCHIVED' : 'RESTORED', at: now, by: userId })
      };
      if (archived) Object.assign(patch, { archivedAt: now, archivedBy: userId });
      transaction.update(ref, patch);
    });
    console.debug('[MAINT_ARCHIVE] SAVED', { clientId, documentId: item._docId, archived });
  } catch (error) {
    console.error('[MAINT_ARCHIVE] FAILED', { clientId, documentId: item._docId, archived }, error);
    throw error;
  }
}

// Recheck current cloud state so a previously opened sheet cannot edit archived work.
export async function updateMaintenanceTask(ref, patch) {
  const clientId = Number(store.activeClientId);
  requireClient(clientId);
  await runTransaction(db, async transaction => {
    const task = requireTask(await transaction.get(ref), clientId);
    if (task.archived === true) throw new Error('Restore this task before editing it');
    transaction.update(ref, patch);
  });
}

export async function deleteMaintenanceTask(item) {
  const clientId = Number(item.clientId);
  requireClient(clientId);
  const ref = doc(db, 'maintenance', String(item._docId));
  await runTransaction(db, async transaction => {
    const task = requireTask(await transaction.get(ref), clientId);
    if (task.archived === true || isMaintenanceCompleted(task)) {
      throw new Error('Completed tasks must be archived to preserve their history');
    }
    transaction.delete(ref);
  });
}
