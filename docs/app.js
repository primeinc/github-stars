// GitHub Stars Browser
(function() {
    'use strict';

    let allRepos = [];
    let filteredRepos = [];
    let activeTag = null;
    let currentView = 'grid';

    // DOM Elements
    const searchInput = document.getElementById('search');
    const categoryFilter = document.getElementById('category-filter');
    const languageFilter = document.getElementById('language-filter');
    const sortBy = document.getElementById('sort-by');
    const statsTotal = document.getElementById('stats-total');
    const statsShowing = document.getElementById('stats-showing');
    const tagCloud = document.getElementById('tag-cloud');
    const reposContainer = document.getElementById('repos-container');
    const viewGridBtn = document.getElementById('view-grid');
    const viewListBtn = document.getElementById('view-list');

    // Initialize
    async function init() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('Failed to load data');
            const data = await response.json();
            allRepos = data.repositories || [];
            
            populateFilters();
            buildTagCloud();
            applyFilters();
            
            statsTotal.textContent = `${allRepos.length} repositories`;
        } catch (error) {
            console.error('Error loading data:', error);
            reposContainer.innerHTML = '<div class="no-results">Failed to load repositories. Make sure data.json exists.</div>';
        }
    }

    // Populate filter dropdowns
    function populateFilters() {
        const categories = new Set();
        const languages = new Set();

        allRepos.forEach(repo => {
            (repo.categories || []).forEach(cat => categories.add(cat));
            if (repo.github_metadata?.language) {
                languages.add(repo.github_metadata.language);
            }
        });

        // Sort and add categories
        [...categories].sort().forEach(cat => {
            if (cat !== 'unclassified') {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = formatCategory(cat);
                categoryFilter.appendChild(option);
            }
        });

        // Sort and add languages
        [...languages].sort().forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = lang;
            languageFilter.appendChild(option);
        });
    }

    // Build tag cloud with top tags
    function buildTagCloud() {
        const tagCounts = {};
        
        allRepos.forEach(repo => {
            (repo.tags || []).forEach(tag => {
                if (!tag.startsWith('lang:')) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            });
        });

        // Get top 20 tags
        const topTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);

        tagCloud.innerHTML = topTags.map(([tag, count]) => 
            `<span class="tag" data-tag="${tag}">${tag}<span class="count">(${count})</span></span>`
        ).join('');

        // Add click handlers
        tagCloud.querySelectorAll('.tag').forEach(el => {
            el.addEventListener('click', () => {
                const tag = el.dataset.tag;
                if (activeTag === tag) {
                    activeTag = null;
                    el.classList.remove('active');
                } else {
                    tagCloud.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
                    activeTag = tag;
                    el.classList.add('active');
                }
                applyFilters();
            });
        });
    }

    // Format category name
    function formatCategory(cat) {
        return cat.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    // Apply all filters and render
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const category = categoryFilter.value;
        const language = languageFilter.value;
        const sort = sortBy.value;

        filteredRepos = allRepos.filter(repo => {
            // Search filter
            if (searchTerm) {
                const searchable = [
                    repo.repo,
                    repo.summary,
                    ...(repo.categories || []),
                    ...(repo.tags || [])
                ].join(' ').toLowerCase();
                if (!searchable.includes(searchTerm)) return false;
            }

            // Category filter
            if (category && !(repo.categories || []).includes(category)) {
                return false;
            }

            // Language filter
            if (language && repo.github_metadata?.language !== language) {
                return false;
            }

            // Tag filter
            if (activeTag && !(repo.tags || []).includes(activeTag)) {
                return false;
            }

            // Skip unclassified repos unless specifically searching
            if (!searchTerm && !category && (repo.categories || []).includes('unclassified')) {
                return false;
            }

            return true;
        });

        // Sort
        filteredRepos.sort((a, b) => {
            switch (sort) {
                case 'stars-desc':
                    return (b.github_metadata?.stargazers_count || 0) - (a.github_metadata?.stargazers_count || 0);
                case 'stars-asc':
                    return (a.github_metadata?.stargazers_count || 0) - (b.github_metadata?.stargazers_count || 0);
                case 'name-asc':
                    return a.repo.localeCompare(b.repo);
                case 'name-desc':
                    return b.repo.localeCompare(a.repo);
                case 'recent-desc':
                    return new Date(b.starred_at || 0) - new Date(a.starred_at || 0);
                case 'recent-asc':
                    return new Date(a.starred_at || 0) - new Date(b.starred_at || 0);
                case 'updated-desc':
                    return new Date(b.github_metadata?.pushed_at || 0) - new Date(a.github_metadata?.pushed_at || 0);
                default:
                    return 0;
            }
        });

        renderRepos();
        updateStats();
    }

    // Update stats display
    function updateStats() {
        if (filteredRepos.length === allRepos.length) {
            statsShowing.textContent = '';
        } else {
            statsShowing.textContent = `Showing ${filteredRepos.length}`;
        }
    }

    // Render repository cards
    function renderRepos() {
        if (filteredRepos.length === 0) {
            reposContainer.innerHTML = '<div class="no-results">No repositories found matching your criteria.</div>';
            return;
        }

        // Update container class based on view
        reposContainer.className = `repos ${currentView}-view`;

        if (currentView === 'list') {
            renderListView();
        } else {
            renderGridView();
        }
    }

    // Render grid view (cards)
    function renderGridView() {
        reposContainer.innerHTML = filteredRepos.map(repo => {
            const meta = repo.github_metadata || {};
            const stars = meta.stargazers_count || 0;
            const language = meta.language || '';
            const categories = (repo.categories || []).filter(c => c !== 'unclassified');
            const tags = (repo.tags || []).filter(t => !t.startsWith('lang:')).slice(0, 5);

            return `
                <div class="repo-card">
                    <h3><a href="https://github.com/${repo.repo}" target="_blank" rel="noopener">${repo.repo}</a></h3>
                    <p class="description">${escapeHtml(repo.summary || 'No description')}</p>
                    <div class="meta">
                        ${stars ? `<span class="stars">&#9733; ${formatNumber(stars)}</span>` : ''}
                        ${language ? `<span class="language">&#9679; ${language}</span>` : ''}
                    </div>
                    ${categories.length ? `
                        <div class="categories">
                            ${categories.map(c => `<span class="category">${formatCategory(c)}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${tags.length ? `
                        <div class="tags">
                            ${tags.map(t => `<span class="tag">${t}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // Render list view (compact rows)
    function renderListView() {
        reposContainer.innerHTML = filteredRepos.map(repo => {
            const meta = repo.github_metadata || {};
            const stars = meta.stargazers_count || 0;
            const language = meta.language || '';
            const categories = (repo.categories || []).filter(c => c !== 'unclassified');

            return `
                <div class="repo-row">
                    <div class="repo-row-main">
                        <a href="https://github.com/${repo.repo}" target="_blank" rel="noopener" class="repo-name">${repo.repo}</a>
                        <span class="repo-summary">${escapeHtml(repo.summary || 'No description')}</span>
                    </div>
                    <div class="repo-row-meta">
                        ${stars ? `<span class="stars">&#9733; ${formatNumber(stars)}</span>` : ''}
                        ${language ? `<span class="language">${language}</span>` : ''}
                        ${categories.length ? `<span class="category">${formatCategory(categories[0])}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Set view mode
    function setView(view) {
        currentView = view;
        viewGridBtn.classList.toggle('active', view === 'grid');
        viewListBtn.classList.toggle('active', view === 'list');
        renderRepos();
    }

    // Helper: Format large numbers
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    // Helper: Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event Listeners
    searchInput.addEventListener('input', debounce(applyFilters, 200));
    categoryFilter.addEventListener('change', applyFilters);
    languageFilter.addEventListener('change', applyFilters);
    sortBy.addEventListener('change', applyFilters);
    viewGridBtn.addEventListener('click', () => setView('grid'));
    viewListBtn.addEventListener('click', () => setView('list'));

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Start
    init();
})();
