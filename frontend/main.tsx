import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/styles/index.css';
import './src/locales'; // 初始化 i18n
import { SettingsProvider } from './src/contexts/SettingsContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);

