import React from 'react';
import ReactDOM from 'react-dom/client';
import { DeployProvider } from './contexts/DeployContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DeployProvider>
      <App />
    </DeployProvider>
  </React.StrictMode>,
);
