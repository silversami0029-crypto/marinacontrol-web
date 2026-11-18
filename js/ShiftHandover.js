import { dateOnlyDaysUntil } from './CalendarDate.js';
import { isMaintenanceCompleted } from './MaintenanceState.js';

const state = row => String(row.status || '').trim().toUpperCase();
export function handoverRows(maintenance, tasks, clientId, boatId = 0, now = new Date()) {
  const scope = row => Number(row.clientId) === Number(clientId) && (!boatId || Number(row.boatId) === Number(boatId))
    && !row.deleted && !row.isDeleted && !row.deletedAt && !['DELETED', 'CANCELLED', 'ARCHIVED'].includes(state(row)) && row.archived !== true;
  const result = [];
  for (const [kind, records] of [['Maintenance', maintenance], ['Task', tasks]]) {
    for (const row of records.filter(scope)) {
      if (kind === 'Maintenance' ? isMaintenanceCompleted(row) : row.completed === true || ['COMPLETED', 'DONE'].includes(state(row))) continue;
      const due = String(kind === 'Maintenance' ? row.date || '' : row.dueDate || '');
      const days = dateOnlyDaysUntil(due, now);
      const owner = String(row.assignedTo ?? '').trim();
      const unassigned = !owner || /^(0|unassigned|none|null)$/i.test(owner);
      result.push({ ...row, kind, title: String(kind === 'Maintenance' ? row.type || 'Maintenance' : row.title || 'Task'),
        due, overdue: days !== null && days < 0, dueToday: days === 0, unassigned,
        owner: unassigned ? 'Unassigned' : owner, deferred: state(row) === 'DEFERRED',
        urgent: ['CRITICAL', 'HIGH', 'URGENT', 'OVERDUE'].includes(String(row.priority || '').toUpperCase()) || state(row) === 'ESCALATED' });
    }
  }
  return result.sort((a,b) => Number(a.deferred)-Number(b.deferred) || Number(b.overdue)-Number(a.overdue)
    || Number(b.urgent)-Number(a.urgent) || Number(b.unassigned)-Number(a.unassigned)
    || (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title));
}
export function handoverText(rows, marina, notes, now = new Date()) {
  return ['MarinaControl — Shift handover', marina, `Generated: ${now.toISOString()}`,
    'Outstanding work snapshot. Check the app for updates. Deferred work is included; this is not a launch clearance or complete safety register.', '',
    ...rows.map(row => `${row.kind}: ${row.title}\nBoat reference: ${row.boatId || 'Unassigned'} | Owner: ${row.owner} | Status: ${row.status || 'Open'} | Due: ${row.due || 'Not set'}${row.overdue ? ' | OVERDUE' : ''}${row.deferred ? ' | DEFERRED' : ''}\n${row.notes || ''}\n`),
    rows.length ? '' : 'No outstanding tasks or maintenance in the loaded scope.', 'Notes for the next shift:', notes || 'None supplied'].join('\n');
}

// Mirrors the supplied Android DAO queries, including its inclusive inspection end boundary.
export function handoverSummary(maintenance, bookings, berths, inspections, clientId, now = new Date()) {
  const scoped = records => records.filter(row => Number(row.clientId) === Number(clientId));
  const start = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const end = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime();
  const today = row => Number(row.arrivalDate) >= start && Number(row.arrivalDate) < end;
  const active = scoped(maintenance).filter(row => !row.completed && !['COMPLETED','DELETED','CANCELLED','DEFERRED'].includes(state(row)));
  const inspected = new Set(scoped(inspections).filter(row => Number(row.inspectionDate) >= start && Number(row.inspectionDate) <= end).map(row => String(row.berthId)));
  return {
    checkedIn: scoped(bookings).filter(row => row.status === 'CHECKED_IN' && today(row)).length,
    awaiting: scoped(bookings).filter(row => ['REQUESTED','CONFIRMED'].includes(row.status) && today(row)).length,
    issues: active.filter(row => String(row.source || '').toLowerCase() === 'dock walk inspection').length,
    inspectionsDue: Math.max(0,scoped(berths).length-inspected.size), maintenance: active.length
  };
}
export function latestHandover(records, clientId) {
  return records.filter(row => Number(row.clientId) === Number(clientId) && typeof row.notes === 'string')
    .sort((a,b) => Number(b.createdAt || 0)-Number(a.createdAt || 0) || String(b._docId || '').localeCompare(String(a._docId || '')))[0] || null;
}
