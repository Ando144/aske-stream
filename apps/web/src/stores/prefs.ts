import { create } from 'zustand';
import { loadPref, savePref } from '../lib/storage';

export type ThemeMode = 'system' | 'dark' | 'light';
export type Palette = 'amber' | 'terracotta' | 'olive';

interface Prefs {
  theme: ThemeMode;
  palette: Palette;
  /** Play button plays songs available offline first, then streams the rest. */
  dataSaver: boolean;
}

interface PrefsState extends Prefs {
  set: (patch: Partial<Prefs>) => void;
}

const DEFAULTS: Prefs = { theme: 'system', palette: 'amber', dataSaver: false };

const media = window.matchMedia?.('(prefers-color-scheme: light)');

/** Applies theme + palette to <html> so CSS variables switch instantly. */
function applyTheme(p: Prefs) {
  const light = p.theme === 'light' || (p.theme === 'system' && media?.matches);
  const root = document.documentElement;
  root.dataset.theme = light ? 'light' : 'dark';
  root.dataset.palette = p.palette;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#14110f');
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ...loadPref<Prefs>('prefs', DEFAULTS),
  set(patch) {
    const next = { ...get(), ...patch };
    const { set: _set, ...prefs } = next;
    savePref('prefs', prefs);
    set(patch);
    applyTheme(prefs);
  },
}));

applyTheme(usePrefs.getState());
media?.addEventListener('change', () => applyTheme(usePrefs.getState()));
