// Per-device UI preferences only (never secrets, never vault data).
const KEY = 'forumhub:theme';

export type ThemeChoice = 'dark' | 'light';

export function getTheme(): ThemeChoice {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: ThemeChoice = getTheme()): void {
  document.documentElement.classList.toggle('light', theme === 'light');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable: the in-memory class still applies */
  }
}
