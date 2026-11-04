import { app, db, auth } from '../firebase.js';
import { collection, doc, query, where, onSnapshot, getDocFromServer, getDocsFromServer,
  runTransaction, serverTimestamp, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, getMetadata, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { store } from '../store.js';

export const isDemo = event => ['MANUAL_TEST', 'DEMO', 'USAFE_DEMO'].includes(event.source);
export const isClosed = task => task?.completed === true || task?.status === 'COMPLETED';
export function inspectionStatus(task) {
  if (!task) return 'Not started';
  if (isClosed(task)) return 'Completed';
  if (task.status === 'DEFERRED') return 'Deferred';
  if (task.status === 'ESCALATED') return 'Escalated';
  if (task.usafeWorkflow?.stage === 'IN_PROGRESS') return 'In progress';
  return task.assignedTo ? 'Assigned' : 'Not started';
}
export const validId = id => typeof id === 'string' && id.length > 0 && !id.includes('/');
export function mediaPath(clientId, eventId, inspectionId, mediaType, mediaId) {
  if (![eventId, inspectionId, mediaId].every(validId) || !['photos', 'voice'].includes(mediaType))
    throw new Error('Invalid attachment identifiers.');
  return `tenants/${clientId}/usafe/${eventId}/${inspectionId}/${mediaType}/${mediaId}${mediaType === 'photos' ? '.jpg' : '.m4a'}`;
}
export function createUSafeService(clientId, uid) {
  const storage = getStorage(app);
  const context = () => {
    if (store.activeClientId !== clientId || store.authUser?.uid !== uid || auth.currentUser?.uid !== uid)
      throw new Error('Your marina or account changed. Reopen USAFE.');
  };
  const write = () => {
    context();
    if (!['admin', 'manager', 'staff', 'inspector'].includes(store.activeRole)) throw new Error('Your role has read-only access.');
  };
  const own = data => {
    if (!data || data.clientId !== clientId) throw new Error('This record is unavailable for this marina.');
    return data;
  };
  const eventRef = event => {
    own(event);
    if (!validId(event.documentId)) throw new Error('Invalid event.');
    return doc(db, 'usafe_events', event.documentId);
  };
  const linkRef = event => { eventRef(event); return doc(db, 'usafe_inspection_links', event.documentId); };
  async function resolve(event, create = false) {
    context();
    const link = await getDocFromServer(linkRef(event)); context();
    if (link.exists()) {
      const data = own(link.data());
      if (!validId(data.maintenanceCloudId)) throw new Error('Inspection link is invalid.');
      return data.maintenanceCloudId;
    }
    if (!create) return null;
    write();
    const next = doc(collection(db, 'maintenance'));
    return runTransaction(db, async tx => {
      write();
      const savedEvent = await tx.get(eventRef(event));
      const savedLink = await tx.get(linkRef(event));
      if (!savedEvent.exists()) throw new Error('Event no longer exists.');
      const source = own(savedEvent.data());
      if (savedLink.exists()) {
        const id = own(savedLink.data()).maintenanceCloudId;
        if (!validId(id)) throw new Error('Inspection link is invalid.');
        return id;
      }
      const now = Date.now(), demo = isDemo(source);
      const date = new Date();
      const due = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const task = { id:0, cloudId:next.id, clientId, boatId:null, berthId:null, assetId:null,
        type:demo ? 'DEMO — USAFE post-use inspection' : 'USAFE post-use inspection', date:due,
        notes:`${demo ? 'DEMO ONLY — no real device activation.\n\n' : ''}Device: ${source.deviceName || 'Device unspecified'}\nEvent: ${source.title || 'USAFE event'}\nEvent document: ${event.documentId}\n\nPost-use inspection requested.\nUse the manufacturer's approved inspection procedure.`,
        completed:false, status:'ACTIVE', source:demo ? 'USAFE_DEMO' : 'USAFE', priority:'MEDIUM',
        assignedTo:null, assignedBy:null, assignedAt:0, archived:false, lastModified:now,
        lastModifiedBy:String(store.userProfile?.userId || ''), syncedAt:now, syncTime:serverTimestamp() };
      context();
      tx.set(next, task);
      tx.set(linkRef(event), {clientId, eventId:event.documentId, maintenanceCloudId:next.id, createdBy:uid, createdAt:serverTimestamp()});
      return next.id;
    });
  }
  async function load(event, create = false) {
    const id = await resolve(event, create); if (!id) return null;
    const snap = await getDocFromServer(doc(db, 'maintenance', id)); context();
    if (!snap.exists()) throw new Error('The linked inspection is unavailable.');
    return { ...own(snap.data()), documentId:id };
  }
  function watchInspection(event, callback, failure) {
    context(); let taskOff = null, generation = 0, stopped = false;
    const off = onSnapshot(linkRef(event), link => {
      const current = ++generation; taskOff?.(); taskOff = null;
      try {
        context(); if (stopped) return;
        if (!link.exists()) { callback(null); return; }
        const id = own(link.data()).maintenanceCloudId;
        if (!validId(id)) throw new Error('Inspection link is invalid.');
        taskOff = onSnapshot(doc(db, 'maintenance', id), snap => {
          if (stopped || current !== generation) return;
          try {
            context(); if (!snap.exists()) throw new Error('The linked inspection is unavailable.');
            callback({...own(snap.data()), documentId:id});
          } catch (error) { failure(error); }
        }, error => { if (!stopped && current === generation) failure(error); });
      } catch (error) { failure(error); }
    }, error => { taskOff?.(); taskOff = null; if (!stopped) failure(error); });
    return () => { stopped = true; generation++; off(); taskOff?.(); };
  }
  async function save(event, displayed, action, changes = {}, reason = '') {
    write();
    const target = doc(db, 'maintenance', displayed.documentId), history = doc(collection(db, 'history'));
    return runTransaction(db, async tx => {
      write();
      const link = await tx.get(linkRef(event)), snap = await tx.get(target);
      if (!link.exists() || !snap.exists()) throw new Error('Inspection is unavailable.');
      if (own(link.data()).maintenanceCloudId !== target.id) throw new Error('Inspection link changed. Reopen it.');
      const task = own(snap.data());
      if (!['USAFE', 'USAFE_DEMO'].includes(task.source) || task.archived) throw new Error('Inspection cannot be edited.');
      if (task.lastModified !== displayed.lastModified || JSON.stringify(task.usafeWorkflow || {}) !== JSON.stringify(displayed.usafeWorkflow || {}))
        throw new Error('Inspection changed. Close and reopen it before saving.');
      if (isClosed(task) && action !== 'REOPENED') throw new Error('Reopen the inspection before editing.');
      const now = Date.now(), actor = store.userProfile?.name || uid;
      const workflow = {...task.usafeWorkflow, eventId:event.documentId, modifiedByUid:uid};
      const update = {lastModified:now, lastModifiedBy:String(store.userProfile?.userId || ''), syncedAt:now, syncTime:serverTimestamp()};
      if (action === 'ASSIGNED') {
        update.assignedTo = String(changes.assignedTo || '').trim() || null;
        update.assignedBy = actor; update.assignedAt = now;
        if (changes.date && !/^\d{4}-\d{2}-\d{2}$/.test(changes.date)) throw new Error('Enter a valid due date.');
        update.date = changes.date || '';
      } else if (action === 'CHECKLIST_UPDATED') {
        if (!Array.isArray(changes.checks) || changes.checks.length > 50 || changes.checks.some(c => typeof c.label !== 'string' || !c.label.trim() || c.label.length > 500 || typeof c.checked !== 'boolean'))
          throw new Error('Use up to 50 checklist items, with a maximum of 500 characters each.');
        workflow.checks = changes.checks.map(c => ({label:c.label.trim(), checked:c.checked}));
      } else if (action === 'STARTED') {
        if (task.status && task.status !== 'ACTIVE') throw new Error('Resolve deferred or escalated work first.');
        workflow.stage = 'IN_PROGRESS';
      } else if (action === 'COMPLETED') {
        Object.assign(workflow, {stage:'COMPLETED', completedAt:now, completedBy:actor, completionConfirmedByUid:uid, completionBasis:'STAFF_CONFIRMATION'});
        update.completed = true; update.status = 'COMPLETED';
      } else if (action === 'REOPENED') {
        if (!isClosed(task)) throw new Error('Inspection is already open.');
        if (!reason.trim()) throw new Error('Enter a reason to reopen this inspection.');
        update.completed = false; update.status = 'ACTIVE'; workflow.stage = 'IN_PROGRESS';
        delete workflow.completedAt; delete workflow.completedBy;
        delete workflow.completionConfirmedByUid; delete workflow.completionBasis;
      } else throw new Error('Unknown inspection action.');
      update.usafeWorkflow = workflow;
      context(); tx.update(target, update);
      tx.set(history, {id:now, clientId, boatId:0, module:'MAINTENANCE', itemId:task.id || 0, itemName:task.type,
        eventType:`USAFE_${action}`, description:`USAFE inspection ${action.toLowerCase().replaceAll('_',' ')}`,
        changedBy:actor, timestamp:now, reason:reason.trim(), reference:target.id, eventId:event.documentId,
        maintenanceCloudId:target.id, createdByUid:uid, before:task, changes:update, details:`USAFE ${action} / ${target.id}`});
    });
  }
  const mediaRef = event => collection(linkRef(event), 'media');
  function verifyMedia(event, media) {
    own(media);
    if (media.eventId !== event.documentId || media.storagePath !== mediaPath(clientId, event.documentId, media.inspectionId, media.mediaType, media.documentId))
      throw new Error('Attachment does not match this event.');
    return ref(storage, media.storagePath);
  }
  async function upload(event, file, photo, retainedId = crypto.randomUUID()) {
    write(); const inspectionId = await resolve(event, true); context();
    const contentType = photo ? 'image/jpeg' : 'audio/mp4', mediaType = photo ? 'photos' : 'voice';
    if (!file || file.size <= 0 || file.size >= 10*1024*1024 || file.type !== contentType)
      throw new Error(photo ? 'Use a JPEG photo smaller than 10 MB.' : 'Use an M4A/MP4 audio file smaller than 10 MB.');
    const storagePath = mediaPath(clientId, event.documentId, inspectionId, mediaType, retainedId);
    const record = doc(mediaRef(event), retainedId);
    // A retry after an uncertain acknowledgement must not overwrite immutable media metadata.
    const existing = await getDocFromServer(record); context();
    if (existing.exists()) { verifyMedia(event, {...existing.data(), documentId:retainedId}); return; }
    const objectRef = ref(storage, storagePath);
    let uploaded = false;
    try {
      const metadata = await getMetadata(objectRef); context();
      const tags = metadata.customMetadata || {};
      if (tags.clientId !== String(clientId) || tags.eventId !== event.documentId || tags.inspectionId !== inspectionId || tags.uploadedBy !== uid || metadata.size !== file.size || metadata.contentType !== contentType)
        throw new Error('An attachment already exists with different metadata.');
      uploaded = true;
    } catch (error) { if (error.code !== 'storage/object-not-found') throw error; }
    context();
    if (!uploaded) await uploadBytes(objectRef, file, {contentType, customMetadata:{clientId:String(clientId), eventId:event.documentId, inspectionId, uploadedBy:uid}});
    context();
    // Keep the same retainedId on retry if metadata save fails after upload.
    await setDoc(record, {clientId, eventId:event.documentId, inspectionId, mediaType, storagePath, createdAt:serverTimestamp(), createdBy:uid});
  }
  return {
    context, load, save, upload, watchInspection,
    watchEvents(callback, failure) {
      context();
      return onSnapshot(query(collection(db, 'usafe_events'), where('clientId','==',clientId)), snap => {
        try { context(); callback(snap.docs.map(d => ({...own(d.data()), documentId:d.id}))); } catch (e) { failure(e); }
      }, failure);
    },
    watchMedia(event, callback, failure) {
      context(); let mediaOff = null, stopped = false, generation = 0;
      const off = onSnapshot(linkRef(event), link => {
        const current = ++generation; mediaOff?.(); mediaOff = null;
        try {
          context(); if (stopped) return;
          if (!link.exists()) { callback([]); return; }
          own(link.data());
          mediaOff = onSnapshot(mediaRef(event), snap => {
            if (stopped || current !== generation) return;
            try { context(); callback(snap.docs.map(d => ({...d.data(), documentId:d.id})).filter(m => {
              try { verifyMedia(event,m); return true; } catch { return false; }
            })); } catch (e) { failure(e); }
          }, e => { if (!stopped && current === generation) failure(e); });
        } catch (e) { failure(e); }
      }, e => { mediaOff?.(); mediaOff = null; if (!stopped) failure(e); });
      return () => { stopped = true; generation++; off(); mediaOff?.(); };
    },
    async url(event, media) {
      context(); const result = await getDownloadURL(verifyMedia(event, media)); context(); return result;
    },
    async remove(event, media) {
      write();
      if (!['admin','manager'].includes(store.activeRole)) throw new Error('Only admins and managers can delete attachments.');
      try { await deleteObject(verifyMedia(event,media)); }
      catch (e) { if (e.code !== 'storage/object-not-found') throw e; }
      context();
      try { await deleteDoc(doc(mediaRef(event),media.documentId)); }
      catch (error) { throw new Error(`File removed, but its record could not be deleted. Check Firestore media delete permissions, then retry. (${error.code || error.message})`); }
    },
    async history(event) {
      context();
      const snap = await getDocsFromServer(query(collection(db,'history'), where('clientId','==',clientId), where('eventId','==',event.documentId)));
      context(); return snap.docs.map(d => own(d.data())).sort((a,b) => (b.timestamp || 0)-(a.timestamp || 0));
    }
  };
}
