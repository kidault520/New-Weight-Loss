import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { enforceBeijingTimezone } from './utils/enforceBeijingTimezone';

enforceBeijingTimezone();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);











