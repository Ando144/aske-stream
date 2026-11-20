import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useI18n } from './i18n';
import './fonts.css';
import './stores/prefs';
import './styles.css';
import { initNativeShell } from './native/shell';
import { useUpdater } from './stores/updater';
import { startListeningTracker } from './stats/tracker';

document.documentElement.lang = useI18n.getState().language;
initNativeShell();
// It only records while the person has accepted the Recap (consent === 'on').
startListeningTracker();
void useUpdater.getState().init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
