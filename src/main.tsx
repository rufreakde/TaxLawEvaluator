import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No root element');
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
