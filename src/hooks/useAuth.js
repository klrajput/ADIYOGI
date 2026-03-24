import { useState, useEffect } from 'react';

// Since this is anonymous, we'll simulate basic session tracking without personal data
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // For an anonymous forum, we don't need traditional auth
    // But we can track anonymous sessions for basic functionality
    const initializeAnonymousSession = () => {
      // Check if user has an anonymous session ID
      let sessionId = localStorage.getItem('mh_chan_session');
      
      if (!sessionId) {
        // Generate anonymous session ID
        sessionId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('mh_chan_session', sessionId);
      }

      // Set anonymous user object
      const anonymousUser = {
        id: sessionId,
        isAnonymous: true,
        sessionStart: localStorage.getItem('mh_chan_session_start') || Date.now(),
        preferences: JSON.parse(localStorage.getItem('mh_chan_preferences') || '{}')
      };

      // Store session start time if not exists
      if (!localStorage.getItem('mh_chan_session_start')) {
        localStorage.setItem('mh_chan_session_start', Date.now().toString());
      }

      setUser(anonymousUser);
      setLoading(false);
    };

    // Simulate loading delay for realistic experience
    setTimeout(initializeAnonymousSession, 500);
  }, []);

  const updatePreferences = (newPreferences) => {
    if (user) {
      const updatedPreferences = { ...user.preferences, ...newPreferences };
      const updatedUser = { ...user, preferences: updatedPreferences };
      
      setUser(updatedUser);
      localStorage.setItem('mh_chan_preferences', JSON.stringify(updatedPreferences));
    }
  };

  const resetSession = () => {
    localStorage.removeItem('mh_chan_session');
    localStorage.removeItem('mh_chan_session_start');
    localStorage.removeItem('mh_chan_preferences');
    setUser(null);
    setLoading(true);
    
    // Reinitialize session
    setTimeout(() => {
      const sessionId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mh_chan_session', sessionId);
      localStorage.setItem('mh_chan_session_start', Date.now().toString());
      
      const anonymousUser = {
        id: sessionId,
        isAnonymous: true,
        sessionStart: Date.now(),
        preferences: {}
      };
      
      setUser(anonymousUser);
      setLoading(false);
    }, 200);
  };

  const getSessionInfo = () => {
    if (!user) return null;
    
    const sessionStart = parseInt(localStorage.getItem('mh_chan_session_start') || '0');
    const sessionDuration = Date.now() - sessionStart;
    const hours = Math.floor(sessionDuration / (1000 * 60 * 60));
    const minutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      sessionId: user.id,
      duration: { hours, minutes },
      isNew: sessionDuration < (1000 * 60 * 5) // New if less than 5 minutes
    };
  };

  return {
    user,
    loading,
    updatePreferences,
    resetSession,
    getSessionInfo,
    isAuthenticated: !!user,
    isAnonymous: true
  };
};

export default useAuth;
