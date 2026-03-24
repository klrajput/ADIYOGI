import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { Helmet } from 'react-helmet';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Helmet>
      <title>Mental Health Chan - Anonymous Support Forum</title>
      <meta name="description" content="Anonymous mental health support forum for peer support, advice, and community discussions" />
    </Helmet>
    <App />
  </React.StrictMode>
);
