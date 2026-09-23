export function initials(text) {
  if (!text) return '?';
  return text.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('');
}

export function formatSyncTime(timestamp) {
  if (!timestamp || timestamp <= 0) return 'Never';
  const diff = Date.now() - timestamp;

  if (diff < 60_000)     return 'Just now';
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  const d = Math.floor(diff / 86_400_000);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function debounce(fn, ms = 150) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}