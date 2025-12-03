import * as API from './api.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';

let allRepos = [];
let currentFilteredRepos = [];
let currentSortDirection = 'desc';
let currentUsername = '';

document.addEventListener('DOMContentLoaded', () => {
  Utils.applyTheme(localStorage.getItem('gh_theme') || 'default');

  if (document.getElementById('username-input')) {
    loadHistory();
  }

  const fetchBtn = document.getElementById('fetch-btn');
  if (fetchBtn) fetchBtn.addEventListener('click', () => handleFetchRepos(false));

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => handleFetchRepos(true));

  const usernameInput = document.getElementById('username-input');
  if (usernameInput) {
    usernameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleFetchRepos(false);
    });

    const historyDropdown = document.getElementById('history-dropdown');
    if (historyDropdown) {
      usernameInput.addEventListener('focus', () => {
        if (historyDropdown.children.length > 0) historyDropdown.classList.add('show');
      });
      usernameInput.addEventListener('blur', () => {
        setTimeout(() => historyDropdown.classList.remove('show'), 200);
      });
    }
  }

  const filterInput = document.getElementById('filter-input');
  if (filterInput) {
    filterInput.addEventListener('input', runFiltersAndRender);
    ['language-select', 'topic-select', 'sort-select', 'commit-filter-min', 'commit-filter-max'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', runFiltersAndRender);
        el.addEventListener('input', runFiltersAndRender);
      }
    });

    const sortBtn = document.getElementById('sort-direction-btn');
    if (sortBtn) {
      sortBtn.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
        btn.classList.toggle('asc', currentSortDirection === 'asc');
        btn.querySelector('.material-symbols-outlined').textContent = currentSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
        runFiltersAndRender();
      });
    }
  }

  const repoList = document.getElementById('repo-list');
  if (repoList) {
    repoList.addEventListener('click', async (e) => {
      const card = e.target.closest('.repo-card');
      if (!card) return;

      const owner = card.dataset.owner;
      const repoName = card.dataset.repoName;

      if (e.target.closest('.btn-copy')) {
        Utils.copyToClipboard(card.dataset.cloneUrl);
        return;
      }

      if (e.target.closest('.view-commits-btn')) {
        openCommitsModal(owner, repoName);
        return;
      }

      if (e.target.closest('a')) return;

      openReadmeModal(owner, repoName);
    });
  }

  const downloadReposBtn = document.getElementById('download-repos-btn');
  if (downloadReposBtn) {
    downloadReposBtn.addEventListener('click', openDownloadModal);
  }

  const viewStatsBtn = document.getElementById('view-stats-btn');
  if (viewStatsBtn) {
    viewStatsBtn.addEventListener('click', calculateAndOpenStats);
  }

  const selectAll = document.getElementById('download-select-all');
  const downloadListContent = document.getElementById('download-list-content');
  const downloadSelectedBtn = document.getElementById('download-selected-btn');

  if (selectAll && downloadListContent) {
    selectAll.addEventListener('change', () => {
      downloadListContent.querySelectorAll('.download-checkbox').forEach(cb => cb.checked = selectAll.checked);
    });
    downloadListContent.addEventListener('change', (e) => {
      if (e.target.classList.contains('download-checkbox') && !e.target.checked) selectAll.checked = false;
    });
  }
  if (downloadSelectedBtn) {
    downloadSelectedBtn.addEventListener('click', handleDownloadSelected);
  }

  setupModalClosers();
});

async function loadHistory() {
  const list = document.getElementById('history-dropdown');
  if (!list) return;
  const history = await API.fetchSearchHistory();
  list.innerHTML = '';
  history.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="material-symbols-outlined">history</span> ${item.username}`;
    li.addEventListener('click', () => {
      document.getElementById('username-input').value = item.username;
      list.classList.remove('show');
      handleFetchRepos(false);
    });
    list.appendChild(li);
  });
}

async function handleFetchRepos(forceRefresh) {
  const usernameInput = document.getElementById('username-input');
  const skeletonLoader = document.getElementById('skeleton-loader');
  const errorMessage = document.getElementById('error-message');
  const landingPage = document.getElementById('landing-page');
  const appContent = document.getElementById('app-content');

  currentUsername = usernameInput.value.trim();
  if (!currentUsername) { errorMessage.textContent = 'Please enter a username.'; return; }

  landingPage.style.display = 'none';
  appContent.style.display = 'block';

  document.getElementById('repo-list').innerHTML = '';
  document.getElementById('profile-section').style.display = 'none';
  document.getElementById('profile-readme-container').style.display = 'none';
  document.getElementById('commit-filter-container').style.display = 'none';
  errorMessage.textContent = '';

  skeletonLoader.style.display = 'grid';

  try {
    const data = await API.fetchUser(currentUsername, '', forceRefresh);
    const { profile, repos, profileReadme } = data;
    allRepos = repos.map(repo => ({ ...repo, commit_count: undefined }));

    UI.renderProfile(profile, `https://ghchart.rshah.org/1F6FEB/${profile.login}`);
    UI.renderProfileReadme(profileReadme);
    UI.populateFilters(allRepos);

    runFiltersAndRender();
    loadHistory();

    fetchAndRenderCommitCounts('', forceRefresh);

  } catch (error) {
    console.error(error);
    errorMessage.textContent = error.message;
    allRepos = [];
    runFiltersAndRender();
  } finally {
    skeletonLoader.style.display = 'none';
  }
}

