import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { UserProfile } from "@/types/payment";

interface AuthContextType {
  user: UserProfile | null;
  loginError: string | null;
  handleLoginWithPassword: (password: string, remember: boolean) => boolean;
  handleLogout: () => void;
}

const APP_PASSWORD = "fact2";
const STORAGE_KEY = "auth_remembered";

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const DEFAULT_USER: UserProfile = {
  email: "invitado@wilbureagle.com",
  name: "Invitado",
  picture: undefined,
};

const getInitialUser = (): UserProfile | null => {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return DEFAULT_USER;
  } catch {
    // ignore
  }
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(getInitialUser);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginWithPassword = useCallback((password: string, remember: boolean) => {
    if (password !== APP_PASSWORD) {
      setLoginError("Contraseña incorrecta.");
      return false;
    }
    try {
      if (remember) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(DEFAULT_USER);
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
