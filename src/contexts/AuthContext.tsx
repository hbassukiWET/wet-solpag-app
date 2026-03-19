import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { googleLogout } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import type { UserProfile } from "@/types/payment";

interface AuthContextType {
  user: UserProfile | null;
  loginError: string | null;
  handleLoginSuccess: (credentialResponse: { credential?: string }) => void;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

interface DecodedToken {
  email: string;
  name: string;
  picture?: string;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = sessionStorage.getItem("auth_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginSuccess = useCallback((credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setLoginError("No se recibió credencial de Google.");
      return;
    }

    try {
      const decoded = jwtDecode<DecodedToken>(credentialResponse.credential);

      if (!decoded.email.endsWith("@wilbureagle.com")) {
        googleLogout();
        setLoginError("Acceso restringido. Solo cuentas @wilbureagle.com pueden ingresar.");
        return;
      }

      const profile: UserProfile = {
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
      };
      sessionStorage.setItem("auth_user", JSON.stringify(profile));
      setUser(profile);
      setLoginError(null);
    } catch {
      setLoginError("Error al decodificar el token.");
    }
  }, []);

  const handleLogout = useCallback(() => {
    googleLogout();
    sessionStorage.removeItem("auth_user");
    setUser(null);
    setLoginError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loginError, handleLoginSuccess, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
