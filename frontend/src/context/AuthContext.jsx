import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data.user);
    return data.user;
  };
  const register = async (name, email, password) => {
    const { data } = await api.post("/auth/register", { name, email, password });
    setUser(data.user);
    return data;
  };
  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };
  const googleLogin = async (id_token) => {
    const { data } = await api.post("/auth/google", { id_token });
    setUser(data.user);
    return data.user;
  };
  const verifyEmail = async (token) => {
    const { data } = await api.post(`/auth/verify-email/${token}`);
    await refresh();
    return data;
  };
  const resendVerification = async (email) => {
    const { data } = await api.post("/auth/resend-verification", { email });
    return data;
  };
  const forgotPassword = async (email) => {
    const { data } = await api.post("/auth/forgot-password", { email });
    return data;
  };
  const resetPassword = async (token, new_password) => {
    const { data } = await api.post("/auth/reset-password", { token, new_password });
    return data;
  };
  const changePassword = async (current_password, new_password) => {
    const { data } = await api.post("/auth/change-password", { current_password, new_password });
    return data;
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, googleLogin, refresh,
      verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
