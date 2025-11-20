document.addEventListener('DOMContentLoaded', () => {
    // --- Constants & State ---
    let allRepos = [];
    let currentFilteredRepos = [];
    let currentUsername = '';
    let currentSortDirection = 'desc'; 
    let toastTimer;

    // --- DOM Elements ---
    const usernameInput = document.getElementById('username-input');
    const tokenInput = document.getElementById('token-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const filterInput = document.getElementById('filter-input');
    const sortSelect = document.getElementById('sort-select');
    const languageSelect = document.getElementById('language-select');
    const topicSelect = document.getElementById('topic-select');
    const repoList = document.getElementById('repo-list');
    const loader = document.getElementById('loader');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const errorMessage = document.getElementById('error-message');
    
    // Profile Elements
    const profileSection = document.getElementById('profile-section');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileName = document.getElementById('profile-name');
    const profileLogin = document.getElementById('profile-login');
    const profileBio = document.getElementById('profile-bio');
    const profileFollowers = document.getElementById('profile-followers');
    const profileFollowing = document.getElementById('profile-following');
    const profileRepos = document.getElementById('profile-repos');
    const profileCommits = document.getElementById('profile-commits');
    const profileLink = document.getElementById('profile-link');
    const profileReadmeContainer = document.getElementById('profile-readme-container');
    const profileReadmeContent = document.getElementById('profile-readme-content');

    // Modals
    const readmeModal = document.getElementById('readme-modal');
    const modalLoader = document.getElementById('modal-loader');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const readmeContent = document.getElementById('readme-content');
    const commitsModal = document.getElementById('commits-modal');
    const commitsModalLoader = document.getElementById('commits-modal-loader');
    const commitsModalCloseBtn = document.getElementById('commits-modal-close-btn');
    const commitsModalTitle = document.getElementById('commits-modal-title');
    const commitsListContent = document.getElementById('commits-list-content');
    const downloadReposBtn = document.getElementById('download-repos-btn');
    const downloadModal = document.getElementById('download-modal');
    const downloadModalCloseBtn = document.getElementById('download-modal-close-btn');
    const downloadModalTitle = document.getElementById('download-modal-title');
    const downloadListContent = document.getElementById('download-list-content');
    const downloadSelectAll = document.getElementById('download-select-all');
    const downloadSelectedBtn = document.getElementById('download-selected-btn');

    // Controls
    const themeSelect = document.getElementById('theme-select');
    const sortDirectionBtn = document.getElementById('sort-direction-btn');
    const commitFilterContainer = document.getElementById('commit-filter-container');
    const commitFilterMin = document.getElementById('commit-filter-min');
    const commitFilterMax = document.getElementById('commit-filter-max');
    const toastNotification = document.getElementById('toast-notification');

    // --- Initialization ---
    applyTheme(localStorage.getItem('gh_theme') || 'default');

    // --- Event Listeners ---
    fetchBtn.addEventListener('click', () => handleFetchRepos(false));
    refreshBtn.addEventListener('click', () => handleFetchRepos(true));
    filterInput.addEventListener('input', renderRepos);
    sortSelect.addEventListener('change', renderRepos);
    languageSelect.addEventListener('change', renderRepos);
    topicSelect.addEventListener('change', renderRepos);
    commitFilterMin.addEventListener('input', renderRepos);
    commitFilterMax.addEventListener('input', renderRepos);
    
    themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    sortDirectionBtn.addEventListener('click', toggleSortDirection);

    // Modal Listeners
    modalCloseBtn.addEventListener('click', hideReadmeModal);
    readmeModal.addEventListener('click', (e) => { if (e.target === readmeModal) hideReadmeModal(); });
    commitsModalCloseBtn.addEventListener('click', hideCommitsModal);
    commitsModal.addEventListener('click', (e) => { if (e.target === commitsModal) hideCommitsModal(); });
    
    downloadReposBtn.addEventListener('click', showDownloadModal);
    downloadModalCloseBtn.addEventListener('click', hideDownloadModal);
    downloadModal.addEventListener('click', (e) => { if (e.target === downloadModal) hideDownloadModal(); });
    downloadSelectAll.addEventListener('change', handleSelectAll);
    downloadSelectedBtn.addEventListener('click', handleDownloadSelected);
    downloadListContent.addEventListener('change', (e) => {
        if (e.target.classList.contains('download-checkbox')) {
            if (!e.target.checked) downloadSelectAll.checked = false;
            else {
                const allCheckboxes = downloadListContent.querySelectorAll('.download-checkbox');
                const allChecked = [...allCheckboxes].every(cb => cb.checked);
                downloadSelectAll.checked = allChecked;
            }
        }
    });

    repoList.addEventListener('click', (e) => {
        const card = e.target.closest('.repo-card');
        if (!card) return;
        const owner = card.dataset.owner;
        const repoName = card.dataset.repoName;
        if (e.target.closest('.btn-copy')) { copyToClipboard(card.dataset.cloneUrl); return; }
        if (e.target.closest('.view-commits-btn')) { fetchAndShowCommits(owner, repoName); return; }
        fetchAndShowReadme(owner, repoName);
    });

    // --- Core Functions ---
    async function handleFetchRepos(forceRefresh = false) {
        currentUsername = usernameInput.value.trim();
        const token = tokenInput.value.trim();
        
        if (!currentUsername) { showError('Please enter a username.'); return; }

        showSkeletonLoader(true);
        showError('');
        repoList.innerHTML = '';
        profileSection.style.display = 'none';
        profileReadmeContainer.style.display = 'none';
        profileCommits.innerHTML = '';
        commitFilterContainer.style.display = 'none';
        currentFilteredRepos = [];

        try {
            let url = '/api/fetch-user';
            if (forceRefresh) url += '?refresh=true';

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: currentUsername, token: token })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to fetch data.');

            const { profile, repos, profileReadme } = data;
            allRepos = repos.map(repo => ({ ...repo, commit_count: undefined }));
            
            renderProfile(profile);
            renderProfileReadme(profileReadme);
            populateFilters(allRepos);
            renderRepos();
            fetchAndRenderCommitCounts(token); 

        } catch (error) {
            console.error(error);
            showError(error.message || 'Failed to fetch data.');
            allRepos = [];
            renderRepos();
        } finally {
            showSkeletonLoader(false);
        }
    }
    
    async function fetchAndRenderCommitCounts(token) {
        const countPromises = allRepos.map(repo => 
            fetchCommitCount(repo.owner.login, repo.name, token)
        );
        
        const results = await Promise.allSettled(countPromises);
        let needRender = false;
        let totalCommits = 0;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value !== null) {
                allRepos[index].commit_count = result.value;
                needRender = true;
            } else {
                allRepos[index].commit_count = 0;
            }
            totalCommits += (allRepos[index].commit_count || 0);
        });

        if (needRender) {
            commitFilterContainer.style.display = 'flex';
            profileCommits.innerHTML = `<span class="material-symbols-outlined">commit</span> ${totalCommits.toLocaleString()} commits (public)`;
            renderRepos();
        }
    }

    async function fetchCommitCount(owner, repoName, token) {
        try {
            const response = await fetch('/api/commit-count', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo: repoName, token })
            });
            const data = await response.json();
            return data.count !== undefined ? data.count : 0;
        } catch (error) { return 0; }
    }

    function decodeReadmeContent(base64Content) {
        try {
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
            return new TextDecoder().decode(bytes);
        } catch (e) { return "Error decoding content."; }
    }

    function renderProfile(profile) {
        if (!profile) return;
        profileAvatar.src = profile.avatar_url;
        profileName.textContent = profile.name || profile.login;
        profileLogin.textContent = `@${profile.login}`;
        profileBio.textContent = profile.bio || 'No bio provided.';
        profileFollowers.innerHTML = `<span class="material-symbols-outlined">group</span> ${profile.followers} followers`;
        profileFollowing.innerHTML = `<span class="material-symbols-outlined">person_add</span> ${profile.following} following`;
        profileRepos.innerHTML = `<span class="material-symbols-outlined">book</span> ${profile.public_repos} public repos`;
        profileLink.href = profile.html_url;
        profileSection.style.display = 'flex';
    }

    function renderProfileReadme(readmeData) {
        if (!readmeData || !readmeData.content) {
            profileReadmeContainer.style.display = 'none';
            return;
        }
        try {
            profileReadmeContent.innerHTML = marked.parse(decodeReadmeContent(readmeData.content));
            profileReadmeContainer.style.display = 'block';
        } catch (error) { profileReadmeContainer.style.display = 'none'; }
    }

    function renderRepos() {
        const filterText = filterInput.value.toLowerCase();
        const selectedLang = languageSelect.value;
        const selectedTopic = topicSelect.value;
        
        // FIX: Ensure strict number comparison, treating empty input as 0 or Infinity
        let minVal = commitFilterMin.value === '' ? 0 : parseInt(commitFilterMin.value, 10);
        let maxVal = commitFilterMax.value === '' ? Infinity : parseInt(commitFilterMax.value, 10);

        let filteredRepos = allRepos.filter(repo => {
            const nameMatch = repo.name.toLowerCase().includes(filterText);
            const langMatch = selectedLang === 'all' || repo.language === selectedLang;
            const topicMatch = selectedTopic === 'all' || (repo.topics && repo.topics.includes(selectedTopic));
            
            const commitCount = repo.commit_count;
            // Show if loading (undefined) OR if it matches range
            const commitMatch = commitCount === undefined || (commitCount >= minVal && commitCount <= maxVal);
            
            return nameMatch && langMatch && topicMatch && commitMatch;
        });

        const sortBy = sortSelect.value;
        filteredRepos.sort((a, b) => {
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

        currentFilteredRepos = filteredRepos;
        repoList.innerHTML = '';
        
        if (filteredRepos.length === 0 && allRepos.length > 0) {
             repoList.innerHTML = '<p class="error-message">No repositories match your criteria.</p>';
             return;
        }

        const fragment = document.createDocumentFragment();
        filteredRepos.forEach(repo => {
            const card = document.createElement('div');
            card.className = 'repo-card';
            card.dataset.owner = repo.owner.login;
            card.dataset.repoName = repo.name;
            card.dataset.cloneUrl = repo.clone_url;
            
            const topicsHTML = (repo.topics || []).map(topic => `<span class="topic-tag">${topic}</span>`).join('');
            const commitCountHTML = repo.commit_count === undefined ? `<div class="loader-small"></div>` : repo.commit_count.toLocaleString();
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

    function populateFilters(repos) {
        const langSet = new Set();
        const topicSet = new Set();
        repos.forEach(repo => {
            if (repo.language) langSet.add(repo.language);
            if (repo.topics) repo.topics.forEach(topic => topicSet.add(topic));
        });
        
        const allLangs = [...langSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        languageSelect.innerHTML = '<option value="all">All Languages</option>';
        allLangs.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            languageSelect.appendChild(option);
        });

        const allTopics = [...topicSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        topicSelect.innerHTML = '<option value="all">All Topics</option>';
        allTopics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic;
            topicSelect.appendChild(option);
        });
    }

    async function fetchAndShowReadme(owner, repoName) {
        showReadmeModal();
        const token = tokenInput.value.trim();
        try {
            const response = await fetch('/api/repo-readme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo: repoName, token })
            });
            const data = await response.json();
            if (data.error) throw new Error('README not found.');
            readmeContent.innerHTML = marked.parse(decodeReadmeContent(data.content));
        } catch (error) {
            readmeContent.innerHTML = `<p class="error-message">${error.message}</p>`;
        } finally { modalLoader.style.display = 'none'; }
    }

    async function fetchAndShowCommits(owner, repoName) {
        showCommitsModal(repoName);
        const token = tokenInput.value.trim();
        try {
            const response = await fetch('/api/repo-commits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner, repo: repoName, token })
            });
            
            const commits = await response.json();
            if (commits.error) throw new Error('Commits could not be fetched.');
            if (commits.length === 0) { commitsListContent.innerHTML = `<p class="error-message">No commits found.</p>`; return; }

            commitsListContent.innerHTML = commits.map(commitData => {
                const commit = commitData.commit;
                const author = commitData.author; // GitHub Author Object (can be null!)
                
                // FIX: Use generic avatar if author is null
                const avatarUrl = author ? author.avatar_url : "{{ url_for('static', filename='assets/octocat.svg') }}";
                
                return `
                    <div class="commit-item">
                        <img src="${avatarUrl}" alt="avatar" class="commit-avatar">
                        <div class="commit-details">
                            <p class="commit-message">${commit.message.split('\n')[0]}</p>
                            <p class="commit-author"><span>${commit.author.name}</span> committed on ${new Date(commit.author.date).toLocaleDateString()}</p>
                        </div>
                        <a href="${commitData.html_url}" target="_blank" class="commit-sha">${commitData.sha.substring(0, 7)}</a>
                    </div>
                `;
            }).join('');

        } catch (error) {
            commitsListContent.innerHTML = `<p class="error-message">${error.message}</p>`;
        } finally { commitsModalLoader.style.display = 'none'; }
    }

    // --- Utility Functions ---
    function showDownloadModal() {
        downloadModalTitle.textContent = `Download Repos (${currentFilteredRepos.length})`;
        if (currentFilteredRepos.length === 0) {
            downloadListContent.innerHTML = '<p class="error-message" style="text-align:left;padding:0;">No repos to download.</p>';
            downloadSelectAll.disabled = true; downloadSelectedBtn.disabled = true;
        } else {
            downloadListContent.innerHTML = currentFilteredRepos.map(repo => `
                <div class="download-item">
                    <label class="download-item-info">
                        <input type="checkbox" class="download-checkbox" data-zip-url="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip">
                        <span>${repo.name}</span>
                    </label>
                    <a href="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip" class="btn btn-icon btn-download-single" onclick="event.stopPropagation()"><span class="material-symbols-outlined">download</span></a>
                </div>
            `).join('');
            downloadSelectAll.disabled = false; downloadSelectedBtn.disabled = false;
        }
        downloadSelectAll.checked = false;
        downloadModal.style.display = 'flex'; document.body.style.overflow = 'hidden';
    }
    function hideDownloadModal() { downloadModal.style.display = 'none'; document.body.style.overflow = ''; }
    function handleSelectAll() { const checkboxes = downloadListContent.querySelectorAll('.download-checkbox'); checkboxes.forEach(cb => { cb.checked = downloadSelectAll.checked; }); }
    
    function handleDownloadSelected() {
        const selectedCheckboxes = downloadListContent.querySelectorAll('.download-checkbox:checked');
        if (selectedCheckboxes.length === 0) { showToast('No repos selected.'); return; }
        
        showToast(`Downloading ${selectedCheckboxes.length} files... Check popup blocker if they don't appear.`);
        
        // FIX: Add delay between downloads to prevent browser blocking
        selectedCheckboxes.forEach((cb, index) => {
            setTimeout(() => {
                const a = document.createElement('a'); a.href = cb.dataset.zipUrl; a.download = '';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }, index * 1000); // 1 second delay between each
        });
        
        selectedCheckboxes.forEach(cb => { cb.checked = false; });
        downloadSelectAll.checked = false;
    }

    function showReadmeModal() { readmeContent.innerHTML = ''; modalLoader.style.display = 'flex'; readmeModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    function hideReadmeModal() { readmeModal.style.display = 'none'; document.body.style.overflow = ''; }
    function showCommitsModal(repoName) { commitsListContent.innerHTML = ''; commitsModalTitle.textContent = `Commit History: ${repoName}`; commitsModalLoader.style.display = 'flex'; commitsModal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    function hideCommitsModal() { commitsModal.style.display = 'none'; document.body.style.overflow = ''; }
    function showSkeletonLoader(show) { skeletonLoader.style.display = show ? 'grid' : 'none'; repoList.style.display = show ? 'none' : 'grid'; }
    function showError(message) { errorMessage.textContent = message; }
    function copyToClipboard(text) { navigator.clipboard.writeText(text).then(() => { showToast('Clone URL copied!'); }).catch(() => { showToast('Failed to copy.'); }); }
    function showToast(message) { if (toastTimer) clearTimeout(toastTimer); toastNotification.textContent = message; toastNotification.classList.add('show'); toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000); }
    function applyTheme(themeName) { document.body.className = `theme-${themeName}`; themeSelect.value = themeName; localStorage.setItem('gh_theme', themeName); }
    function toggleSortDirection() { currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc'; sortDirectionBtn.classList.toggle('asc', currentSortDirection === 'asc'); sortDirectionBtn.classList.toggle('desc', currentSortDirection === 'desc'); sortDirectionBtn.querySelector('.material-symbols-outlined').textContent = currentSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'; renderRepos(); }
    sortDirectionBtn.classList.add(currentSortDirection); sortDirectionBtn.querySelector('.material-symbols-outlined').textContent = 'arrow_downward';
    function getLangColor(lang) {
        const colors = { 'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'HTML': '#e34c26', 'CSS': '#563d7c', 'Python': '#3572A5', 'Java': '#b07219', 'C#': '#178600', 'C++': '#f34b7d', 'Go': '#00ADD8', 'Ruby': '#701516', 'PHP': '#4F5D95', 'Shell': '#89e051' };
        return colors[lang] || '#cccccc';
    }
});