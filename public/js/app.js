function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function parseDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
