import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './styles/index.css';
import './styles/chan-theme.css';

// Components
import Header from './components/Layout/Header';
import Navigation from './components/Layout/Navigation';
import Footer from './components/Layout/Footer';
import CrisisAlert from './components/Layout/CrisisAlert';
import ErrorBoundary from './components/Common/ErrorBoundary';
import Chatbot from './components/Common/Chatbot';

// Pages
import HomePage from './pages/HomePage';
import BoardPage from './pages/BoardPage';
import ThreadPage from './pages/ThreadPage';
import CrisisPage from './pages/CrisisPage';
import GuidelinesPage from './pages/GuidelinesPage';
import DatabasePage from './pages/DatabasePage';
import NotFoundPage from './pages/NotFoundPage';

// Hooks
import useAuth from './hooks/useAuth';

// Crisis Detection
import { initializeCrisisDetection } from './utils/crisisDetection';

function App() {
  const [crisisDetected, setCrisisDetected] = useState(false);
  const { loading } = useAuth(); // Removed unused 'user' variable

  useEffect(() => {
    // Initialize crisis detection
    initializeCrisisDetection((detected) => {
      setCrisisDetected(detected);
      if (detected) {
        window.showCrisisHelp?.();
      } else {
        window.hideCrisisHelp?.();
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading AdiYogi…</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          {crisisDetected && <CrisisAlert />}
          <Header />
          <Navigation />
          
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/board/:boardId" element={<BoardPage />} />
              <Route path="/thread/:threadId" element={<ThreadPage />} />
              <Route path="/crisis" element={<CrisisPage />} />
              <Route path="/guidelines" element={<GuidelinesPage />} />
              <Route path="/admin/database" element={<DatabasePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          
          <Footer />
          
          {/* MindBot Chatbot */}
          <Chatbot />
          
          {/* Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1E2A3E',
                color: '#F8FAFC',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(16px)',
                borderRadius: '12px',
                fontSize: '0.9rem',
              },
              success: {
                iconTheme: { primary: '#10B981', secondary: '#1E2A3E' },
                style: { borderLeft: '3px solid #10B981' },
              },
              error: {
                iconTheme: { primary: '#F43F5E', secondary: '#1E2A3E' },
                style: { borderLeft: '3px solid #F43F5E' },
              },
            }}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
