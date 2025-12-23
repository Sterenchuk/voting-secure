import { jwtDecode } from "jwt-decode";
import type { JwtPayload } from "jwt-decode";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost";

function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    if (!decoded.exp) return true;
    const currentTimeSec = Date.now() / 1000;
    return decoded.exp < currentTimeSec + 10; // 10 second buffer
  } catch {
    return true;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refreshToken");

  if (!refreshToken) {
    console.warn("No refresh token found");
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }), // ← Send as object
    });

    if (!response.ok) {
      throw new Error("Refresh failed");
    }

    const data = await response.json();

    localStorage.setItem("accessToken", data.accessToken);

    return data.accessToken;
  } catch (error) {
    console.error("Critical: Could not refresh session", error);

    localStorage.clear();
    window.location.href = "/login";

    return null;
  }
}

export async function protectedFetch(url: string, options: RequestInit = {}) {
  let accessToken = localStorage.getItem("accessToken");

  if (!accessToken || isTokenExpired(accessToken)) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    throw new Error("Session expired. Please log in again.");
  }

  const fullUrl = `${API_BASE_URL}${url}`;

  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...((options.headers as Record<string, string>) || {}),
  };

  if (options.body && !(options.body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const finalOptions: RequestInit = {
    ...options,
    headers: requestHeaders,
    method: options.method || "GET",
  };

  try {
    const response = await fetch(fullUrl, finalOptions);

    if (response.status === 401) {
      accessToken = await refreshAccessToken();

      if (accessToken) {
        requestHeaders["Authorization"] = `Bearer ${accessToken}`;
        finalOptions.headers = requestHeaders;

        const retryResponse = await fetch(fullUrl, finalOptions);

        if (retryResponse.status === 204) return null;

        const retryData = await retryResponse.json();

        if (!retryResponse.ok) {
          throw new Error(retryData.message || `Error ${retryResponse.status}`);
        }

        return retryData;
      }
    }

    if (response.status === 204) return null;

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Error ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}
