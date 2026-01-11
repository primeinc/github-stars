// Star Vault - 2026 UX Showcase
(function() {
    'use strict';

    // ============================================
    // STATE MANAGEMENT
    // ============================================

    const state = {
        allRepos: [],
        filteredRepos: [],
        visibleRepos: [],
        visibleCount: 50,
        filters: {
            search: '',
            category: null,
            language: null,
            topic: null,
            archived: false,
            template: false
        },
        sort: 'starred_at',
        sidebarOpen: false
    };

    let fuse = null;
    let observer = null;

    // ============================================
    // DOM ELEMENTS
    // ============================================

    const els = {
        searchInput: document.getElementById('searchInput'),
        filterArchived: document.getElementById('filter-archived'),
        filterTemplate: document.getElementById('filter-template'),
        facetCategory: document.getElementById('facet-category'),
        facetLanguage: document.getElementById('facet-language'),
        facetTopic: document.getElementById('facet-topic'),
        clearCategoryBtn: document.getElementById('clear-category'),
        clearLangBtn: document.getElementById('clear-lang'),
        clearTopicBtn: document.getElementById('clear-topic'),
        resetAllBtn: document.getElementById('reset-all'),
        repoCount: document.getElementById('repo-count'),
        activeFilters: document.getElementById('active-filters'),
        sortSelect: document.getElementById('sortSelect'),
        repoGrid: document.getElementById('repo-grid'),
        loadingTrigger: document.getElementById('loading-trigger'),
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        cursorGlow: document.querySelector('.cursor-glow')
    };

    // ============================================
    // INITIALIZE
    // ============================================

    async function init() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('Failed to load data');
            const data = await response.json();

            // Normalize data
            state.allRepos = (data.repositories || []).map(repo => ({
                ...repo,
                // Flatten critical metadata for easier access
                html_url: repo.github_metadata?.html_url || `https://github.com/${repo.repo}`,
                homepage_url: repo.github_metadata?.homepage_url || null,
                stars: repo.github_metadata?.stargazers_count || 0,
                forks: repo.github_metadata?.forks_count || 0,
                language: repo.github_metadata?.language || 'Unknown',
                topics: repo.github_metadata?.topics || [],
                pushed_at: repo.github_metadata?.repo_pushed_at || null,
                avatar: repo.github_metadata?.owner_avatar || null,
                disk_usage: repo.github_metadata?.disk_usage || 0,
                is_fork: repo.github_metadata?.is_fork || false
            }));

            initFuse();
            setupEventListeners();
            setupObserver();
            initCustomCursor();
            initTiltEffect();
            initMagneticButtons();
            animateCounters();

            // Initial Render
            applyFilters();

        } catch (error) {
            console.error('Initialization failed:', error);
            els.repoGrid.innerHTML = '<div class="no-results">Failed to load Star Vault.</div>';
        }
    }

    // ============================================
    // CUSTOM CURSOR GLOW EFFECT
    // ============================================

    function initCustomCursor() {
        if (!els.cursorGlow) return;

        let cursorX = 0, cursorY = 0;
        let actualX = 0, actualY = 0;

        document.addEventListener('mousemove', (e) => {
            cursorX = e.clientX;
            cursorY = e.clientY;
        });

        // Use requestAnimationFrame for smooth following
        function animateCursor() {
            actualX += (cursorX - actualX) * 0.1;
            actualY += (cursorY - actualY) * 0.1;
            els.cursorGlow.style.left = actualX + 'px';
            els.cursorGlow.style.top = actualY + 'px';
            requestAnimationFrame(animateCursor);
        }
        animateCursor();
    }

    // ============================================
    // 3D CARD TILT EFFECT
    // ============================================

    function initTiltEffect() {
        // Reinitialize after cards are rendered
        const observeCards = () => {
            document.querySelectorAll('.repo-card').forEach(card => {
                if (card.hasAttribute('data-tilt-initialized')) return;

                card.addEventListener('mousemove', (e) => {
                    const rect = card.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const rotateX = (y - centerY) / 20;
                    const rotateY = (centerX - x) / 20;

                    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02) translateY(-8px)`;
                });

                card.addEventListener('mouseleave', () => {
                    card.style.transform = '';
                });

                card.setAttribute('data-tilt-initialized', 'true');
            });
        };

        // Initial setup
        observeCards();

        // Watch for dynamically added cards
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    observeCards();
                }
            });
        });

        observer.observe(els.repoGrid, { childList: true });
    }

    // ============================================
    // MAGNETIC BUTTON EFFECT
    // ============================================

    function initMagneticButtons() {
        document.querySelectorAll('.btn-magnetic').forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    // ============================================
    // ANIMATED COUNTERS
    // ============================================

    function animateCounters() {
        document.querySelectorAll('[data-count]').forEach(el => {
            const target = parseInt(el.dataset.count);
            const duration = 2000;
            const start = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 4); // Ease out quart
                el.textContent = Math.floor(target * eased).toLocaleString();

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }
            requestAnimationFrame(update);
        });
    }

    // ============================================
    // FUSE.JS SEARCH INITIALIZATION
    // ============================================

    function initFuse() {
        const options = {
            keys: [
                { name: 'repo', weight: 1.0 },
                { name: 'summary', weight: 0.6 },
                { name: 'categories', weight: 0.5 },
                { name: 'language', weight: 0.4 },
                { name: 'topics', weight: 0.3 }
            ],
            threshold: 0.3,
            ignoreLocation: true
        };
        fuse = new Fuse(state.allRepos, options);
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

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
        els.clearCategoryBtn.addEventListener('click', () => {
            state.filters.category = null;
            applyFilters();
        });

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
            applyFilters();
        });

        // Mobile Sidebar Toggle
        els.sidebarToggle.addEventListener('click', toggleSidebar);
        els.sidebarOverlay.addEventListener('click', closeSidebar);

        // Close sidebar when selecting a filter on mobile
        els.sidebar.addEventListener('click', (e) => {
            if (e.target.classList.contains('facet-item') || e.target.closest('.facet-item')) {
                if (window.innerWidth <= 900) {
                    closeSidebar();
                }
            }
        });

        // Category chip click delegation (on grid)
        els.repoGrid.addEventListener('click', (e) => {
            const chip = e.target.closest('.category-chip');
            if (chip) {
                e.preventDefault();
                state.filters.category = chip.dataset.category;
                applyFilters();
                if (window.innerWidth <= 900) {
                    closeSidebar();
                }
            }
        });
    }

    // ============================================
    // SIDEBAR TOGGLE
    // ============================================

    function toggleSidebar() {
        state.sidebarOpen = !state.sidebarOpen;
        els.sidebar.classList.toggle('open', state.sidebarOpen);
        els.sidebarToggle.classList.toggle('active', state.sidebarOpen);
        els.sidebarOverlay.classList.toggle('visible', state.sidebarOpen);
        els.sidebarToggle.setAttribute('aria-expanded', state.sidebarOpen);
        document.body.style.overflow = state.sidebarOpen ? 'hidden' : '';
    }

    function closeSidebar() {
        if (!state.sidebarOpen) return;
        state.sidebarOpen = false;
        els.sidebar.classList.remove('open');
        els.sidebarToggle.classList.remove('active');
        els.sidebarOverlay.classList.remove('visible');
        els.sidebarToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    // ============================================
    // INTERSECTION OBSERVER FOR INFINITE SCROLL
    // ============================================

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
            category: null,
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

    // ============================================
    // CORE FILTERING LOGIC
    // ============================================

    function applyFilters() {
        let result = state.allRepos;

        // 1. Search
        if (state.filters.search) {
            result = fuse.search(state.filters.search).map(r => r.item);
        }

        // 2. Facet Filtering
        result = result.filter(repo => {
            if (!state.filters.archived && repo.archived) return false;
            if (state.filters.template && !repo.is_template) return false;
            if (state.filters.category && !repo.categories?.includes(state.filters.category)) return false;
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
        state.visibleCount = 50;

        updateUI();
    }

    // ============================================
    // UI UPDATE WITH VIEW TRANSITIONS
    // ============================================

    function updateUI() {
        // View Transitions API
        if (!document.startViewTransition) {
            _render();
            return;
        }

        document.startViewTransition(() => {
            _render();
        });
    }

    function _render() {
        els.repoCount.textContent = `${state.filteredRepos.length} repositories`;

        renderFacets();
        renderGrid();
        renderActiveFilters();
    }

    // ============================================
    // RENDER FACETS
    // ============================================

    function renderFacets() {
        // 1. Categories
        const categoryCounts = {};
        state.filteredRepos.forEach(r => {
            (r.categories || []).forEach(c => {
                categoryCounts[c] = (categoryCounts[c] || 0) + 1;
            });
        });

        const sortedCategories = Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 12);

        renderFacetList(els.facetCategory, sortedCategories, state.filters.category, (val) => {
            state.filters.category = state.filters.category === val ? null : val;
            applyFilters();
        });

        els.clearCategoryBtn.hidden = !state.filters.category;

        // 2. Languages (sort "Unknown" to bottom)
        const langCounts = {};
        state.filteredRepos.forEach(r => {
            if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
        });

        const sortedLangs = Object.entries(langCounts)
            .sort((a, b) => {
                // Push "Unknown" to bottom
                if (a[0] === 'Unknown') return 1;
                if (b[0] === 'Unknown') return -1;
                return b[1] - a[1];
            })
            .slice(0, 10);

        renderFacetList(els.facetLanguage, sortedLangs, state.filters.language, (val) => {
            state.filters.language = state.filters.language === val ? null : val;
            applyFilters();
        });

        els.clearLangBtn.hidden = !state.filters.language;

        // 3. Topics
        const topicCounts = {};
        state.filteredRepos.forEach(r => {
            r.topics.forEach(t => {
                topicCounts[t] = (topicCounts[t] || 0) + 1;
            });
        });

        const sortedTopics = Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15);

        renderFacetList(els.facetTopic, sortedTopics, state.filters.topic, (val) => {
            state.filters.topic = state.filters.topic === val ? null : val;
            applyFilters();
        });

        els.clearTopicBtn.hidden = !state.filters.topic;
    }

    function renderFacetList(container, items, activeItem, callback) {
        container.innerHTML = items.map(([name, count]) => `
            <div class="facet-item ${name === activeItem ? 'selected' : ''}" data-val="${name}">
                <span>${escapeHtml(name)}</span>
                <span class="count">${count}</span>
            </div>
        `).join('');

        Array.from(container.children).forEach(el => {
            el.addEventListener('click', () => callback(el.dataset.val));
        });
    }

    function renderActiveFilters() {
        const filters = [];
        if (state.filters.search) filters.push(`"${state.filters.search}"`);
        if (state.filters.category) filters.push(`[${state.filters.category}]`);
        if (state.filters.language) filters.push(state.filters.language);
        if (state.filters.topic) filters.push(`#${state.filters.topic}`);
        if (state.filters.archived) filters.push('Archived');

        els.activeFilters.innerHTML = filters.length
            ? filters.map(f => `<span class="topic-tag">${escapeHtml(f)}</span>`).join('')
            : '';
    }

    // ============================================
    // RENDER GRID
    // ============================================

    function renderGrid() {
        const slice = state.filteredRepos.slice(0, state.visibleCount);

        if (slice.length === 0) {
            els.repoGrid.innerHTML = '<div class="no-results">No repositories found.</div>';
            els.loadingTrigger.style.display = 'none';
            return;
        }

        els.repoGrid.innerHTML = slice.map(repo => createCardHTML(repo)).join('');

        if (state.visibleCount < state.filteredRepos.length) {
            els.loadingTrigger.style.display = 'block';
            observer.observe(els.loadingTrigger);
        } else {
            els.loadingTrigger.style.display = 'none';
            observer.unobserve(els.loadingTrigger);
        }

        // Reinitialize tilt effect for new cards
        initTiltEffect();
    }

    function loadMore() {
        if (state.visibleCount >= state.filteredRepos.length) return;

        const nextBatch = state.filteredRepos.slice(state.visibleCount, state.visibleCount + 50);
        state.visibleCount += 50;

        const fragment = document.createRange().createContextualFragment(
            nextBatch.map(repo => createCardHTML(repo)).join('')
        );
        els.repoGrid.appendChild(fragment);

        if (state.visibleCount >= state.filteredRepos.length) {
            els.loadingTrigger.style.display = 'none';
        }

        // Reinitialize tilt effect for new cards
        initTiltEffect();
    }

    // ============================================
    // CREATE CARD HTML
    // ============================================

    function createCardHTML(repo) {
        const avatar = repo.avatar || `https://github.com/${repo.repo.split('/')[0]}.png`;
        const timeAgo = getRelativeTime(repo.pushed_at);
        const hasCategories = repo.categories && repo.categories.length > 0;
        const hasTopics = repo.topics && repo.topics.length > 0;
        const cardClasses = ['repo-card'];
        if (repo.archived) cardClasses.push('is-archived');

        // Bento Logic: High impact repos get more space
        if (repo.stars > 10000) cardClasses.push('bento-featured');
        if (repo.stars > 50000) cardClasses.push('bento-hero');

        // Status badges
        let badges = '';
        if (repo.archived) {
            badges += '<span class="badge badge-archived">Archived</span>';
        }
        if (repo.is_fork) {
            badges += '<span class="badge badge-fork">Fork</span>';
        }

        // Homepage link
        let homepageLink = '';
        if (repo.homepage_url) {
            homepageLink = `
                <a href="${escapeHtml(repo.homepage_url)}" target="_blank" rel="noopener" class="homepage-link" title="Homepage">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25zm-.025 5.525a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 1 1-2.83-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 1 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25z"></path>
                    </svg>
                </a>`;
        }

        return `
            <div class="${cardClasses.join(' ')}" data-tilt>
                <div class="card-header">
                    <img src="${avatar}" class="owner-avatar" alt="Avatar" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%228%22 fill=%22%23475569%22/></svg>'">
                    <div class="repo-name">
                        <a href="${repo.html_url}" target="_blank">${escapeHtml(repo.repo)}</a>
                    </div>
                    ${homepageLink}
                    ${badges ? `<div class="card-badges">${badges}</div>` : ''}
                </div>
                <div class="repo-desc" title="${escapeHtml(repo.summary)}">
                    ${escapeHtml(repo.summary || 'No description provided.')}
                </div>

                ${hasCategories ? `
                <div class="categories">
                    ${repo.categories.slice(0, 3).map(c => `<button class="category-chip" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}
                </div>
                ` : ''}

                ${hasTopics ? `
                <div class="topics">
                    ${repo.topics.slice(0, 3).map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('')}
                </div>
                ` : ''}

                <div class="card-footer">
                    <div class="stat-item star-count">
                        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path></svg>
                        ${formatNumber(repo.stars)}
                    </div>
                    <div class="stat-item">
                        <svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14" fill="currentColor" class="fork-icon"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"></path></svg>
                        ${formatNumber(repo.forks)}
                    </div>
                    <div class="stat-item">
                        <span class="lang-dot" style="background-color: ${getLangColor(repo.language)}"></span>
                        ${escapeHtml(repo.language)}
                    </div>
                    <div class="stat-item" title="${repo.disk_usage ? formatBytes(repo.disk_usage * 1024) : 'Unknown size'}">
                        ${timeAgo}
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

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

    function formatBytes(bytes) {
        if (bytes === 0 || !bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
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
            'Vue': '#41b883', 'Ruby': '#701516', 'C#': '#178600', 'PHP': '#4F5D95',
            'Kotlin': '#A97BFF', 'Swift': '#F05138', 'Dart': '#00B4AB'
        };
        return colors[lang] || '#ccc';
    }

    // ============================================
    // START THE APP
    // ============================================

    init();

})();
