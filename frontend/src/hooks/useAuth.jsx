import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('pfms_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('pfms_refresh_token'));
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // Validate the stored token on mount. Re-run when token actually changes.
  useEffect(() => {
    if (!tokenRef.current) {
      setLoading(false);
      return;
    }
    authApi.profile(tokenRef.current)
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('pfms_token');
        localStorage.removeItem('pfms_refresh_token');
        setToken(null);
        setRefreshToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Listen for the 'unauthorized' event dispatched by the axios interceptor on 401.
  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      queryClient.clear();
    }
    window.addEventListener('pfms:auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pfms:auth:unauthorized', onUnauthorized);
  }, [queryClient]);

  const persistTokens = (accessToken, refreshT) => {
    localStorage.setItem('pfms_token', accessToken);
    if (refreshT) localStorage.setItem('pfms_refresh_token', refreshT);
    setToken(accessToken);
    if (refreshT) setRefreshToken(refreshT);
  };

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    persistTokens(res.data.token, res.data.refreshToken);
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const res = await authApi.register(email, password, name);
    persistTokens(res.data.token, res.data.refreshToken);
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    localStorage.removeItem('pfms_token');
    localStorage.removeItem('pfms_refresh_token');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    queryClient.clear();
  }, [refreshToken, queryClient]);

  const getAuthHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
