export function showToast(message) {
  const toastNotification = document.getElementById('toast-notification');
  // Clear any existing timer if stored on the element
  if (toastNotification.dataset.timer) clearTimeout(parseInt(toastNotification.dataset.timer));

  toastNotification.textContent = message;
  toastNotification.classList.add('show');

  const timer = setTimeout(() => {
    toastNotification.classList.remove('show');
  }, 3000);
  toastNotification.dataset.timer = timer;
}

export function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast('Clone URL copied!'))
    .catch(() => showToast('Failed to copy.'));
}

export function applyTheme(themeName) {
  const themeSelect = document.getElementById('theme-select');
  document.body.className = `theme-${themeName}`;
  themeSelect.value = themeName;
  localStorage.setItem('gh_theme', themeName);
}

export function getLangColor(lang) {
  const colors = { 'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'HTML': '#e34c26', 'CSS': '#563d7c', 'Python': '#3572A5', 'Java': '#b07219', 'C#': '#178600', 'C++': '#f34b7d', 'Go': '#00ADD8', 'Ruby': '#701516', 'PHP': '#4F5D95', 'Shell': '#89e051' };
  return colors[lang] || '#cccccc';
}

export function decodeReadmeContent(base64Content) {
  try {
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
    return new TextDecoder().decode(bytes);
  } catch (e) { return "Error decoding content."; }
}
