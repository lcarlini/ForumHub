import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { startActivityWatch, useVault } from './lib/vault-store';
import { applyTheme } from './lib/prefs';

applyTheme();
startActivityWatch();
void useVault.getState().init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
