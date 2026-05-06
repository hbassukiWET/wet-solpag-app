import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { UserProfile } from "@/types/payment";

interface AuthContextType {
  user: UserProfile | null;
  loginError: string | null;
  handleLoginWithPassword: (password: string, remember: boolean) => boolean;
  handleLogout: () => void;
}

const STORAGE_KEY = "auth_remembered_user";

const PASSWORD_USERS: Record<string, UserProfile> = {
  fact: { email: "gla@wilbureagle.com", name: "GLA" },
  fact2: { email: "rsosa@wilbureagle.com", name: "R. Sosa" },
  fact3: { email: "otros@wilbureagle.com", name: "Otros WET" },
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const getInitialUser = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {
    // ignore
  }
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(getInitialUser);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginWithPassword = useCallback((password: string, remember: boolean) => {
    const profile = PASSWORD_USERS[password.trim().toLowerCase()];
    if (!profile) {
      setLoginError("Contraseña incorrecta.");
      return false;
    }
    try {
      if (remember) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(profile);
    setLoginError(null);
    return true;
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
    setLoginError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loginError, handleLoginWithPassword, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
