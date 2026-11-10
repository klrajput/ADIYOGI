import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, users } from '../api/endpoints';

const IdentityContext = createContext(null);

/**
 * Holds the caller's server-issued identity (anonymous session or account),
 * its preferences, and the actions that change them. There is no client-side
 * "identity generation": the API owns identity and stores it in httpOnly cookies.
 */
export function IdentityProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const { data } = await auth.me();
      setIdentity(data.identity);
      return data.identity;
    } catch {
      // No usable session — establish an anonymous one.
      try {
        const { data } = await auth.bootstrap();
        setIdentity(data.identity);
        return data.identity;
      } catch (bootstrapError) {
        setError(bootstrapError);
        return null;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Apply the accessibility preference globally, on load and on every change.
  const reduceMotion = identity?.preferences?.reduceMotion === true;
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
  }, [reduceMotion]);

  const login = useCallback(async (payload) => {
    const { data } = await auth.login(payload);
    setIdentity(data.identity);
    return data.identity;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await auth.register(payload);
    setIdentity(data.identity);
    return data.identity;
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setIdentity(null);
    // Immediately re-establish an anonymous identity so the forum keeps working.
    const { data } = await auth.bootstrap();
    setIdentity(data.identity);
    return data.identity;
  }, []);

  const updatePreferences = useCallback(async (payload) => {
    const { data } = await users.updatePreferences(payload);
    setIdentity((current) => (current ? { ...current, preferences: data.preferences } : current));
    return data.preferences;
  }, []);

  const value = useMemo(
    () => ({
      identity,
      loading,
      error,
      isAnonymous: identity?.kind === 'anonymous',
      isAuthenticated: Boolean(identity),
      isModerator: identity?.role === 'moderator' || identity?.role === 'admin',
      isAdmin: identity?.role === 'admin',
      refresh,
      login,
      register,
      logout,
      updatePreferences,
    }),
    [identity, loading, error, refresh, login, register, logout, updatePreferences]
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) throw new Error('useIdentity must be used inside <IdentityProvider>');
  return context;
}

export default IdentityContext;
