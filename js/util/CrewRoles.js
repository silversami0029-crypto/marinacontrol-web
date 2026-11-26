// Crew job titles are descriptive; authentication roles live in marina memberships.
export const CREW_JOB_ROLES = [
  'Dock Master', 'Harbor Master', 'Marina Staff', 'Technician', 'Supervisor',
  'Captain', 'First Mate', 'Mate', 'Deck Officer', 'Deckhand', 'Engineer',
  'Chief Engineer', 'Navigator', 'Boatswain', 'Steward', 'Stewardess', 'Cook',
  'Pilot', 'Guest', 'Owner'
];
const ACCESS_LABELS = new Set(['admin', 'administrator', 'manager', 'staff', 'inspector', 'viewer', 'view only', 'view-only']);
export function isCrewAccessLabel(value) { return ACCESS_LABELS.has(String(value || '').trim().toLowerCase()); }
export function crewJobRoleText(value) {
  const role = String(value || '').trim();
  return !role ? 'Job role not set' : isCrewAccessLabel(role) ? `Previous label: ${role} (choose a job role)` : role;
}
export function crewRoleOptions(current, translate = value => value) {
  const value = String(current || '');
  const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options = [`<option value=""${!value ? ' selected' : ''}>${escape(translate('Job role not set'))}</option>`];
  if (value && !CREW_JOB_ROLES.includes(value)) {
    options.push(`<option value="${escape(value)}" selected disabled>${escape(translate(crewJobRoleText(value)))}</option>`);
  }
  return options.concat(CREW_JOB_ROLES.map(role => `<option value="${escape(role)}"${role === value ? ' selected' : ''}>${escape(translate(role))}</option>`)).join('');
}
