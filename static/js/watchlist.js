import * as API from './api.js';
import * as Utils from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  Utils.applyTheme(localStorage.getItem('gh_theme') || 'default');

  loadWatchlist();

  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', handleCheckUpdates);
  }

  // Add Repo Modal Logic
  const addModal = document.getElementById('add-repo-modal');
  const addRepoBtn = document.getElementById('add-repo-btn');
  const urlInput = document.getElementById('repo-url-input');
  const errorMsg = document.getElementById('add-error-msg');
  const closeAddModal = document.getElementById('close-add-modal');
  const confirmAddBtn = document.getElementById('confirm-add-btn');

  if (addRepoBtn) {
    addRepoBtn.addEventListener('click', () => {
      addModal.style.display = 'flex';
      urlInput.value = '';
      errorMsg.style.display = 'none';
      urlInput.focus();
    });
  }

  if (closeAddModal) {
    closeAddModal.addEventListener('click', () => addModal.style.display = 'none');
    addModal.addEventListener('click', (e) => { if (e.target === addModal) addModal.style.display = 'none'; });
  }

  if (confirmAddBtn) {
    confirmAddBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) return;

      confirmAddBtn.disabled = true;
      confirmAddBtn.innerHTML = '<div class="loader-small"></div> Adding...';

      // Pass empty token, backend uses DB token
      const result = await API.addRepoByUrl(url, '');

      confirmAddBtn.disabled = false;
      confirmAddBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Add to Watchlist';

      if (result.success) {
        addModal.style.display = 'none';
        Utils.showToast(result.message);
        loadWatchlist();
      } else {
        errorMsg.textContent = result.message;
        errorMsg.style.display = 'block';
      }
    });
  }
});

