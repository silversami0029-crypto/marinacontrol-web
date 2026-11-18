import { collection, doc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { boatReferenceCandidates, requireBoatReference } from './BoatReference.js';

export function checklistItemStatus(data) {
  const status = String(data.status || '').toUpperCase();
  if (['FAIL', 'FAILED'].includes(status) || data.failed === true || data.result === 'FAIL') return 'FAIL';
  if (['PASS', 'PASSED', 'COMPLETED'].includes(status) || data.checked === true
      || data.completed === true || data.passed === true) return 'PASS';
  return 'NOT_STARTED';
}

// The item is read before linking; concurrent creators retry and reuse its committed link.
export async function createChecklistMaintenance(checklist, item, actor, isCurrent) {
  if (!isCurrent()) throw new Error('Your marina or session changed. Reopen the checklist.');
  const boats = await boatReferenceCandidates(checklist.clientId, checklist.boatId);
  const parent = doc(db, 'checklists', checklist._docId);
  const newTask = doc(collection(db, 'maintenance'));
  const taskId = new Uint32Array(1);
  crypto.getRandomValues(taskId);
  const numericId = (taskId[0] & 0x7fffffff) || 1;
  return runTransaction(db, async tx => {
    if (!isCurrent()) throw new Error('Your marina or session changed. Reopen the checklist.');
    const parentSnap = await tx.get(parent);
    const itemSnap = await tx.get(item.ref);
    const current = parentSnap.data(), result = itemSnap.data();
    if (!current || !result || Number(current.clientId) !== Number(checklist.clientId)
        || Number(current.boatId) !== Number(checklist.boatId))
      throw new Error('Checklist or item is no longer available in this marina.');
    if (result.maintenanceTaskCloudId) {
      const linkedRef = doc(db, 'maintenance', result.maintenanceTaskCloudId);
      const linked = await tx.get(linkedRef);
      if (!isCurrent()) throw new Error('Your marina or session changed. Reopen the checklist.');
      if (!linked.exists()) throw new Error('Linked maintenance is unavailable. Check Maintenance before creating another task.');
      const task = linked.data();
      if (Number(task.clientId) !== Number(checklist.clientId)) throw new Error('Maintenance link does not match this marina.');
      return { task: { ...task, _docId: linkedRef.id }, revision: Number(current.webChecklistRevision || 0), created: false };
    }
    if (!isCurrent()) throw new Error('Your marina or session changed. Reopen the checklist.');
    if (result.maintenanceTaskId || result.maintenanceTaskCloudId || result.maintenanceId)
      throw new Error('This item already has a maintenance reference. Check Maintenance before creating another task.');
    if (!Number.isSafeInteger(Number(current.boatId)) || Number(current.boatId) <= 0)
      throw new Error('This checklist has no assigned boat. Confirm its boat before creating maintenance.');
    if (boats.length !== 1) throw new Error('The checklist boat reference is missing or ambiguous. Choose an existing boat before creating maintenance.');
    requireBoatReference(await tx.get(boats[0]), current.clientId, current.boatId);
    if (!isCurrent()) throw new Error('Your marina or session changed. Reopen the checklist.');
    if (checklistItemStatus(result) !== 'FAIL' || !['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(String(current.status || 'PENDING').toUpperCase()))
      throw new Error('Save a failed result before creating maintenance.');
    if (Number(current.webChecklistRevision || 0) !== Number(checklist.revision || 0))
      throw new Error('This checklist changed. Close it and open it again.');
    const now = Date.now(), today = new Date(now);
    const label = result.text || result.itemText || result.label || result.name || result.title || result.description || result.item || '(untitled)';
    const task = {
      id: numericId, cloudId: newTask.id, clientId: Number(checklist.clientId), boatId: Number(checklist.boatId),
      source: 'Checklist', sourceChecklistId: checklist._docId, sourceChecklistItemId: item.ref.id,
      type: `Checklist: ${label}`, priority: 'HIGH', status: 'ACTIVE', completed: false, archived: false,
      date: `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,
      notes: [`Checklist: ${current.name || ''}`, `Failed item: ${label}`, result.category, result.notes, current.notes].filter(Boolean).join('\n'),
      assignedTo: null, lastModified: now, lastModifiedBy: String(actor || ''), syncedAt: now, syncTime: serverTimestamp()
    };
    tx.set(newTask, task);
    tx.update(item.ref, { maintenanceTaskId: numericId, maintenanceTaskCloudId: newTask.id });
    const revision = Number(current.webChecklistRevision || 0) + 1;
    tx.update(parent, { maintenanceCreated: Number(current.maintenanceCreated || 0) + 1, webChecklistRevision: revision, lastModified: now });
    return { task: { ...task, _docId: newTask.id }, revision, created: true };
  });
}
