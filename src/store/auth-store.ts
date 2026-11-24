import { create } from "zustand";

export const AUTH_STORAGE_KEY = "umcine-access-token";

export interface AuthSession {
  accessToken: string;
  memberId: number;
  expiresAt: number;
}

// Decoding identifies the current member; only the server verifies the signature.
export function decodeSession(accessToken: string): AuthSession | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3 || !parts.every(Boolean)) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: unknown; exp?: unknown };
    if (typeof payload.sub !== "string" || !/^[1-9]\d*$/.test(payload.sub)) return null;
    const memberId = Number(payload.sub);
    if (!Number.isSafeInteger(memberId) || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    const expiresAt = payload.exp * 1000;
    if (expiresAt <= Date.now()) return null;
    return { accessToken, memberId, expiresAt };
  } catch {
    return null;
  }
}

function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const token = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const session = token ? decodeSession(token) : null;
    if (token && !session) window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return session;
  } catch {
    return null;
  }
}

interface AuthState {
  hydrated: boolean;
  accessToken: string | null;
  memberId: number | null;
  setSession: (accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  hydrated: false,
  accessToken: null,
  memberId: null,
  setSession: (accessToken) => {
    const session = decodeSession(accessToken);
    if (!session) throw new Error("로그인 응답을 확인하지 못했어요. 다시 로그인해 주세요.");
    try { if (typeof window !== "undefined") window.localStorage.setItem(AUTH_STORAGE_KEY, accessToken); } catch { /* Memory session still works when storage is blocked. */ }
    set({ hydrated: true, accessToken, memberId: session.memberId });
  },
  clearSession: () => {
    try { if (typeof window !== "undefined") window.localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* Storage may be disabled. */ }
    set({ hydrated: true, accessToken: null, memberId: null });
  },
}));

// Run from a client effect, after the server HTML has hydrated.
export function hydrateSession(): void {
  if (typeof window === "undefined") return;
  const session = readStoredSession();
  useAuthStore.setState({ hydrated: true, accessToken: session?.accessToken ?? null, memberId: session?.memberId ?? null });
}

export function getSession(): AuthSession | null {
  const { accessToken, clearSession } = useAuthStore.getState();
  const session = accessToken ? decodeSession(accessToken) : null;
  if (accessToken && !session) clearSession();
  return session;
}
