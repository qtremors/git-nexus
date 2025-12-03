import { getLangColor, decodeReadmeContent, showToast } from './utils.js';

export function renderProfile(profile, graphUrl) {
  if (!profile) return;
  document.getElementById('profile-avatar').src = profile.avatar_url;
  document.getElementById('profile-name').textContent = profile.name || profile.login;
  document.getElementById('profile-login').textContent = `@${profile.login}`;
  document.getElementById('profile-bio').textContent = profile.bio || 'No bio provided.';

  // Text/Icon Style
  document.getElementById('profile-followers').innerHTML = `<span class="material-symbols-outlined">group</span> ${profile.followers} followers`;
  document.getElementById('profile-following').innerHTML = `<span class="material-symbols-outlined">person_add</span> ${profile.following} following`;
  document.getElementById('profile-repos').innerHTML = `<span class="material-symbols-outlined">book</span> ${profile.public_repos} public repos`;

  document.getElementById('profile-link').href = profile.html_url;
  document.getElementById('profile-section').style.display = 'flex';

  if (graphUrl) document.getElementById('contribution-graph').src = graphUrl;
}

export function renderProfileReadme(readmeData) {
  const container = document.getElementById('profile-readme-container');
  const content = document.getElementById('profile-readme-content');

  if (!readmeData || !readmeData.content) {
    container.style.display = 'none';
    return;
  }
  try {
    content.innerHTML = marked.parse(decodeReadmeContent(readmeData.content));
    container.style.display = 'block';
  } catch (error) { container.style.display = 'none'; }
}

export function renderRepoList(repos) {
  const repoList = document.getElementById('repo-list');
  repoList.innerHTML = '';

  if (repos.length === 0) {
    repoList.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined empty-icon">folder_off</span>
                <h3>No Repositories Found</h3>
                <p>Try adjusting your filters or search for a different user.</p>
            </div>
        `;
    return;
  }

  const fragment = document.createDocumentFragment();
  repos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'repo-card';
    card.dataset.owner = repo.owner.login;
    card.dataset.repoName = repo.name;
    card.dataset.cloneUrl = repo.clone_url;

    const topicsHTML = (repo.topics || []).map(topic => `<span class="topic-tag">${topic}</span>`).join('');

    let commitCountHTML;
    if (repo.commit_count === undefined) {
      commitCountHTML = `<div class="loader-small"></div>`;
    } else if (repo.commit_count === null) {
      commitCountHTML = `<span class="material-symbols-outlined" style="color: var(--md-sys-color-error); font-size: 20px; cursor: help;" title="Rate Limit Hit. Add Token.">warning</span>`;
    } else {
      commitCountHTML = repo.commit_count.toLocaleString();
    }

    const homepageLink = repo.homepage ? `<a href="${repo.homepage}" target="_blank" class="btn-icon" onclick="event.stopPropagation()"><span class="material-symbols-outlined">language</span></a>` : '';
    const downloadLink = `<a href="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip" onclick="event.stopPropagation()" class="btn-icon"><span class="material-symbols-outlined">download</span></a>`;

    card.innerHTML = `
            <div class="repo-card-header">
                <h3><a href="${repo.html_url}" target="_blank" onclick="event.stopPropagation()">${repo.name}</a></h3>
                <div class="repo-card-links">${homepageLink}${downloadLink}</div>
            </div>
            <p class="description">${repo.description || 'No description provided.'}</p>
            ${(repo.topics && repo.topics.length > 0) ? `<div class="repo-topics">${topicsHTML}</div>` : ''}
            <div class="repo-stats">
                ${repo.language ? `<span class="stat-item"><span class="language-dot" style="background-color: ${getLangColor(repo.language)};"></span>${repo.language}</span>` : ''}
                <span class="stat-item"><span class="material-symbols-outlined">star</span>${repo.stargazers_count}</span>
                <span class="stat-item"><span class="material-symbols-outlined">share</span>${repo.forks_count}</span>
                <span class="stat-item commit-count"><span class="material-symbols-outlined">commit</span>${commitCountHTML}</span>
                <span class="stat-item"><span class="material-symbols-outlined">calendar_today</span>${new Date(repo.created_at).toLocaleDateString()}</span>
                <span class="stat-item"><span class="material-symbols-outlined">update</span>${new Date(repo.updated_at).toLocaleDateString()}</span>
            </div>
            <div class="repo-card-actions">
                <button class="btn btn-outlined view-commits-btn"><span class="material-symbols-outlined">history</span><span>View Commits</span></button>
                <button class="btn btn-outlined btn-copy"><span class="material-symbols-outlined">content_copy</span></button>
            </div>
        `;
    fragment.appendChild(card);
  });
  repoList.appendChild(fragment);
}

export function populateFilters(repos) {
  const langSet = new Set();
  const topicSet = new Set();
  repos.forEach(repo => {
    if (repo.language) langSet.add(repo.language);
    if (repo.topics) repo.topics.forEach(topic => topicSet.add(topic));
  });

  const languageSelect = document.getElementById('language-select');
  const allLangs = [...langSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  languageSelect.innerHTML = '<option value="all">All Languages</option>';
  allLangs.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    languageSelect.appendChild(option);
  });

  const topicSelect = document.getElementById('topic-select');
  const allTopics = [...topicSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  topicSelect.innerHTML = '<option value="all">All Topics</option>';
  allTopics.forEach(topic => {
    const option = document.createElement('option');
    option.value = topic;
    option.textContent = topic;
    topicSelect.appendChild(option);
  });
}

export function updateHistoryList(historyData) {
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '';
  historyData.forEach(item => {
    const option = document.createElement('option');
    option.value = item.username;
    historyList.appendChild(option);
  });
}

export function renderStats(statsData) {
  const statsLanguageList = document.getElementById('stats-language-list');
  const statsSummary = document.getElementById('stats-summary');

  if (statsData.languages.length === 0) {
    statsLanguageList.innerHTML = '<p style="color:var(--md-sys-color-on-surface-variant);">No language data available.</p>';
  } else {
    statsLanguageList.innerHTML = statsData.languages.map(item => {
      return `
                <div style="display: flex; align-items: center; justify-content: space-between; background: var(--md-sys-color-surface); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--md-sys-color-outline);">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="language-dot" style="background-color: ${getLangColor(item.lang)};"></span>
                        <span style="font-weight: 500;">${item.lang}</span>
                    </div>
                    <div style="color: var(--md-sys-color-on-surface-variant); font-size: 14px;">
                        ${item.count} repos (${item.percentage}%)
                    </div>
                </div>
            `;
    }).join('');
  }

  statsSummary.innerHTML = statsData.summary.map(item => `
        <div style="background: var(--md-sys-color-surface); padding: 16px; border-radius: 8px; border: 1px solid var(--md-sys-color-outline); text-align: center;">
            <span class="material-symbols-outlined" style="font-size: 24px; color: var(--md-sys-color-primary); margin-bottom: 8px;">${item.icon}</span>
            <div style="font-size: 20px; font-weight: 700;">${item.value}</div>
            <div style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">${item.label}</div>
        </div>
    `).join('');
}
