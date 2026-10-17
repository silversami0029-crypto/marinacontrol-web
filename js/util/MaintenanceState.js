// Shared maintenance display and archive policy. Archive is separate from completion.
export const maintenanceColours = Object.freeze({
  archived: 'var(--maintenance-archived)',
  completed: 'var(--maintenance-completed)',
  escalated: 'var(--maintenance-escalated)',
  deferred: 'var(--maintenance-deferred)',
  overdue: 'var(--maintenance-overdue)',
  dueSoon: 'var(--maintenance-due-soon)'
});

export function isMaintenanceCompleted(item) {
  const status = String(item.status || '').trim().toUpperCase();
  return status ? status === 'COMPLETED' : item.completed === true;
}

export function maintenanceVisible(item, visibility) {
  return visibility === 'all' || (visibility === 'archived' ? item.archived === true : item.archived !== true);
}

export function maintenanceStatusColour(item) {
  const status = String(item.status || '').trim().toUpperCase();
  if (status === 'ESCALATED') return maintenanceColours.escalated;
  if (status === 'DEFERRED') return maintenanceColours.deferred;
  if (isMaintenanceCompleted(item)) return maintenanceColours.completed;
  return '';
}
