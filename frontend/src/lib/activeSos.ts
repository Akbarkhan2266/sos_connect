const KEY_PREFIX = "sos-connect-active-sos:";

export function getActiveSosId(userId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY_PREFIX + userId);
}

export function setActiveSosId(userId: string, sosId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + userId, sosId);
}

export function clearActiveSosId(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY_PREFIX + userId);
}