async function loadWatchlist() {
  const grid = document.getElementById('watchlist-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

  try {
    const repos = await API.fetchWatchlist();

    const statusText = document.getElementById('watchlist-status');
    if (statusText) statusText.textContent = `${repos.length} Repositories tracked.`;

    grid.innerHTML = '';
    if (repos.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="material-symbols-outlined empty-icon">playlist_add</span><h3>Your watchlist is empty</h3><p>Click "Add Repo" to start tracking assets.</p></div>`;
      return;
    }

    for (const repo of repos) {
      const isUpdate = repo.latest_version && repo.latest_version !== repo.current_version && repo.current_version !== "Not Checked";
      const statusClass = isUpdate ? 'status-update' : 'status-current';
      const statusText = isUpdate ? 'Update Available' : 'Up to Date';
      const statusIcon = isUpdate ? 'arrow_upward' : 'check';

      const card = document.createElement('div');
      card.className = `release-card ${isUpdate ? 'has-update' : ''}`;

      card.innerHTML = `
                <div class="card-header">
                    <img src="${repo.avatar_url}" class="repo-icon" alt="icon">
                    <div class="header-content">
                        <a href="${repo.html_url}/releases" target="_blank" class="repo-name" title="View Releases">${repo.name}</a>
                        <div class="repo-author">${repo.owner}</div>
                        <div class="status-badge ${statusClass}">
                            <span class="material-symbols-outlined" style="font-size:14px;">${statusIcon}</span> ${statusText}
                        </div>
                    </div>
                </div>

                <div class="version-row">
                    <span class="v-old">${repo.current_version}</span>
                    <span class="material-symbols-outlined v-arrow" style="font-size:14px;">arrow_forward</span>
                    <span class="v-new">${repo.latest_version || '?'}</span>
                </div>

                <div class="releases-container" id="releases-${repo.id}">
                    <div class="loader-small" style="margin: 0 auto;"></div>
                </div>

                <div class="card-footer">
                     <button class="btn btn-outlined btn-untrack" style="flex:1;">
                        <span class="material-symbols-outlined">delete</span> Stop Tracking
                    </button>
                </div>
            `;

      card.querySelector('.btn-untrack').addEventListener('click', async () => {
        if (confirm(`Stop tracking ${repo.name}?`)) {
          await API.untrackRepo(repo.id);
          loadWatchlist();
        }
      });
      grid.appendChild(card);

      loadReleasesForCard(repo, `releases-${repo.id}`);
    }
  } catch (e) {
    console.error("Watchlist Load Error:", e);
    grid.innerHTML = `<p class="error-message">Failed to load watchlist.</p>`;
  }
}

async function loadReleasesForCard(repo, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const releases = await API.fetchRepoDetails(repo.owner, repo.name, '');

  if (releases.length === 0) {
    container.innerHTML = '<p style="text-align:center; font-size:12px; color:var(--md-sys-color-on-surface-variant);">No releases found.</p>';
    return;
  }

  container.innerHTML = '';
  releases.forEach((release) => {
    // Build Assets HTML
    const assetsHtml = release.assets.map(asset => {
      const size = (asset.size / 1024 / 1024).toFixed(1) + ' MB';
      return `
                <div class="asset-item">
                    <div style="overflow:hidden;">
                        <div class="asset-name">${asset.name}</div>
                        <div class="asset-meta">${size} • ${new Date(asset.updated_at).toLocaleDateString()}</div>
                    </div>
                    <button class="btn-icon-small btn-download-asset"
                            title="Download Locally"
                            data-url="${asset.download_url}"
                            data-filename="${asset.name}"
                            data-repo="${repo.name}">
                        <span class="material-symbols-outlined">download</span>
                    </button>
                </div>
            `;
    }).join('');

    const accordion = document.createElement('div');

    accordion.className = 'release-accordion';

    accordion.innerHTML = `
            <div class="release-summary">
                <span class="release-tag">${release.tag_name}</span>
                <span class="release-date">${new Date(release.published_at).toLocaleDateString()}</span>
                <span class="material-symbols-outlined arrow-icon" style="font-size:18px;">expand_more</span>
            </div>
            <div class="asset-list">
                ${assetsHtml || '<p style="padding:8px; font-size:12px;">No binary assets.</p>'}
            </div>
        `;

    accordion.querySelector('.release-summary').addEventListener('click', () => {
      const wasOpen = accordion.classList.contains('open');
      if (!wasOpen) accordion.classList.add('open');
      else accordion.classList.remove('open');
      accordion.querySelector('.arrow-icon').textContent = accordion.classList.contains('open') ? 'expand_less' : 'expand_more';
    });

    // Local Download Logic
    accordion.querySelectorAll('.btn-download-asset').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<div class="loader-small" style="width:12px;height:12px;border-width:2px;"></div>';
        btn.disabled = true;
        Utils.showToast(`Downloading ${btn.dataset.filename}...`);

        const result = await API.downloadAssetLocal(
          btn.dataset.url,
          btn.dataset.filename,
          btn.dataset.repo,
          ''
        );

        btn.disabled = false;
        if (result.success) {
          btn.innerHTML = '<span class="material-symbols-outlined" style="color:var(--md-sys-color-success);">check_circle</span>';
          Utils.showToast(`Saved to: ${result.path}`);
        } else {
          btn.innerHTML = '<span class="material-symbols-outlined" style="color:var(--md-sys-color-error);">error</span>';
          Utils.showToast(`Error: ${result.message}`);
          setTimeout(() => btn.innerHTML = originalIcon, 3000);
        }
      });
    });

    container.appendChild(accordion);
  });
}

async function handleCheckUpdates() {
  const btn = document.getElementById('check-updates-btn');
  if (!btn) return;

  btn.disabled = true;
  Utils.showToast("Checking GitHub for updates...");

  try {
    const res = await API.checkUpdates('');
    btn.disabled = false;
    Utils.showToast(`Check complete. ${res.updates_found} updates found.`);
    loadWatchlist();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    Utils.showToast("Update check failed.");
  }
}