function runFiltersAndRender() {
  const filterInput = document.getElementById('filter-input');
  if (!filterInput) return;

  const filterText = filterInput.value.toLowerCase();
  const selectedLang = document.getElementById('language-select').value;
  const selectedTopic = document.getElementById('topic-select').value;
  const sortBy = document.getElementById('sort-select').value;

  const minVal = document.getElementById('commit-filter-min').value === '' ? 0 : parseInt(document.getElementById('commit-filter-min').value, 10);
  const maxVal = document.getElementById('commit-filter-max').value === '' ? Infinity : parseInt(document.getElementById('commit-filter-max').value, 10);

  let filtered = allRepos.filter(repo => {
    const nameMatch = repo.name.toLowerCase().includes(filterText);
    const langMatch = selectedLang === 'all' || repo.language === selectedLang;
    const topicMatch = selectedTopic === 'all' || (repo.topics && repo.topics.includes(selectedTopic));
    const commitCount = repo.commit_count === null ? 0 : repo.commit_count;
    const commitMatch = repo.commit_count === undefined || (commitCount >= minVal && commitCount <= maxVal);
    return nameMatch && langMatch && topicMatch && commitMatch;
  });

  filtered.sort((a, b) => {
    let valA, valB;
    switch (sortBy) {
      case 'stars': valA = a.stargazers_count; valB = b.stargazers_count; break;
      case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      case 'updated': valA = new Date(a.updated_at); valB = new Date(b.updated_at); break;
      case 'created': valA = new Date(a.created_at); valB = new Date(b.created_at); break;
      case 'commits': valA = a.commit_count ?? 0; valB = b.commit_count ?? 0; break;
      default: return 0;
    }
    return currentSortDirection === 'asc' ? valA - valB : valB - valA;
  });

  currentFilteredRepos = filtered;
  UI.renderRepoList(filtered);
}

async function fetchAndRenderCommitCounts(token, refresh = false) {
  const countPromises = allRepos.map(repo => API.fetchCommitCount(repo.owner.login, repo.name, token, refresh));
  const results = await Promise.allSettled(countPromises);
  let needRender = false;
  let totalCommits = 0;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allRepos[index].commit_count = result.value;
      if (result.value !== null) totalCommits += result.value;
      needRender = true;
    }
  });

  if (needRender) {
    document.getElementById('commit-filter-container').style.display = 'flex';
    const profileCommits = document.getElementById('profile-commits');
    if (profileCommits) {
      profileCommits.innerHTML = `<span class="material-symbols-outlined">commit</span> ${totalCommits.toLocaleString()} commits (public)`;
    }
    runFiltersAndRender();
  }
}

function setupModalClosers() {
  ['readme-modal', 'commits-modal', 'download-modal', 'stats-modal'].forEach(id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    const closeBtn = modal.querySelector('.modal-close-btn');
    const closer = () => { modal.style.display = 'none'; document.body.style.overflow = ''; };
    closeBtn.addEventListener('click', closer);
    modal.addEventListener('click', (e) => { if (e.target === modal) closer(); });
  });
}

async function openReadmeModal(owner, repoName) {
  const modal = document.getElementById('readme-modal');
  const content = document.getElementById('readme-content');
  const loader = document.getElementById('modal-loader');

  content.innerHTML = '';
  loader.style.display = 'flex';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  try {
    const data = await API.fetchRepoReadme(owner, repoName, '');
    if (data.content) {
      content.innerHTML = marked.parse(Utils.decodeReadmeContent(data.content));
    } else {
      content.innerHTML = '<p class="error-message">No README found.</p>';
    }
  } catch (e) {
    content.innerHTML = `<p class="error-message">Could not load README.</p>`;
  } finally {
    loader.style.display = 'none';
  }
}

