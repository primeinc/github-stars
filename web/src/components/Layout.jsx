import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Github } from 'lucide-react';
import styles from './Layout.module.css';

export function Layout({ children, sidebar }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Github className={styles.logo} />
          <span>Star Vault</span>
        </div>
        <div className={styles.sidebarContent}>
          {sidebar}
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.searchContainer}>
            {/* Search slot or title */}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={toggleTheme} className={styles.iconBtn} aria-label="Toggle Theme">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}
