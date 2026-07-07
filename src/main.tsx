import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Backoffice from './components/Backoffice.jsx';
import './index.css';

const isBackoffice = window.location.pathname.startsWith('/backoffice');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isBackoffice ? <Backoffice /> : <App />}
  </StrictMode>
);
