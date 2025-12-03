import * as API from './api.js';
import * as Utils from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  Utils.applyTheme(localStorage.getItem('gh_theme') || 'default');
  initSettings();
});

async function initSettings() {
  // --- 1. Theme Logic (Grid) ---
  const themeOptions = document.querySelectorAll('.theme-option');
  const currentTheme = localStorage.getItem('gh_theme') || 'default';

  themeOptions.forEach(opt => {
    if (opt.dataset.theme === currentTheme) opt.classList.add('active');

    opt.addEventListener('click', () => {
      themeOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');

      const themeName = opt.dataset.theme;
      Utils.applyTheme(themeName);
    });
  });

  // --- 2. Token Logic ---
  const tokenInput = document.getElementById('token-input');
  const toggleBtn = document.getElementById('toggle-token-btn');

  const savedToken = await API.fetchSavedToken();
  if (savedToken) tokenInput.value = savedToken;

  toggleBtn.addEventListener('click', () => {
    // Toggle the CSS masking class instead of input type
    tokenInput.classList.toggle('secure-text');

    const isHidden = tokenInput.classList.contains('secure-text');
    toggleBtn.querySelector('span').textContent = isHidden ? 'visibility_off' : 'visibility';
  });

  document.getElementById('save-token-btn').addEventListener('click', async () => {
    await API.saveTokenToDB(tokenInput.value.trim());
    Utils.showToast("GitHub Token saved successfully.");
  });

  // --- 3. Download Path Logic ---
  const pathInput = document.getElementById('download-path-input');
  const savedPath = await API.fetchDownloadPath();
  if (savedPath) pathInput.value = savedPath;

  document.getElementById('save-path-btn').addEventListener('click', async () => {
    const path = pathInput.value.trim();
    if (!path) return;
    const success = await API.saveDownloadPath(path);
    if (success) Utils.showToast("Download path updated.");
    else Utils.showToast("Error: Invalid path or permission denied.");
  });

  // --- 4. Import Logic ---
  const fileInput = document.getElementById('import-file-input');
  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      const btn = fileInput.parentElement;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined spin">sync</span> Importing...';

      const res = await API.importWatchlist(e.target.files[0]);

      btn.innerHTML = originalText;
      Utils.showToast(res.message);
    }
  });
}
