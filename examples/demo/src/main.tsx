import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

const stored = localStorage.getItem('composer-demo-theme');
const initialTheme = stored === 'light' ? 'light' : 'dark';
document.documentElement.classList.toggle('dark', initialTheme === 'dark');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
