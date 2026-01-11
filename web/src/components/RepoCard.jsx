import { Star, GitFork } from 'lucide-react';
import styles from './RepoCard.module.css';

export function RepoCard({ repo }) {
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
  };

  const getLangColor = (lang) => {
    const colors = {
        'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572A5',
        'Java': '#b07219', 'Go': '#00ADD8', 'Rust': '#dea584', 'C++': '#f34b7d',
        'C': '#555555', 'Shell': '#89e051', 'HTML': '#e34c26', 'CSS': '#563d7c',
        'Vue': '#41b883', 'Ruby': '#701516', 'C#': '#178600', 'PHP': '#4F5D95',
        'Kotlin': '#A97BFF', 'Swift': '#F05138', 'Dart': '#00B4AB'
    };
    return colors[lang] || '#ccc';
  };

  return (
    <div className={`${styles.card} repository-card`}>
      <div className={styles.header}>
        <img 
          src={repo.avatar || `https://github.com/${repo.repo.split('/')[0]}.png`} 
          alt="" 
          className={styles.avatar} 
          loading="lazy"
          onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><circle cx=%228%22 cy=%228%22 r=%228%22 fill=%22%23ccc%22/></svg>'; }}
        />
        <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className={styles.name}>
          {repo.repo}
        </a>
      </div>
      <p className={styles.description} title={repo.summary}>
        {repo.summary || 'No description provided.'}
      </p>
      <div className={styles.footer}>
        <div className={styles.stat} title="Stars">
          <Star size={14} />
          <span>{formatNumber(repo.stars)}</span>
        </div>
        <div className={styles.stat} title="Forks">
          <GitFork size={14} />
          <span>{formatNumber(repo.forks)}</span>
        </div>
        {repo.language && (
          <div className={styles.stat}>
             <span style={{ 
               width: 8, height: 8, borderRadius: '50%', 
               backgroundColor: getLangColor(repo.language),
               display: 'inline-block' 
             }} />
             <span>{repo.language}</span>
          </div>
        )}
      </div>
    </div>
  );
}
