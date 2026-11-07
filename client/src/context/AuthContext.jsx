import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, onDataChange, tokenStore } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      return null;
    }
    try {
      const { user: u } = await api.get('/auth/me');
      setUser(u);
      return u;
    } catch {
      tokenStore.clear();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setReady(true));
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    // Live: points, profile and similar details update when another tab changes something
    let t;
    const off = onDataChange(() => { clearTimeout(t); t = setTimeout(() => { if (tokenStore.get()) refreshUser(); }, 300); });
    return () => { window.removeEventListener('auth:logout', onLogout); clearTimeout(t); off(); };
  }, [refreshUser]);

  const handleAuth = async (res) => {
    tokenStore.set(res.token);
    await refreshUser();
    return res;
  };

  const login = (loginId, password, captchaId, captchaAnswer) =>
    api.post('/auth/login', { login: loginId, password, captchaId, captchaAnswer }).then(handleAuth);
  // Registration returns no token: the email must be verified with the 6-digit code first
  const register = (payload) => api.post('/auth/register', payload);
  const verifyEmail = (email, otp) => api.post('/auth/verify-email', { email, otp }).then(handleAuth);
  const resendOtp = (email) => api.post('/auth/resend-otp', { email });
  const resetPassword = (token, password) => api.post(`/auth/reset-password/${token}`, { password }).then(handleAuth);
  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, ready, login, register, verifyEmail, resendOtp, logout, resetPassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
