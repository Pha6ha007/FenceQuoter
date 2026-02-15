// hooks/useAuth.ts
// Authentication hook with Supabase Auth — CLAUDE.md section 2

import { useCallback, useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import type { AuthError, Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  session: Session | null;
  user: User | null;
};

type AuthActions = {
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithApple: () => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
};

export type UseAuthReturn = AuthState & AuthActions;

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    session: null,
    user: null,
  });

  // ============================================================
  // SESSION LISTENER
  // ============================================================

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        isLoading: false,
        isAuthenticated: !!session,
        session,
        user: session?.user ?? null,
      });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        isLoading: false,
        isAuthenticated: !!session,
        session,
        user: session?.user ?? null,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ============================================================
  // EMAIL AUTH
  // ============================================================

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | null }> => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return { error };
        }

        // Session will be updated via onAuthStateChange
        return { error: null };
      } catch (e) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return {
          error: {
            message: "An unexpected error occurred",
            name: "UnknownError",
            status: 500,
          } as AuthError,
        };
      }
    },
    []
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<{ error: AuthError | null }> => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            // Email confirmation is handled by Supabase settings
            // For development, you can disable email confirmation in Supabase dashboard
          },
        });

        if (error) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return { error };
        }

        // Note: If email confirmation is enabled, user won't be logged in automatically
        setState((prev) => ({ ...prev, isLoading: false }));
        return { error: null };
      } catch (e) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return {
          error: {
            message: "An unexpected error occurred",
            name: "UnknownError",
            status: 500,
          } as AuthError,
        };
      }
    },
    []
  );

  // ============================================================
  // SIGN OUT
  // ============================================================

  const signOut = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        Alert.alert("Sign out failed", error.message);
      }

      // State will be updated via onAuthStateChange
    } catch (e) {
      Alert.alert("Sign out failed", "An unexpected error occurred");
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // ============================================================
  // PASSWORD RESET
  // ============================================================

  const resetPassword = useCallback(
    async (email: string): Promise<{ error: AuthError | null }> => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            // Redirect URL for password reset (deep link)
            redirectTo: "fencequoter://reset-password",
          }
        );

        return { error };
      } catch (e) {
        return {
          error: {
            message: "An unexpected error occurred",
            name: "UnknownError",
            status: 500,
          } as AuthError,
        };
      }
    },
    []
  );

  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ error: AuthError | null }> => {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        return { error };
      } catch (e) {
        return {
          error: {
            message: "An unexpected error occurred",
            name: "UnknownError",
            status: 500,
          } as AuthError,
        };
      }
    },
    []
  );

  // ============================================================
  // OAUTH PROVIDERS
  // ============================================================

  const signInWithGoogle = useCallback(async (): Promise<{ error: AuthError | null }> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "fencequoter://auth/callback",
          skipBrowserRedirect: Platform.OS !== "web",
        },
      });

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return { error };
      }

      // For native platforms, the redirect will happen automatically
      // Session will be updated via onAuthStateChange after redirect
      return { error: null };
    } catch (e) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return {
        error: {
          message: "An unexpected error occurred",
          name: "UnknownError",
          status: 500,
        } as AuthError,
      };
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<{ error: AuthError | null }> => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: "fencequoter://auth/callback",
          skipBrowserRedirect: Platform.OS !== "web",
        },
      });

      if (error) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return { error };
      }

      return { error: null };
    } catch (e) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return {
        error: {
          message: "An unexpected error occurred",
          name: "UnknownError",
          status: 500,
        } as AuthError,
      };
    }
  }, []);

  // ============================================================
  // REFRESH SESSION
  // ============================================================

  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        // Session expired or invalid, sign out
        await supabase.auth.signOut();
        return;
      }

      if (data.session) {
        setState({
          isLoading: false,
          isAuthenticated: true,
          session: data.session,
          user: data.session.user,
        });
      }
    } catch (e) {
      // Silently fail, session will be handled by onAuthStateChange
    }
  }, []);

  return {
    ...state,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
    signInWithGoogle,
    signInWithApple,
    refreshSession,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get user-friendly error message from AuthError
 */
export function getAuthErrorMessage(error: AuthError | null): string {
  if (!error) return "";

  // Map common Supabase auth errors to user-friendly messages
  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Invalid email or password";
  }
  if (message.includes("email not confirmed")) {
    return "Please verify your email address";
  }
  if (message.includes("user already registered")) {
    return "An account with this email already exists";
  }
  if (message.includes("password should be at least")) {
    return "Password must be at least 6 characters";
  }
  if (message.includes("rate limit")) {
    return "Too many attempts. Please try again later";
  }
  if (message.includes("network")) {
    return "Network error. Please check your connection";
  }

  return error.message;
}

/**
 * Check if user has completed onboarding (has profile with company_name)
 */
export async function checkOnboardingComplete(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("company_name")
      .eq("id", userId)
      .single();

    if (error || !data) return false;

    // Consider onboarding complete if company_name is set
    return Boolean(data.company_name && data.company_name.trim().length > 0);
  } catch {
    return false;
  }
}
