import * as API from './api.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';

// --- State ---
let allRepos = [];
let currentFilteredRepos = [];
let currentSortDirection = 'desc';
let currentUsername = '';

document.addEventListener('DOMContentLoaded', () => {
  // Initial Setup
  Utils.applyTheme(localStorage.getItem('gh_theme') || 'default');
  loadSavedToken();
  loadHistory();

  // -- Header Events --
  document.getElementById('fetch-btn').addEventListener('click', () => handleFetchRepos(false));
  document.getElementById('refresh-btn').addEventListener('click', () => handleFetchRepos(true));

  // -- History Dropdown Logic --
  const usernameInput = document.getElementById('username-input');
  const historyDropdown = document.getElementById('history-dropdown');

  usernameInput.addEventListener('focus', () => {
    if (historyDropdown.children.length > 0) historyDropdown.classList.add('show');
  });

  usernameInput.addEventListener('blur', () => {
    setTimeout(() => historyDropdown.classList.remove('show'), 200);
  });

  // -- Settings Dropdown Logic --
  const settingsBtn = document.getElementById('settings-btn');
  const settingsMenu = document.getElementById('settings-dropdown');
  const closeSettingsBtn = document.getElementById('close-settings-btn');

  settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); settingsMenu.classList.toggle('show'); });
  closeSettingsBtn.addEventListener('click', () => settingsMenu.classList.remove('show'));
  document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) settingsMenu.classList.remove('show');
  });

  // -- Settings Controls --
  document.getElementById('theme-select').addEventListener('change', (e) => Utils.applyTheme(e.target.value));

  const tokenInput = document.getElementById('token-input');
  document.getElementById('toggle-token-btn').addEventListener('click', function () {
    const type = tokenInput.getAttribute('type') === 'password' ? 'text' : 'password';
    tokenInput.setAttribute('type', type);
    this.querySelector('span').textContent = type === 'password' ? 'visibility_off' : 'visibility';
  });

  document.getElementById('save-token-btn').addEventListener('click', async () => {
    await API.saveTokenToDB(tokenInput.value.trim());
    Utils.showToast("Token saved to Database!");
    settingsMenu.classList.remove('show');
  });

  tokenInput.addEventListener('change', async (e) => await API.saveTokenToDB(e.target.value.trim()));

  // -- Filter/Sort Events --
  document.getElementById('filter-input').addEventListener('input', runFiltersAndRender);
  document.getElementById('language-select').addEventListener('change', runFiltersAndRender);
  document.getElementById('topic-select').addEventListener('change', runFiltersAndRender);
  document.getElementById('sort-select').addEventListener('change', runFiltersAndRender);
  document.getElementById('commit-filter-min').addEventListener('input', runFiltersAndRender);
  document.getElementById('commit-filter-max').addEventListener('input', runFiltersAndRender);

  const sortBtn = document.getElementById('sort-direction-btn');
  sortBtn.addEventListener('click', () => {
    currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
    sortBtn.classList.toggle('asc', currentSortDirection === 'asc');
    sortBtn.classList.toggle('desc', currentSortDirection === 'desc');
    sortBtn.querySelector('.material-symbols-outlined').textContent = currentSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
    runFiltersAndRender();
  });

  // -- Repo List Delegation --
  document.getElementById('repo-list').addEventListener('click', async (e) => {
    const card = e.target.closest('.repo-card');
    if (!card) return;
    const owner = card.dataset.owner;
    const repoName = card.dataset.repoName;

    if (e.target.closest('.btn-copy')) { Utils.copyToClipboard(card.dataset.cloneUrl); }
    else if (e.target.closest('.view-commits-btn')) { openCommitsModal(owner, repoName); }
    else { openReadmeModal(owner, repoName); }
  });

  // -- Modals --
  setupModalClosers();
  document.getElementById('download-repos-btn').addEventListener('click', openDownloadModal);
  document.getElementById('view-stats-btn').addEventListener('click', calculateAndOpenStats);

  const selectAll = document.getElementById('download-select-all');
  const downloadListContent = document.getElementById('download-list-content');
  selectAll.addEventListener('change', () => {
    downloadListContent.querySelectorAll('.download-checkbox').forEach(cb => cb.checked = selectAll.checked);
  });
  downloadListContent.addEventListener('change', (e) => {
    if (e.target.classList.contains('download-checkbox') && !e.target.checked) selectAll.checked = false;
  });
  document.getElementById('download-selected-btn').addEventListener('click', handleDownloadSelected);
});


// --- Functions ---

