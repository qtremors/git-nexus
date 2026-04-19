document.addEventListener('DOMContentLoaded', () => {
    // --- Constants & State ---
    const GITHUB_API_URL = 'https://api.github.com';
    const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
    let allRepos = [];
    let currentFilteredRepos = [];
    let currentUsername = '';
    let currentSortDirection = 'desc'; // 'desc' or 'asc'
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

    // Profile README Elements
    const profileReadmeContainer = document.getElementById('profile-readme-container');
    const profileReadmeContent = document.getElementById('profile-readme-content');

    // README Modal Elements
    const readmeModal = document.getElementById('readme-modal');
    const modalLoader = document.getElementById('modal-loader');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const readmeContent = document.getElementById('readme-content');

    // Commits Modal Elements
    const commitsModal = document.getElementById('commits-modal');
    const commitsModalLoader = document.getElementById('commits-modal-loader');
    const commitsModalCloseBtn = document.getElementById('commits-modal-close-btn');
    const commitsModalTitle = document.getElementById('commits-modal-title');
    const commitsListContent = document.getElementById('commits-list-content');

    // Download Modal Elements <-- ADDED
    const downloadReposBtn = document.getElementById('download-repos-btn');
    const downloadModal = document.getElementById('download-modal');
    const downloadModalCloseBtn = document.getElementById('download-modal-close-btn');
    const downloadModalTitle = document.getElementById('download-modal-title');
    const downloadListContent = document.getElementById('download-list-content');
    const downloadSelectAll = document.getElementById('download-select-all');
    const downloadSelectedBtn = document.getElementById('download-selected-btn');

    // New Controls
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
    
    // New Listeners
    themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    sortDirectionBtn.addEventListener('click', toggleSortDirection);

    // README Modal Listeners
    modalCloseBtn.addEventListener('click', hideReadmeModal);
    readmeModal.addEventListener('click', (e) => {
        if (e.target === readmeModal) hideReadmeModal();
    });
    
    // Commits Modal Listeners
    commitsModalCloseBtn.addEventListener('click', hideCommitsModal);
    commitsModal.addEventListener('click', (e) => {
        if (e.target === commitsModal) hideCommitsModal();
    });
    
    // Download Modal Listeners
    downloadReposBtn.addEventListener('click', showDownloadModal);
    downloadModalCloseBtn.addEventListener('click', hideDownloadModal);
    downloadModal.addEventListener('click', (e) => {
        if (e.target === downloadModal) hideDownloadModal();
    });
    downloadSelectAll.addEventListener('change', handleSelectAll);
    downloadSelectedBtn.addEventListener('click', handleDownloadSelected);
    downloadListContent.addEventListener('change', (e) => {
        // Handle unchecking "Select All" if an individual box is unchecked
        if (e.target.classList.contains('download-checkbox')) {
            if (!e.target.checked) {
                downloadSelectAll.checked = false;
            } else {
                // Check if all are now checked
                const allCheckboxes = downloadListContent.querySelectorAll('.download-checkbox');
                const allChecked = [...allCheckboxes].every(cb => cb.checked);
                downloadSelectAll.checked = allChecked;
            }
        }
    });

    // Repo List Click Handler (Delegation)
    repoList.addEventListener('click', (e) => {
        const card = e.target.closest('.repo-card');
        if (!card) return;

        const owner = card.dataset.owner;
        const repoName = card.dataset.repoName;

        // Check if "Copy Clone URL" button was clicked
        if (e.target.closest('.btn-copy')) {
            const cloneUrl = card.dataset.cloneUrl;
            copyToClipboard(cloneUrl);
            return;
        }

        // Check if "View Commits" button was clicked
        if (e.target.closest('.view-commits-btn')) {
            fetchAndShowCommits(owner, repoName);
            return;
        }
        
        // Any other click on the card opens the README
        fetchAndShowReadme(owner, repoName);
    });

    // --- Core Functions ---

    /**
     * Main function to fetch repositories and profile.
     */
    async function handleFetchRepos(forceRefresh = false) {
        currentUsername = usernameInput.value.trim();
        if (!currentUsername) {
            showError('Please enter a username.');
            return;
        }

        showSkeletonLoader(true);
        showError('');
        repoList.innerHTML = '';
        profileSection.style.display = 'none';
        profileReadmeContainer.style.display = 'none';
        profileCommits.innerHTML = '';
        commitFilterContainer.style.display = 'none';
        
        currentFilteredRepos = [];

        if (!forceRefresh) {
            const cachedRepos = getCache(currentUsername, 'repos');
            const cachedProfile = getCache(currentUsername, 'profile');
            const cachedProfileReadme = getCache(currentUsername, 'profileReadme');
            
            if (cachedRepos && cachedProfile) {
                console.log('Loading from cache...');
                allRepos = cachedRepos;
                renderProfile(cachedProfile);
                renderProfileReadme(cachedProfileReadme);
                populateFilters(allRepos);
                renderRepos();
                showSkeletonLoader(false);

                if (allRepos.length > 0 && allRepos[0].commit_count === undefined) {
                    fetchAndRenderCommitCounts(); 
                } else {
                    const totalCommits = allRepos.reduce((acc, repo) => acc + (repo.commit_count || 0), 0);
                    profileCommits.innerHTML = `<span class="material-symbols-outlined">commit</span> ${totalCommits.toLocaleString()} commits (public)`;
                    commitFilterContainer.style.display = 'flex';
                }
                return;
            }
        }

        try {
            console.log('Fetching from API...');
            
            const repoUrl = `${GITHUB_API_URL}/users/${currentUsername}/repos?per_page=100&sort=pushed`;

            const [profile, repos, profileReadme] = await Promise.all([
                fetchUserData(`${GITHUB_API_URL}/users/${currentUsername}`),
                fetchAllPages(repoUrl),
                fetchProfileReadme(currentUsername)
            ]);

            allRepos = repos.map(repo => ({ ...repo, commit_count: undefined }));
            renderProfile(profile);
            renderProfileReadme(profileReadme);
            
            setCache(currentUsername, 'repos', allRepos);
            setCache(currentUsername, 'profile', profile);
            setCache(currentUsername, 'profileReadme', profileReadme);

            populateFilters(allRepos);
            renderRepos();
            fetchAndRenderCommitCounts();

        } catch (error) {
            console.error('Error fetching data:', error);
            showError(error.message || 'Failed to fetch data.');
            allRepos = [];
            renderRepos();
            profileSection.style.display = 'none'; 
            profileReadmeContainer.style.display = 'none'; 
            profileCommits.innerHTML = '';
        } finally {
            showSkeletonLoader(false);
        }
    }
    
    /**
     * Fetches commit counts for all repos in `allRepos` and re-renders.
     */
    async function fetchAndRenderCommitCounts() {
        console.log('Fetching commit counts...');
        const countPromises = allRepos.map(repo => 
            fetchCommitCount(repo.owner.login, repo.name)
        );
        
        // Using allSettled ensures that if one commit count fails (e.g., 403 rate limit),
        // the others will still be processed.
        const results = await Promise.allSettled(countPromises);
        
        let needRender = false;
        let totalCommits = 0;
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value !== null) {
                allRepos[index].commit_count = result.value;
                needRender = true;
            } else {
                // If fetching fails, default to 0 and log the error
                allRepos[index].commit_count = 0;
                if (result.status === 'rejected') {
                     console.warn(`Could not fetch commit count for ${allRepos[index].name}:`, result.reason);
                }
            }
            totalCommits += allRepos[index].commit_count;
        });

        if (needRender) {
            console.log('Commit counts fetched, re-rendering...');
            setCache(currentUsername, 'repos', allRepos);
            commitFilterContainer.style.display = 'flex';
            
            profileCommits.innerHTML = `<span class="material-symbols-outlined">commit</span> ${totalCommits.toLocaleString()} commits (public)`;
            
            renderRepos();
        }
    }

    /**
     * Fetches the total commit count for a single repo.
     */
    async function fetchCommitCount(owner, repoName) {
        const url = `${GITHUB_API_URL}/repos/${owner}/${repoName}/commits?per_page=1`;
        try {
            const response = await fetch(url, { headers: getAuthHeaders() });
            if (!response.ok) {
                 if (response.status === 409) return 0; // 409 Conflict = Empty repo
                 // Throw an error to be caught by allSettled
                 throw new Error(`API Error: ${response.status} for ${repoName}`);
            }

            const linkHeader = response.headers.get('Link');
            if (linkHeader) {
                const lastLink = linkHeader.split(',').find(s => s.includes('rel="last"'));
                if (lastLink) {
                    const match = lastLink.match(/<.*?[?&]page=(\d+).*?>/);
                    if (match && match[1]) {
                        return parseInt(match[1], 10);
                    }
                }
            }
            
            const data = await response.json();
            return data.length;
        } catch (error) {
            // Propagate error to be handled by Promise.allSettled
            throw error;
        }
    }


    /**
     * Fetches user profile data (single page).
     */
    async function fetchUserData(url) {
        const headers = getAuthHeaders();
        const response = await fetch(url, { headers });

        if (!response.ok) {
            if (response.status === 404) throw new Error('User not found.');
            if (response.status === 403) throw new Error('API rate limit exceeded. Add a GitHub Token.');
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return await response.json();
    }
    
    /**
     * Fetches the user's profile README (e.g., /repos/user/user/readme).
     */
    async function fetchProfileReadme(username) {
        try {
            const response = await fetch(`${GITHUB_API_URL}/repos/${username}/${username}/readme`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('No profile README found.');
                    return null; 
                }
                throw new Error('Could not fetch profile README.');
            }
            return await response.json();
        } catch (error) {
            console.warn(error.message); 
            return null;
        }
    }

    /**
     * Fetches all pages from a paginated GitHub API endpoint.
     */
    async function fetchAllPages(url) {
        let results = [];
        let nextUrl = url;
        const headers = getAuthHeaders();

        while (nextUrl) {
            const response = await fetch(nextUrl, { headers });

            if (!response.ok) {
                if (response.status === 404) throw new Error('User data not found.');
                if (response.status === 403) {
                     const data = await response.json();
                     throw new Error(data.message || 'API rate limit exceeded. Add a GitHub Token.');
                }
                throw new Error(`GitHub API error: ${response.statusText}`);
            }
            
            const data = await response.json();
            results = results.concat(data);

            const linkHeader = response.headers.get('Link');
            nextUrl = null;
            if (linkHeader) {
                const nextLink = linkHeader.split(',').find(s => s.includes('rel="next"'));
                if (nextLink) {
                    nextUrl = nextLink.match(/<(.*?)>/)[1];
                }
            }
        }
        return results;
    }

    /**
     * Decodes Base64 (with emoji/UTF-8 support)
     */
    function decodeReadmeContent(base64Content) {
        try {
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder().decode(bytes);
        } catch (e) {
            console.error("Base64 decoding error:", e);
            return "Error decoding content.";
        }
    }

    /**
     * Renders the user profile data into the DOM.
     */
    function renderProfile(profile) {
        profileAvatar.src = profile.avatar_url;
        profileAvatar.alt = `${profile.login} avatar`;
        profileName.textContent = profile.name || profile.login;
        profileLogin.textContent = `@${profile.login}`;
        profileBio.textContent = profile.bio || 'No bio provided.';
        profileFollowers.innerHTML = `<span class="material-symbols-outlined">group</span> ${profile.followers} followers`;
        profileFollowing.innerHTML = `<span class="material-symbols-outlined">person_add</span> ${profile.following} following`;
        profileRepos.innerHTML = `<span class="material-symbols-outlined">book</span> ${profile.public_repos} public repos`;
        profileLink.href = profile.html_url;
        profileSection.style.display = 'flex';
    }

    /**
     * Renders the user profile README data into the DOM.
     */
    function renderProfileReadme(readmeData) {
        if (!readmeData || !readmeData.content) {
            profileReadmeContainer.style.display = 'none';
            return;
        }
        
        try {
            const markdownContent = decodeReadmeContent(readmeData.content);
            profileReadmeContent.innerHTML = marked.parse(markdownContent);
            profileReadmeContainer.style.display = 'block';
        } catch (error) {
            console.error('Error parsing profile README:', error);
            profileReadmeContent.innerHTML = '<p class="error-message">Error parsing profile README.</p>';
            profileReadmeContainer.style.display = 'block';
        }
    }

    /**
     * Filters, sorts, and renders the `allRepos` data into the DOM.
     */
    function renderRepos() {
        // 1. Filter
        const filterText = filterInput.value.toLowerCase();
        const selectedLang = languageSelect.value;
        const selectedTopic = topicSelect.value;
        const minCommits = parseInt(commitFilterMin.value, 10) || 0;
        const maxCommits = parseInt(commitFilterMax.value, 10) || Infinity;

        let filteredRepos = allRepos.filter(repo => {
            const nameMatch = repo.name.toLowerCase().includes(filterText);
            const langMatch = selectedLang === 'all' || repo.language === selectedLang;
            const topicMatch = selectedTopic === 'all' || (repo.topics && repo.topics.includes(selectedTopic));
            
            const commitCount = repo.commit_count;
            // Show repos even if commit count is still loading (undefined)
            const commitMatch = commitCount === undefined || (commitCount >= minCommits && commitCount <= maxCommits);

            return nameMatch && langMatch && topicMatch && commitMatch;
        });

        // 2. Sort
        const sortBy = sortSelect.value;
        filteredRepos.sort((a, b) => {
            let valA, valB;
            switch (sortBy) {
                case 'stars':
                    valA = a.stargazers_count;
                    valB = b.stargazers_count;
                    break;
                case 'name':
                    valA = a.name.toLowerCase();
                    valB = b.name.toLowerCase();
                    return currentSortDirection === 'asc' 
                        ? valA.localeCompare(valB) 
                        : valB.localeCompare(valA);
                case 'updated':
                    valA = new Date(a.updated_at);
                    valB = new Date(b.updated_at);
                    break;
                case 'created':
                    valA = new Date(a.created_at);
                    valB = new Date(b.created_at);
                    break;
                case 'commits':
                    valA = a.commit_count ?? 0;
                    valB = b.commit_count ?? 0;
                    break;
                default:
                    return 0;
            }
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        });

        currentFilteredRepos = filteredRepos;

        // 3. Render
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
            
            const topicsHTML = repo.topics.map(topic => `<span class="topic-tag">${topic}</span>`).join('');
            
            const commitCountHTML = repo.commit_count === undefined
                ? `<div class="loader-small"></div>`
                : repo.commit_count.toLocaleString();
            
            const homepageLink = repo.homepage
                ? `<a href="${repo.homepage}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="btn-icon" aria-label="Visit Homepage" title="Visit Homepage">
                     <span class="material-symbols-outlined">language</span>
                   </a>`
                : '';
            
            const downloadLink = `<a href="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip" onclick="event.stopPropagation()" class="btn-icon" aria-label="Download ZIP" title="Download ZIP">
                                    <span class="material-symbols-outlined">download</span>
                                </a>`;

            card.innerHTML = `
                <div class="repo-card-header">
                    <h3>
                        <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" title="View on GitHub">
                            ${repo.name}
                        </a>
                    </h3>
                    <div class="repo-card-links">
                        ${homepageLink}
                        ${downloadLink}
                    </div>
                </div>
                <p class="description">${repo.description || 'No description provided.'}</p>
                ${repo.topics.length > 0 ? `<div class="repo-topics">${topicsHTML}</div>` : ''}
                <div class="repo-stats">
                    ${repo.language ? `
                    <span class="stat-item" title="${repo.language}">
                        <span class="language-dot" style="background-color: ${getLangColor(repo.language)};"></span>
                        ${repo.language}
                    </span>` : ''}
                    <span class="stat-item" title="Stars">
                        <span class="material-symbols-outlined">star</span>
                        ${repo.stargazers_count}
                    </span>
                    <span class="stat-item" title="Forks">
                        <span class="material-symbols-outlined">share</span>
                        ${repo.forks_count}
                    </span>
                    <span class="stat-item commit-count" title="Commits">
                        <span class="material-symbols-outlined">commit</span>
                        ${commitCountHTML}
                    </span>
                    <span class="stat-item" title="Created">
                        <span class="material-symbols-outlined">calendar_today</span>
                        ${new Date(repo.created_at).toLocaleDateString()}
                    </span>
                    <span class="stat-item" title="Last Updated">
                        <span class="material-symbols-outlined">update</span>
                        ${new Date(repo.updated_at).toLocaleDateString()}
                    </span>
                </div>
                <div class="repo-card-actions">
                    <button class="btn btn-outlined view-commits-btn" title="View commit history">
                            <span class="material-symbols-outlined">history</span>
                            <span>View Commits</span>
                    </button>
                    <button class="btn btn-outlined btn-copy" aria-label="Copy Clone URL" title="Copy Clone URL">
                        <span class="material-symbols-outlined">content_copy</span>
                    </button>
                </div>
            `;
            
            fragment.appendChild(card);
        });
        
        repoList.appendChild(fragment);
    }

    /**
     * Populates the language and topic filter dropdowns.
     */
    function populateFilters(repos) {
        const langSet = new Set();
        const topicSet = new Set();
        
        repos.forEach(repo => {
            if (repo.language) {
                langSet.add(repo.language);
            }
            if (repo.topics) {
                repo.topics.forEach(topic => topicSet.add(topic));
            }
        });
        
        // Sort and populate languages
        const allLangs = [...langSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        languageSelect.innerHTML = '<option value="all">All Languages</option>';
        allLangs.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            languageSelect.appendChild(option);
        });

        // Sort and populate topics
        const allTopics = [...topicSet].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        topicSelect.innerHTML = '<option value="all">All Topics</option>';
        allTopics.forEach(topic => {
            const option = document.createElement('option');
            option.value = topic;
            option.textContent = topic;
            topicSelect.appendChild(option);
        });
    }

    /**
     * Fetches and displays the README file for a given repository in a modal.
     */
    async function fetchAndShowReadme(owner, repoName) {
        showReadmeModal();
        try {
            const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repoName}/readme`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                if (response.status === 404) throw new Error('README.md not found in this repository.');
                throw new Error('Could not fetch README.');
            }
            const data = await response.json();
            
            const markdownContent = decodeReadmeContent(data.content);

            readmeContent.innerHTML = marked.parse(markdownContent);
        } catch (error) {
            readmeContent.innerHTML = `<p class="error-message">${error.message}</p>`;
        } finally {
            modalLoader.style.display = 'none';
        }
    }

    /**
     * Fetches and displays the commit history for a given repository in a modal.
     */
    async function fetchAndShowCommits(owner, repoName) {
        showCommitsModal(repoName);
        try {
            const commits = await fetchAllPages(`${GITHUB_API_URL}/repos/${owner}/${repoName}/commits?per_page=30`);
            
            if (commits.length === 0) {
                commitsListContent.innerHTML = `<p class="error-message">No commits found for this repository.</p>`;
                return;
            }

            commitsListContent.innerHTML = commits.map(commitData => {
                const author = commitData.author;
                const commit = commitData.commit;
                return `
                    <div class="commit-item">
                        <img src="${author ? author.avatar_url : 'octocat.svg'}" alt="${author ? author.login : 'unknown'}" class="commit-avatar">
                        <div class="commit-details">
                            <p class="commit-message">${commit.message.split('\n')[0]}</p>
                            <p class="commit-author">
                                <span>${commit.author.name}</span>
                                committed on ${new Date(commit.author.date).toLocaleDateString()}
                            </p>
                        </div>
                        <a href="${commitData.html_url}" target="_blank" rel="noopener noreferrer" class="commit-sha">
                            ${commitData.sha.substring(0, 7)}
                        </a>
                    </div>
                `;
            }).join('');

        } catch (error) {
            commitsListContent.innerHTML = `<p class="error-message">${error.message}</p>`;
        } finally {
            commitsModalLoader.style.display = 'none';
        }
    }

    // --- Download modal functions ---

    function showDownloadModal() {
        downloadModalTitle.textContent = `Download Repos (${currentFilteredRepos.length} filtered)`;
        
        if (currentFilteredRepos.length === 0) {
            downloadListContent.innerHTML = '<p class="error-message" style="text-align: left; padding: 0;">No repos to download. (Matches current filters)</p>';
            downloadSelectAll.disabled = true;
            downloadSelectedBtn.disabled = true;
        } else {
            downloadListContent.innerHTML = currentFilteredRepos.map(repo => `
                <div class="download-item">
                    <label class="download-item-info">
                        <input type="checkbox" class="download-checkbox" data-zip-url="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip">
                        <span>${repo.name}</span>
                    </label>
                    <a href="${repo.html_url}/archive/refs/heads/${repo.default_branch}.zip" class="btn btn-icon btn-download-single" title="Download ${repo.name}.zip" onclick="event.stopPropagation()">
                        <span class="material-symbols-outlined">download</span>
                    </a>
                </div>
            `).join('');
            downloadSelectAll.disabled = false;
            downloadSelectedBtn.disabled = false;
        }
        
        downloadSelectAll.checked = false;
        downloadModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function hideDownloadModal() {
        downloadModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function handleSelectAll() {
        const checkboxes = downloadListContent.querySelectorAll('.download-checkbox');
        checkboxes.forEach(cb => { cb.checked = downloadSelectAll.checked; });
    }

    function handleDownloadSelected() {
        const selectedCheckboxes = downloadListContent.querySelectorAll('.download-checkbox:checked');
        
        if (selectedCheckboxes.length === 0) {
            showToast('No repos selected.');
            return;
        }

        if (selectedCheckboxes.length > 1) {
            showToast(`Downloading ${selectedCheckboxes.length} files... Please allow multiple downloads.`);
        } else {
             showToast(`Starting 1 download...`);
        }

        selectedCheckboxes.forEach((cb) => {
            const url = cb.dataset.zipUrl;
            
            // Trigger all clicks synchronously.
            // The browser will batch these and ask for permission.
            const a = document.createElement('a');
            a.href = url;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
        
        // Uncheck all after download
        selectedCheckboxes.forEach(cb => { cb.checked = false; });
        downloadSelectAll.checked = false;
    }

    // --- Modal & Utility Functions ---

    function showReadmeModal() {
        readmeContent.innerHTML = '';
        modalLoader.style.display = 'flex';
        readmeModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; 
    }
    
    function hideReadmeModal() {
        readmeModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function showCommitsModal(repoName) {
        commitsListContent.innerHTML = '';
        commitsModalTitle.textContent = `Commit History: ${repoName}`;
        commitsModalLoader.style.display = 'flex';
        commitsModal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; 
    }
    
    function hideCommitsModal() {
        commitsModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function getAuthHeaders() {
        const token = tokenInput.value.trim();
        const headers = { 
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    function setCache(username, type, data) {
        try {
            localStorage.setItem(`gh_${type}_${username}`, JSON.stringify({ timestamp: Date.now(), data }));
        } catch (e) {
            console.warn("Failed to set cache:", e);
        }
    }

    function getCache(username, type) {
        const cached = localStorage.getItem(`gh_${type}_${username}`);
        if (cached === null) return null; 
        try {
            const parsed = JSON.parse(cached);
            if (parsed === null) return null;
            const { timestamp, data } = parsed;
            if (Date.now() - timestamp > CACHE_DURATION_MS) {
                localStorage.removeItem(`gh_${type}_${username}`);
                return null;
            }
            return data;
        } catch (e) {
            console.warn("Failed to parse cache:", e);
            return null;
        }
    }

    function showSkeletonLoader(show) {
        skeletonLoader.style.display = show ? 'grid' : 'none';
        if (show) {
            repoList.style.display = 'none';
        } else {
            repoList.style.display = 'grid';
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
    }
    

    /**
     * Copies text to the clipboard and shows a toast.
     */
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Clone URL copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy URL.');
        });
    }

    /**
     * Shows a toast notification.
     */
    function showToast(message) {
        // Clear existing timer if any
        if (toastTimer) {
            clearTimeout(toastTimer);
        }
        
        toastNotification.textContent = message;
        toastNotification.classList.add('show');
        
        // Set new timer to hide
        toastTimer = setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 3000);
    }
    
    function applyTheme(themeName) {
        document.body.className = `theme-${themeName}`;
        themeSelect.value = themeName;
        localStorage.setItem('gh_theme', themeName);
    }
    
    function toggleSortDirection() {
        currentSortDirection = currentSortDirection === 'desc' ? 'asc' : 'desc';
        sortDirectionBtn.classList.toggle('asc', currentSortDirection === 'asc');
        sortDirectionBtn.classList.toggle('desc', currentSortDirection === 'desc');
        sortDirectionBtn.querySelector('.material-symbols-outlined').textContent = 
            currentSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
        
        renderRepos();
    }
    
    // Init sort direction button
    sortDirectionBtn.classList.add(currentSortDirection);
    sortDirectionBtn.querySelector('.material-symbols-outlined').textContent = 'arrow_downward';


    function getLangColor(lang) {
        const colors = {
            'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'HTML': '#e34c26',
            'CSS': '#563d7c', 'Python': '#3572A5', 'Java': '#b07219',
            'C#': '#178600', 'C++': '#f34b7d', 'Go': '#00ADD8',
            'Ruby': '#701516', 'PHP': '#4F5D95', 'Shell': '#89e051',
            'Svelte': '#ff3e00', 'Vue': '#4FC08D', 'Rust': '#dea584',
            'Kotlin': '#A97BFF', 'Dart': '#00B4AB', 'Swift': '#F05138',
            'Jupyter Notebook': '#DA5B0B'
        };
        return colors[lang] || '#cccccc';
    }
});