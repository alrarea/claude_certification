const API_URL = import.meta.env.VITE_API_URL as string;

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem("refreshToken");
}

export function setRefreshToken(token: string | null) {
  if (token) sessionStorage.setItem("refreshToken", token);
  else sessionStorage.removeItem("refreshToken");
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;

  const data = await res.json();
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return true;
}

export async function apiFetch(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch(path, options, false);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Request failed");
  return data;
}