async function loadHistory() {
  const history = await API.fetchSearchHistory();
  const list = document.getElementById('history-dropdown');
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

async function loadSavedToken() {
  try {
    const token = await API.fetchSavedToken();
    if (token) document.getElementById('token-input').value = token;
  } catch (e) { console.error("Error loading token", e); }
}

async function handleFetchRepos(forceRefresh) {
  const usernameInput = document.getElementById('username-input');
  const tokenInput = document.getElementById('token-input');
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
    const data = await API.fetchUser(currentUsername, tokenInput.value.trim(), forceRefresh);

    const { profile, repos, profileReadme } = data;
    allRepos = repos.map(repo => ({ ...repo, commit_count: undefined }));

    UI.renderProfile(profile, `https://ghchart.rshah.org/1F6FEB/${profile.login}`);
    UI.renderProfileReadme(profileReadme);
    UI.populateFilters(allRepos);

    runFiltersAndRender();
    loadHistory();

    fetchAndRenderCommitCounts(tokenInput.value.trim());

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
  const filterText = document.getElementById('filter-input').value.toLowerCase();
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
      case 'name':
        valA = a.name.toLowerCase(); valB = b.name.toLowerCase();
        return currentSortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
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

async function fetchAndRenderCommitCounts(token) {
  const countPromises = allRepos.map(repo => API.fetchCommitCount(repo.owner.login, repo.name, token));

  const results = await Promise.allSettled(countPromises);
  let needRender = false;
  let totalCommits = 0;
  let rateLimitHit = false;

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allRepos[index].commit_count = result.value;
      if (result.value === null) rateLimitHit = true;
      else totalCommits += result.value;
      needRender = true;
    }
  });

  if (needRender) {
    document.getElementById('commit-filter-container').style.display = 'flex';
    const displayTotal = rateLimitHit ? `${totalCommits.toLocaleString()}+` : totalCommits.toLocaleString();

    // RESTORED: Original Text Style
    document.getElementById('profile-commits').innerHTML = `<span class="material-symbols-outlined">commit</span> ${displayTotal} commits (public)`;

    runFiltersAndRender();
    if (rateLimitHit) Utils.showToast("Rate Limit Hit. Some commit counts hidden.");
  }
}

// --- Modals & Helpers ---
function setupModalClosers() {
  const modals = ['readme-modal', 'commits-modal', 'download-modal', 'stats-modal'];
  modals.forEach(id => {
    const modal = document.getElementById(id);
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
  content.innerHTML = ''; loader.style.display = 'flex'; modal.style.display = 'flex'; document.body.style.overflow = 'hidden';
  try {
    const data = await API.fetchRepoReadme(owner, repoName, document.getElementById('token-input').value);
    content.innerHTML = marked.parse(Utils.decodeReadmeContent(data.content));
  } catch (e) { content.innerHTML = `<p class="error-message">${e.message}</p>`; } finally { loader.style.display = 'none'; }
}

async function openCommitsModal(owner, repoName) {
  const modal = document.getElementById('commits-modal');
  const title = document.getElementById('commits-modal-title');
  const list = document.getElementById('commits-list-content');
  const loader = document.getElementById('commits-modal-loader');
  list.innerHTML = ''; title.textContent = `Commit History: ${repoName}`; loader.style.display = 'flex'; modal.style.display = 'flex'; document.body.style.overflow = 'hidden';
  try {
    const commits = await API.fetchRepoCommits(owner, repoName, document.getElementById('token-input').value);
    if (commits.length === 0) { list.innerHTML = `<p class="error-message">No commits found.</p>`; return; }
    list.innerHTML = commits.map(c => `
            <div class="commit-item">
                <img src="${c.author ? c.author.avatar_url : "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"}" alt="avatar" class="commit-avatar">
                <div class="commit-details">
                    <p class="commit-message">${c.commit.message.split('\n')[0]}</p>
                    <p class="commit-author"><span>${c.commit.author.name}</span> committed on ${new Date(c.commit.author.date).toLocaleDateString()}</p>
                </div>
                <a href="${c.html_url}" target="_blank" class="commit-sha">${c.sha.substring(0, 7)}</a>
            </div>`).join('');
  } catch (e) { list.innerHTML = `<p class="error-message">${e.message}</p>`; } finally { loader.style.display = 'none'; }
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
    list.innerHTML = currentFilteredRepos.map(repo => `
            <div class="download-item">
                <label class="download-item-info"><input type="checkbox" class="download-checkbox" data-zip-url="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip"><span>${repo.name}</span></label>
                <a href="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip" class="btn btn-icon btn-download-single" onclick="event.stopPropagation()"><span class="material-symbols-outlined">download</span></a>
            </div>`).join('');
    selectAll.disabled = false; downloadBtn.disabled = false;
  }
  selectAll.checked = false; modal.style.display = 'flex'; document.body.style.overflow = 'hidden';
}

function calculateAndOpenStats() {
  if (!allRepos || allRepos.length === 0) return;
  const langCounts = {};
  let totalReposWithLang = 0;
  allRepos.forEach(repo => { if (repo.language) { langCounts[repo.language] = (langCounts[repo.language] || 0) + 1; totalReposWithLang++; } });
  const sortedLangs = Object.entries(langCounts).sort(([, countA], [, countB]) => countB - countA).map(([lang, count]) => ({ lang, count, percentage: ((count / totalReposWithLang) * 100).toFixed(1) }));
  const totalStars = allRepos.reduce((acc, r) => acc + r.stargazers_count, 0);
  const totalForks = allRepos.reduce((acc, r) => acc + r.forks_count, 0);
  const avgSize = (allRepos.reduce((acc, r) => acc + r.size, 0) / (allRepos.length || 1) / 1024).toFixed(2);
  UI.renderStats({ languages: sortedLangs, summary: [{ icon: 'star', label: 'Total Stars', value: totalStars }, { icon: 'share', label: 'Total Forks', value: totalForks }, { icon: 'book', label: 'Repositories', value: allRepos.length }, { icon: 'save', label: 'Avg Repo Size', value: `${avgSize} MB` }] });
  document.getElementById('stats-modal').style.display = 'flex'; document.body.style.overflow = 'hidden';
}

function handleDownloadSelected() {
  const checked = document.querySelectorAll('.download-checkbox:checked');
  if (checked.length === 0) { Utils.showToast('No repos selected.'); return; }
  Utils.showToast(`Downloading ${checked.length} files...`);
  checked.forEach((cb, i) => setTimeout(() => { const a = document.createElement('a'); a.href = cb.dataset.zipUrl; a.download = ''; document.body.appendChild(a); a.click(); document.body.removeChild(a); }, i * 1000));
}
