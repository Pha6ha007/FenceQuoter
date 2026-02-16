// contexts/AuthContext.tsx
// Auth context and provider — CLAUDE.md section 2

import { createContext, useContext, type ReactNode } from "react";

import { useAuth, type UseAuthReturn } from "@/hooks/useAuth";

const AuthContext = createContext<UseAuthReturn | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): ReactNode {
  const auth = useAuth();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): UseAuthReturn {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}
