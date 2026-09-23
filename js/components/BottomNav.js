export function wireBottomNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = '#' + btn.dataset.route;
    });
  });
}