"use client";

import { useState, useCallback } from "react";
import { sanitizeInput, sanitizeObject } from "@/lib/security/xss";

// Types
export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  status: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  status: number | null;
}

export interface ApiOptions {
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  timeout?: number;
  sanitize?: boolean;
}

const DEFAULT_TIMEOUT = 30000;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

async function processResponse<T>(
  response: Response,
  sanitize: boolean,
): Promise<ApiResponse<T>> {
  let data: T | null = null;
  let error: ApiError | null = null;

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const jsonResponse = await response.json();

    if (response.ok) {
      // Sanitize response data
      data = sanitize ? sanitizeObject(jsonResponse) : jsonResponse;
    } else {
      error = {
        message: jsonResponse.message || "Request failed",
        code: jsonResponse.code,
        details: jsonResponse.details,
      };
    }
  } else if (!response.ok) {
    error = {
      message: `HTTP Error: ${response.status}`,
      code: `HTTP_${response.status}`,
    };
  }

  return { data, error, status: response.status };
}

// Base fetch function with XSS protection
async function apiFetch<T>(
  method: string,
  url: string,
  body?: unknown,
  options: ApiOptions = {},
): Promise<ApiResponse<T>> {
  const {
    headers = {},
    credentials = "include",
    timeout = DEFAULT_TIMEOUT,
    sanitize = true,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

    // Sanitize request body if enabled
    const sanitizedBody = body && sanitize ? sanitizeObject(body) : body;

    const requestOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest", // CSRF protection
        ...headers,
      },
      credentials,
      signal: controller.signal,
    };

    if (sanitizedBody && method !== "GET" && method !== "HEAD") {
      requestOptions.body = JSON.stringify(sanitizedBody);
    }

    const response = await fetch(fullUrl, requestOptions);
    
    // Handle 401 Unauthorized - attempt refresh
    if (response.status === 401 && !url.includes("/auth/login") && !url.includes("/auth/refresh")) {
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "X-Requested-With": "XMLHttpRequest" },
          credentials,
        });

        if (refreshResponse.ok) {
          // Retry original request
          const retryResponse = await fetch(fullUrl, requestOptions);
          return await processResponse<T>(retryResponse, sanitize);
        } else {
          // Refresh failed, redirect to signin
          if (typeof window !== "undefined") {
            window.location.href = "/signin";
          }
        }
      } catch (err) {
        if (typeof window !== "undefined") {
          window.location.href = "/signin";
        }
      }
    }

    // Handle other errors
    if (response.status >= 400 && response.status !== 401) {
       // You might want specific logic for 403, 404, etc.
    }

    return await processResponse<T>(response, sanitize);
  } catch (err) {
    clearTimeout(timeoutId);
    // ... rest of error handling

    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return {
          data: null,
          error: { message: "Request timeout", code: "TIMEOUT" },
          status: 0,
        };
      }
      return {
        data: null,
        error: { message: err.message, code: "NETWORK_ERROR" },
        status: 0,
      };
    }

    return {
      data: null,
      error: { message: "Unknown error occurred", code: "UNKNOWN" },
      status: 0,
    };
  }
}

// API method functions
export const api = {
  get: <T>(url: string, options?: ApiOptions) =>
    apiFetch<T>("GET", url, undefined, options),

  post: <T>(url: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>("POST", url, body, options),

  put: <T>(url: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>("PUT", url, body, options),

  patch: <T>(url: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>("PATCH", url, body, options),

  delete: <T>(url: string, body?: unknown, options?: ApiOptions) =>
    apiFetch<T>("DELETE", url, body, options),
};

// Hook for API calls with state management
export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: false,
    status: null,
  });

  const execute = useCallback(
    async (
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      url: string,
      body?: unknown,
      options?: ApiOptions,
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await apiFetch<T>(method, url, body, options);

      setState({
        data: response.data,
        error: response.error,
        loading: false,
        status: response.status,
      });

      return response;
    },
    [],
  );

  const get = useCallback(
    (url: string, options?: ApiOptions) =>
      execute("GET", url, undefined, options),
    [execute],
  );

  const post = useCallback(
    (url: string, body?: unknown, options?: ApiOptions) =>
      execute("POST", url, body, options),
    [execute],
  );

  const put = useCallback(
    (url: string, body?: unknown, options?: ApiOptions) =>
      execute("PUT", url, body, options),
    [execute],
  );

  const patch = useCallback(
    (url: string, body?: unknown, options?: ApiOptions) =>
      execute("PATCH", url, body, options),
    [execute],
  );

  const del = useCallback(
    (url: string, body?: unknown, options?: ApiOptions) =>
      execute("DELETE", url, body, options),
    [execute],
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      loading: false,
      status: null,
    });
  }, []);

  return {
    ...state,
    get,
    post,
    put,
    patch,
    delete: del,
    reset,
  };
}

export default useApi;
