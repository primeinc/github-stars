import { useEffect, useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/Layout';
import { RepoCard } from './components/RepoCard';
import styles from './App.module.css';

function AppContent() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    category: null,
    language: null,
    topic: null,
    archived: false,
    template: false
  });
  const [sortBy, setSortBy] = useState('starred'); // starred, stars, pushed, name

  useEffect(() => {
    fetch('data.json')
      .then(res => res.json())
      .then(data => {
        const normalized = (data.repositories || []).map(repo => ({
           ...repo,
           html_url: repo.github_metadata?.html_url || `https://github.com/${repo.repo}`,
           homepage_url: repo.github_metadata?.homepage_url || null,
           stars: repo.github_metadata?.stargazers_count || 0,
           forks: repo.github_metadata?.forks_count || 0,
           language: repo.github_metadata?.language || 'Unknown',
           topics: repo.github_metadata?.topics || [],
           pushed_at: repo.github_metadata?.repo_pushed_at || null,
           is_template: repo.github_metadata?.is_template || false,
           avatar: repo.github_metadata?.owner_avatar
        }));
        setRepos(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(repos, {
      keys: ['repo', 'summary', 'categories', 'language', 'topics'],
      threshold: 0.3
    });
  }, [repos]);

  const getFilteredRepos = useCallback((excludeKey = null) => {
    let result = repos;

    if (filters.search) {
      result = fuse.search(filters.search).map(r => r.item);
    }

    return result.filter(repo => {
      if (excludeKey !== 'archived' && !filters.archived && repo.archived) return false;
      if (excludeKey !== 'template' && filters.template && !repo.is_template) return false;
      if (excludeKey !== 'category' && filters.category && !repo.categories?.includes(filters.category)) return false;
      if (excludeKey !== 'language' && filters.language && repo.language !== filters.language) return false;
      if (excludeKey !== 'topic' && filters.topic && !repo.topics?.includes(filters.topic)) return false;
      return true;
    });
  }, [repos, filters, fuse]);

  const filteredRepos = useMemo(() => {
    const filtered = getFilteredRepos();
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'starred': {
          const aTime = a.user_starred_at ? new Date(a.user_starred_at).getTime() : Number.NEGATIVE_INFINITY;
          const bTime = b.user_starred_at ? new Date(b.user_starred_at).getTime() : Number.NEGATIVE_INFINITY;
          return bTime - aTime;
        }
        case 'stars':
          return b.stars - a.stars;
        case 'pushed':
          return new Date(b.pushed_at || 0) - new Date(a.pushed_at || 0);
        case 'name':
          return a.repo.localeCompare(b.repo);
        default:
          return 0;
      }
    });
  }, [getFilteredRepos, sortBy]);

  const facets = useMemo(() => {
    const getCounts = (items, key, isArray = false) => {
        const counts = {};
        items.forEach(item => {
            const val = item[key];
            if (isArray && Array.isArray(val)) {
                val.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
            } else if (val) {
                counts[val] = (counts[val] || 0) + 1;
            }
        });
        return Object.entries(counts).sort((a,b) => b[1] - a[1]);
    };

    return {
        categories: getCounts(getFilteredRepos('category'), 'categories', true).slice(0, 15),
        languages: getCounts(getFilteredRepos('language'), 'language', false).slice(0, 10),
        topics: getCounts(getFilteredRepos('topic'), 'topics', true).slice(0, 15),
    };
  }, [getFilteredRepos]);

  const Sidebar = (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <label className={styles.checkbox}>
          <input 
            type="checkbox" 
            checked={filters.archived} 
            onChange={e => setFilters(f => ({ ...f, archived: e.target.checked }))} 
          />
          Show Archived
        </label>
        <label className={styles.checkbox}>
          <input 
            type="checkbox" 
            checked={filters.template} 
            onChange={e => setFilters(f => ({ ...f, template: e.target.checked }))} 
          />
          Templates Only
        </label>
      </div>

      <div className={styles.filterGroup}>
        <div className={styles.filterHeader}>
            Categories
            {filters.category && <button type="button" className={styles.clearBtn} onClick={() => setFilters(f => ({...f, category: null}))}>Clear</button>}
        </div>
        <div className={styles.facetList}>
            {facets.categories.map(([cat, count]) => (
                <button 
                  key={cat} 
                  type="button"
                  className={`${styles.facetBtn} ${filters.category === cat ? styles.active : ''}`}
                  onClick={() => setFilters(f => ({...f, category: f.category === cat ? null : cat}))}
                >
                  <span>{cat}</span>
                  <span className={styles.count}>{count}</span>
                </button>
            ))}
        </div>
      </div>

      <div className={styles.filterGroup}>
        <div className={styles.filterHeader}>
            Languages
            {filters.language && <button type="button" className={styles.clearBtn} onClick={() => setFilters(f => ({...f, language: null}))}>Clear</button>}
        </div>
        <div className={styles.facetList}>
            {facets.languages.map(([lang, count]) => (
                <button 
                  key={lang} 
                  type="button"
                  className={`${styles.facetBtn} ${filters.language === lang ? styles.active : ''}`}
                  onClick={() => setFilters(f => ({...f, language: f.language === lang ? null : lang}))}
                >
                  <span>{lang}</span>
                  <span className={styles.count}>{count}</span>
                </button>
            ))}
        </div>
      </div>
    </div>
  );

  return (
    <Layout sidebar={Sidebar}>
      <div className={styles.filters} style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="Search repositories..." 
            className={styles.searchInput}
            value={filters.search}
            onChange={e => setFilters(f => ({...f, search: e.target.value}))}
            style={{ flex: 1 }}
          />
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
            className={styles.sortSelect}
            style={{ padding: '0.5rem', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            <option value="starred">Recently Starred</option>
            <option value="stars">Most Stars</option>
            <option value="pushed">Recently Updated</option>
            <option value="name">Name (A-Z)</option>
          </select>
      </div>
      
      {loading ? (
          <div className={styles.loading}>Loading repositories...</div>
      ) : (
        <div className={styles.grid}>
          {filteredRepos.map((repo) => (
            <RepoCard key={repo.html_url} repo={repo} />
          ))}
        </div>
      )}
      {!loading && filteredRepos.length === 0 && (
          <div className={styles.loading}>No repositories found matching filters.</div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
