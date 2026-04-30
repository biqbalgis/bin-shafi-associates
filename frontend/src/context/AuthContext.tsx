import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getCurrentUser, loginRequest } from "../api/auth";
import { setAccessToken, storageKeys } from "../api/http";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem(storageKeys.user);
    return storedUser ? (JSON.parse(storedUser) as User) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accessToken = localStorage.getItem(storageKeys.access);
    if (!accessToken) {
      setLoading(false);
      return;
    }

    setAccessToken(accessToken);
    getCurrentUser()
      .then((currentUser) => {
        localStorage.setItem(storageKeys.user, JSON.stringify(currentUser));
        setUser(currentUser);
      })
      .catch(() => {
        localStorage.removeItem(storageKeys.access);
        localStorage.removeItem(storageKeys.refresh);
        localStorage.removeItem(storageKeys.user);
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const payload = await loginRequest(username, password);
    setAccessToken(payload.access);
    localStorage.setItem(storageKeys.refresh, payload.refresh);
    localStorage.setItem(storageKeys.user, JSON.stringify(payload.user));
    setUser(payload.user);
  }

  function logout() {
    localStorage.removeItem(storageKeys.access);
    localStorage.removeItem(storageKeys.refresh);
    localStorage.removeItem(storageKeys.user);
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
