// Star Vault
(function() {
    'use strict';

    // State
    const state = {
        allRepos: [],
        filteredRepos: [],
        visibleRepos: [],
        visibleCount: 50,
        filters: {
            search: '',
            language: null,
            topic: null,
            archived: false,
            template: false
        },
        sort: 'starred_at'
    };

    let fuse = null;
    let observer = null;

    // DOM Elements
    const els = {
        searchInput: document.getElementById('searchInput'),
        filterArchived: document.getElementById('filter-archived'),
        filterTemplate: document.getElementById('filter-template'),
        facetLanguage: document.getElementById('facet-language'),
        facetTopic: document.getElementById('facet-topic'),
        clearLangBtn: document.getElementById('clear-lang'),
        clearTopicBtn: document.getElementById('clear-topic'),
        resetAllBtn: document.getElementById('reset-all'),
        repoCount: document.getElementById('repo-count'),
        activeFilters: document.getElementById('active-filters'),
        sortSelect: document.getElementById('sortSelect'),
        repoGrid: document.getElementById('repo-grid'),
        loadingTrigger: document.getElementById('loading-trigger')
    };

    // Initialize
    async function init() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('Failed to load data');
            const data = await response.json();
            
            // Normalize data
            state.allRepos = (data.repositories || []).map(repo => ({
                ...repo,
                // Flatten critical metadata for easier access
                stars: repo.github_metadata?.stargazers_count || 0,
                forks: repo.github_metadata?.forks_count || 0,
                language: repo.github_metadata?.language || 'Unknown',
                topics: repo.github_metadata?.topics || [],
                pushed_at: repo.github_metadata?.repo_pushed_at || null,
                avatar: repo.github_metadata?.owner_avatar || null,
                disk_usage: repo.github_metadata?.disk_usage || 0
            }));

            initFuse();
            setupEventListeners();
            setupObserver();
            
            // Initial Render
            applyFilters();
            
        } catch (error) {
            console.error('Initialization failed:', error);
            els.repoGrid.innerHTML = '<div class="no-results">Failed to load Star Vault.</div>';
        }
    }

    function initFuse() {
        const options = {
            keys: [
                { name: 'repo', weight: 1.0 },
                { name: 'summary', weight: 0.6 },
                { name: 'language', weight: 0.4 },
                { name: 'topics', weight: 0.3 }
            ],
            threshold: 0.3,
            ignoreLocation: true
        };
        fuse = new Fuse(state.allRepos, options);
    }

    function setupEventListeners() {
        // Search
        els.searchInput.addEventListener('input', debounce((e) => {
            state.filters.search = e.target.value.trim();
            applyFilters();
        }, 200));

        // Checkboxes
        els.filterArchived.addEventListener('change', (e) => {
            state.filters.archived = e.target.checked;
            applyFilters();
        });

        els.filterTemplate.addEventListener('change', (e) => {
            state.filters.template = e.target.checked;
            applyFilters();
        });

        // Clear Buttons
        els.clearLangBtn.addEventListener('click', () => {
            state.filters.language = null;
            applyFilters();
        });

        els.clearTopicBtn.addEventListener('click', () => {
            state.filters.topic = null;
            applyFilters();
        });

        els.resetAllBtn.addEventListener('click', resetFilters);

        // Sort
        els.sortSelect.addEventListener('change', (e) => {
            state.sort = e.target.value;
            applyFilters(); // Re-sorts filtered list
        });
    }

    function setupObserver() {
        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                loadMore();
            }
        }, { rootMargin: '200px' });
    }

    function resetFilters() {
        state.filters = {
            search: '',
            language: null,
            topic: null,
            archived: false,
            template: false
        };
        els.searchInput.value = '';
        els.filterArchived.checked = false;
        els.filterTemplate.checked = false;
        applyFilters();
    }

    // --- Core Logic ---

    function applyFilters() {
        let result = state.allRepos;

        // 1. Search
        if (state.filters.search) {
            result = fuse.search(state.filters.search).map(r => r.item);
        }

        // 2. Facet Filtering
        result = result.filter(repo => {
            if (!state.filters.archived && repo.archived) return false;
            // Template check (assuming we might add isTemplate later, for now relying on tags/desc)
            if (state.filters.template && !repo.is_template) return false; 
            
            if (state.filters.language && repo.language !== state.filters.language) return false;
            if (state.filters.topic && !repo.topics.includes(state.filters.topic)) return false;
            
            return true;
        });

        // 3. Sorting
        result.sort((a, b) => {
            switch (state.sort) {
                case 'stars': return b.stars - a.stars;
                case 'forks': return b.forks - a.forks;
                case 'pushed_at': return new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0);
                case 'size': return b.disk_usage - a.disk_usage;
                case 'starred_at': default: 
                    return new Date(b.user_starred_at || 0) - new Date(a.user_starred_at || 0);
            }
        });

        state.filteredRepos = result;
        state.visibleCount = 50; // Reset pagination
        
        updateUI();
    }

    function updateUI() {
        // Update Counts & Headers
        els.repoCount.textContent = `${state.filteredRepos.length} repositories`;
        
        renderFacets();
        renderGrid();
        renderActiveFilters();
    }

    function renderFacets() {
        // 1. Languages
        const langCounts = {};
        state.filteredRepos.forEach(r => {
            if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
        });

        const sortedLangs = Object.entries(langCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Top 10

        renderFacetList(els.facetLanguage, sortedLangs, state.filters.language, (val) => {
            state.filters.language = state.filters.language === val ? null : val;
            applyFilters();
        });

        els.clearLangBtn.hidden = !state.filters.language;

        // 2. Topics
        const topicCounts = {};
        state.filteredRepos.forEach(r => {
            r.topics.forEach(t => {
                topicCounts[t] = (topicCounts[t] || 0) + 1;
            });
        });

        const sortedTopics = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15); // Top 15

        renderFacetList(els.facetTopic, sortedTopics, state.filters.topic, (val) => {
            state.filters.topic = state.filters.topic === val ? null : val;
            applyFilters();
        });

        els.clearTopicBtn.hidden = !state.filters.topic;
    }

    function renderFacetList(container, items, activeItem, callback) {
        container.innerHTML = items.map(([name, count]) => `
            <div class="facet-item ${name === activeItem ? 'selected' : ''}" data-val="${name}">
                <span>${name}</span>
                <span class="count">${count}</span>
            </div>
        `).join('');

        // Attach click handlers
        Array.from(container.children).forEach(el => {
            el.addEventListener('click', () => callback(el.dataset.val));
        });
    }

    function renderActiveFilters() {
        const filters = [];
        if (state.filters.search) filters.push(`"${state.filters.search}"`);
        if (state.filters.language) filters.push(state.filters.language);
        if (state.filters.topic) filters.push(`#${state.filters.topic}`);
        if (state.filters.archived) filters.push('Archived');
        
        els.activeFilters.innerHTML = filters.length 
            ? filters.map(f => `<span class="topic-tag">${f}</span>`).join('') 
            : '';
    }

    function renderGrid() {
        const slice = state.filteredRepos.slice(0, state.visibleCount);
        
        if (slice.length === 0) {
            els.repoGrid.innerHTML = '<div class="no-results">No repositories found.</div>';
            els.loadingTrigger.style.display = 'none';
            return;
        }

        els.repoGrid.innerHTML = slice.map(repo => createCardHTML(repo)).join('');
        
        // Handle Loader
        if (state.visibleCount < state.filteredRepos.length) {
            els.loadingTrigger.style.display = 'block';
            observer.observe(els.loadingTrigger);
        } else {
            els.loadingTrigger.style.display = 'none';
            observer.unobserve(els.loadingTrigger);
        }
    }

    function loadMore() {
        if (state.visibleCount >= state.filteredRepos.length) return;
        
        const nextBatch = state.filteredRepos.slice(state.visibleCount, state.visibleCount + 50);
        state.visibleCount += 50;
        
        // Append instead of rewrite to prevent jank
        const fragment = document.createRange().createContextualFragment(
            nextBatch.map(repo => createCardHTML(repo)).join('')
        );
        els.repoGrid.appendChild(fragment);

        if (state.visibleCount >= state.filteredRepos.length) {
            els.loadingTrigger.style.display = 'none';
        }
    }

    function createCardHTML(repo) {
        // Fallback for avatar
        const avatar = repo.avatar || `https://github.com/${repo.repo.split('/')[0]}.png`;
        const timeAgo = getRelativeTime(repo.pushed_at);

        return `
            <div class="repo-card">
                <div class="card-header">
                    <img src="${avatar}" class="owner-avatar" alt="Avatar" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'">
                    <div class="repo-name">
                        <a href="${repo.html_url}" target="_blank">${repo.repo}</a>
                    </div>
                </div>
                <div class="repo-desc" title="${escapeHtml(repo.summary)}">
                    ${escapeHtml(repo.summary || 'No description provided.')}
                </div>
                
                <div class="topics">
                    ${repo.topics.slice(0, 3).map(t => `<span class="topic-tag">${t}</span>`).join('')}
                </div>

                <div class="card-footer">
                    <div class="stat-item star-count">
                        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor" style="display:inline-block;vertical-align:text-bottom"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
                        ${formatNumber(repo.stars)}
                    </div>
                    <div class="stat-item">
                        <span class="lang-dot" style="background-color: ${getLangColor(repo.language)}"></span>
                        ${repo.language}
                    </div>
                    <div class="stat-item" title="${new Date(repo.pushed_at).toLocaleDateString()}">
                        ${timeAgo}
                    </div>
                </div>
            </div>
        `;
    }

    // --- Helpers ---

    function getRelativeTime(dateStr) {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const diff = (new Date() - date) / 1000;
        
        if (diff < 60) return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        if (diff < 31536000) return Math.floor(diff / 604800) + 'w ago';
        return Math.floor(diff / 31536000) + 'y ago';
    }

    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num;
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // GitHub Language Colors (simplified)
    function getLangColor(lang) {
        const colors = {
            'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572A5',
            'Java': '#b07219', 'Go': '#00ADD8', 'Rust': '#dea584', 'C++': '#f34b7d',
            'C': '#555555', 'Shell': '#89e051', 'HTML': '#e34c26', 'CSS': '#563d7c',
            'Vue': '#41b883', 'Ruby': '#701516'
        };
        return colors[lang] || '#ccc';
    }

    // Start
    init();

})();