async function openCommitsModal(owner, repoName) {
  const modal = document.getElementById('commits-modal');
  const title = document.getElementById('commits-modal-title');
  const list = document.getElementById('commits-list-content');
  const loader = document.getElementById('commits-modal-loader');

  list.innerHTML = '';
  title.textContent = `Commit History: ${repoName}`;
  loader.style.display = 'flex';
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  try {
    const commits = await API.fetchRepoCommits(owner, repoName, '');

    if (!commits || commits.length === 0) {
      list.innerHTML = `<p class="error-message">No commits found or API Error.</p>`;
    } else {
      list.innerHTML = commits.map(c => {
        const avatar = c.author && c.author.avatar_url ? c.author.avatar_url : "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
        const authorName = c.commit && c.commit.author ? c.commit.author.name : "Unknown";
        const date = c.commit && c.commit.author ? new Date(c.commit.author.date).toLocaleDateString() : "";
        const message = c.commit && c.commit.message ? c.commit.message.split('\n')[0] : "No message";

        return `
                    <div class="commit-item">
                        <img src="${avatar}" alt="avatar" class="commit-avatar">
                        <div class="commit-details">
                            <p class="commit-message">${message}</p>
                            <p class="commit-author"><span>${authorName}</span> committed on ${date}</p>
                        </div>
                        <a href="${c.html_url}" target="_blank" class="commit-sha">${c.sha.substring(0, 7)}</a>
                    </div>`;
      }).join('');
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = `<p class="error-message">Error loading commits: ${e.message}</p>`;
  } finally {
    loader.style.display = 'none';
  }
}

function openDownloadModal() {
  const modal = document.getElementById('download-modal');
  const title = document.getElementById('download-modal-title');
  const list = document.getElementById('download-list-content');
  const selectAll = document.getElementById('download-select-all');
  const downloadBtn = document.getElementById('download-selected-btn');

  title.textContent = `Download Repos (${currentFilteredRepos.length})`;

  if (currentFilteredRepos.length === 0) {
    list.innerHTML = '<p class="error-message" style="text-align:left;padding:0;">No repos to download.</p>';
    selectAll.disabled = true; downloadBtn.disabled = true;
  } else {
    // Include data-repo and data-filename for backend downloader
    list.innerHTML = currentFilteredRepos.map(repo => `
            <div class="download-item">
                <label class="download-item-info">
                    <input type="checkbox"
                           class="download-checkbox"
                           data-zip-url="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip"
                           data-repo="${repo.name}"
                           data-filename="${repo.name}-source.zip">
                    <span>${repo.name}</span>
                </label>
                <a href="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip" class="btn btn-icon btn-download-single" onclick="event.stopPropagation()"><span class="material-symbols-outlined">download</span></a>
            </div>`).join('');
    selectAll.disabled = false; downloadBtn.disabled = false;
  }
  selectAll.checked = false;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function calculateAndOpenStats() {
  if (!allRepos || allRepos.length === 0) return;

  const langCounts = {};
  let totalReposWithLang = 0;

  allRepos.forEach(repo => {
    if (repo.language) {
      langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
      totalReposWithLang++;
    }
  });

  const sortedLangs = Object.entries(langCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([lang, count]) => ({
      lang,
      count,
      percentage: totalReposWithLang > 0 ? ((count / totalReposWithLang) * 100).toFixed(1) : 0
    }));

  const totalStars = allRepos.reduce((acc, r) => acc + r.stargazers_count, 0);
  const totalForks = allRepos.reduce((acc, r) => acc + r.forks_count, 0);
  const avgSize = (allRepos.reduce((acc, r) => acc + r.size, 0) / (allRepos.length || 1) / 1024).toFixed(2);

  UI.renderStats({
    languages: sortedLangs,
    summary: [
      { icon: 'star', label: 'Total Stars', value: totalStars },
      { icon: 'share', label: 'Total Forks', value: totalForks },
      { icon: 'book', label: 'Repositories', value: allRepos.length },
      { icon: 'save', label: 'Avg Repo Size', value: `${avgSize} MB` }
    ]
  });

  document.getElementById('stats-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Uses Backend Downloader to avoid browser blocking
async function handleDownloadSelected() {
  const checked = document.querySelectorAll('.download-checkbox:checked');
  if (checked.length === 0) { Utils.showToast('No repos selected.'); return; }

  const downloadBtn = document.getElementById('download-selected-btn');
  downloadBtn.disabled = true;
  downloadBtn.innerHTML = '<div class="loader-small"></div> Processing...';

  // We assume backend will handle rate limits or token if provided in settings
  // If you have a token stored in API.js/DB, it will be used.
  // We'll pass '' as token here, assuming backend uses stored token.
  const token = '';

  let successCount = 0;

  for (const cb of checked) {
    const url = cb.dataset.zipUrl;
    const repo = cb.dataset.repo;
    const filename = cb.dataset.filename;

    Utils.showToast(`Downloading ${filename}...`);

    // Use the V2 Local Downloader
    const result = await API.downloadAssetLocal(url, filename, repo, token);
    if (result.success) successCount++;
  }

  Utils.showToast(`Completed. ${successCount}/${checked.length} saved to local folder.`);

  downloadBtn.disabled = false;
  downloadBtn.innerHTML = '<span class="material-symbols-outlined">download</span> Download Selected';

  // Optional: uncheck all after success
  checked.forEach(cb => cb.checked = false);
  document.getElementById('download-select-all').checked = false;
}