"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { userApi, extractErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket } from "@/lib/socket";
import { saveLiveLocation } from "@/lib/liveLocation";

const LOCATION_THROTTLE_MS = 10000;

export default function AvailabilityToggle({
  isAvailable,
  onChange,
}: {
  isAvailable: boolean;
  onChange: (next: boolean) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  const stopWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const publishLocation = (lat: number, lng: number) => {
    if (!user) return;
    lastSentRef.current = Date.now();
    saveLiveLocation(user.userId, { lat, lng });
    getSocket().emit("volunteer-location-update", { volunteerId: user.userId, lat, lng });
  };

  const startWatch = () => {
    if (!("geolocation" in navigator) || !user) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < LOCATION_THROTTLE_MS) return;
        publishLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => toast.error("Location track nahi ho pa rahi — permission check karo."),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  // Ensure the watcher always matches the current on/off-duty state,
  // including on page refresh when isAvailable comes back true from the backend.
  useEffect(() => {
    if (isAvailable) {
      startWatch();
    } else {
      stopWatch();
    }
    return stopWatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable]);

  const toggle = async () => {
    if (!user) return;
    const next = !isAvailable;
    setLoading(true);
    try {
      if (next) {
        if (!("geolocation" in navigator)) throw new Error("Location is not supported on this device");
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        publishLocation(position.coords.latitude, position.coords.longitude);
      }
      await userApi.patch(`/users/${user.userId}/availability`, { isAvailable: next });
      getSocket().emit("volunteer-availability-change", { volunteerId: user.userId, isAvailable: next });
      onChange(next);
      toast.success(next ? "Aap ab duty par ho." : "Aap off duty ho gaye.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Availability update nahi ho payi."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-card p-5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
            isAvailable ? "bg-safe-50 text-safe-600" : "bg-ink/5 text-ink/30"
          }`}
        >
          <ShieldCheck size={18} />
        </div>
        <div>
          <p className="font-medium text-sm">
            {isAvailable ? "You're on duty" : "You're off duty"}
          </p>
          <p className="text-xs text-ink/40">
            {isAvailable ? "Sharing live location for matching" : "Toggle on to start receiving SOS calls"}
          </p>
        </div>
      </div>

      <button
        onClick={toggle}
        disabled={loading}
        aria-pressed={isAvailable}
        aria-label="Toggle availability"
        className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${
          isAvailable ? "bg-safe-500" : "bg-ink/15"
        } disabled:opacity-60`}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin absolute inset-0 m-auto text-white" />
        ) : (
          <span
            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
              isAvailable ? "translate-x-6" : "translate-x-0"
            }`}
          />
        )}
      </button>
    </div>
  );
}
