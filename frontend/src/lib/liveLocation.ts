type LiveLocation = {
  lat: number;
  lng: number;
  updatedAt: number;
};

const KEY_PREFIX = "sos-connect-live-location:";
const MAX_AGE_MS = 30_000;

export function saveLiveLocation(userId: string, location: { lat: number; lng: number }): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    KEY_PREFIX + userId,
    JSON.stringify({ ...location, updatedAt: Date.now() } satisfies LiveLocation)
  );
}

// A recent on-duty position makes the responder map available immediately
// after accepting an SOS. A fresh GPS watch still replaces it right away.
export function getRecentLiveLocation(userId: string): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY_PREFIX + userId) ?? "null") as LiveLocation | null;
    if (!value || typeof value.lat !== "number" || typeof value.lng !== "number" || Date.now() - value.updatedAt > MAX_AGE_MS) {
      return null;
    }
    return { lat: value.lat, lng: value.lng };
  } catch {
    return null;
  }
}
