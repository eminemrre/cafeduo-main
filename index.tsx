import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { initializeErrorReporting } from './lib/errorReporting';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './fonts';
import './index.css';
import './styles/identity.css';
import './styles/landing.css';

initializeErrorReporting();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
