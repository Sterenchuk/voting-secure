"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { api, ApiError } from "@/hooks/api/useApi";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: "user" | "admin" | "auditor";
  createdAt: string;
  theme?: string;
  language?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: ApiError | null;
  isAuthenticated: boolean;
}

interface SignInCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface SignUpData {
  name: string;
  email: string;
  password: string;
}

interface AuthContextType extends AuthState {
  signIn: (
    credentials: SignInCredentials,
  ) => Promise<{ success: boolean; error?: ApiError | null }>;
  signUp: (
    data: SignUpData,
  ) => Promise<{ success: boolean; error?: ApiError | null }>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (
    data: Partial<User>,
  ) => Promise<{ success: boolean; error?: ApiError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  const checkAuth = useCallback(async () => {
    try {
      const response = await api.get<User>("/users/me", { skipRefresh: true });

      setState({
        user: response.data ?? null,
        loading: false,
        error: response.data ? null : response.error,
        isAuthenticated: !!response.data,
      });
    } catch {
      setState({
        user: null,
        loading: false,
        error: null,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle global auth expiration
  useEffect(() => {
    const handleExpired = () => {
      setState({
        user: null,
        loading: false,
        error: { message: "Session expired, please sign in again." },
        isAuthenticated: false,
      });
      window.location.href = "/signin";
    };

    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  const signIn = useCallback(async (credentials: SignInCredentials) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.post<{ user: User }>("/auth/login", credentials);

    if (response.data) {
      setState({
        user: response.data.user,
        loading: false,
        error: null,
        isAuthenticated: true,
      });

      return { success: true };
    }

    setState((prev) => ({
      ...prev,
      loading: false,
      error: response.error,
    }));

    return { success: false, error: response.error };
  }, []);

  const signUp = useCallback(async (data: SignUpData) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.post<{ user: User }>("/auth/register", data);

    if (response.data) {
      setState({
        user: response.data.user,
        loading: false,
        error: null,
        isAuthenticated: true,
      });

      return { success: true };
    }

    setState((prev) => ({
      ...prev,
      loading: false,
      error: response.error,
    }));

    return { success: false, error: response.error };
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      await api.post("/auth/logout");
    } catch (e) {
      console.error("Sign out error:", e);
    }

    setState({
      user: null,
      loading: false,
      error: null,
      isAuthenticated: false,
    });
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.patch<{ user: User; access_token: string }>(
      "/users/me",
      data,
    );

    if (response.data?.user) {
      setState((prev) => ({
        ...prev,
        user: response.data!.user,
        loading: false,
      }));
      return { success: true };
    }

    setState((prev) => ({
      ...prev,
      loading: false,
      error: response.error,
    }));

    return { success: false, error: response.error };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signOut,
        checkAuth,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
