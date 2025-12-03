export function showToast(message) {
  const toastNotification = document.getElementById('toast-notification');
  if (!toastNotification) return; // Safety check

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
  // 1. Apply class to body
  document.body.className = `theme-${themeName}`;

  // 2. Save preference
  localStorage.setItem('gh_theme', themeName);

  // 3. Update Dropdown (Only if it exists on this page)
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.value = themeName;
  }

  // 4. Update Theme Cards (Only if on Settings page)
  const themeOptions = document.querySelectorAll('.theme-option');
  if (themeOptions.length > 0) {
    themeOptions.forEach(opt => {
      if (opt.dataset.theme === themeName) opt.classList.add('active');
      else opt.classList.remove('active');
    });
  }
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
