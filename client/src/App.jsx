import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { IdentityProvider } from './context/IdentityContext';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/layout/AppLayout';
import { LoadingBlock } from './components/ui/Spinner';

// Route-level code splitting keeps the first paint light on mobile.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const BoardPage = lazy(() => import('./pages/BoardPage'));
const NewThreadPage = lazy(() => import('./pages/NewThreadPage'));
const ThreadPage = lazy(() => import('./pages/ThreadPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const CrisisPage = lazy(() => import('./pages/CrisisPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const GuidelinesPage = lazy(() => import('./pages/GuidelinesPage'));
const PreferencesPage = lazy(() => import('./pages/PreferencesPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ModerationPage = lazy(() => import('./pages/ModerationPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RouteFallback() {
  return (
    <div className="container-narrow py-16">
      <LoadingBlock label="Loading page" rows={2} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <IdentityProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/boards/:slug" element={<BoardPage />} />
              <Route path="/boards/:slug/new" element={<NewThreadPage />} />
              <Route path="/threads/:id" element={<ThreadPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/crisis" element={<CrisisPage />} />
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/guidelines" element={<GuidelinesPage />} />
              <Route path="/preferences" element={<PreferencesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/moderation" element={<ModerationPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </IdentityProvider>
    </ToastProvider>
  );
}
