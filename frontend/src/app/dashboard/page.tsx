"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Inbox, HeartHandshake, LifeBuoy } from "lucide-react";
import { useAuthStore, Role } from "@/store/useAuthStore";
import { sosApi, userApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { getActiveSosId, setActiveSosId, clearActiveSosId } from "@/lib/activeSos";
import { SosRecord } from "@/lib/types";
import Navbar from "@/components/Navbar";
import SOSButton from "@/components/SOSButton";
import ActiveSOSCard from "@/components/ActiveSOSCard";
import AvailabilityToggle from "@/components/AvailabilityToggle";
import IncomingSOSCard from "@/components/IncomingSOSCard";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [mode, setMode] = useState<Role>("victim");
  const [hasChosenMode, setHasChosenMode] = useState(false);

  const [activeSos, setActiveSos] = useState<SosRecord | null>(null);
  const [checkingActiveSos, setCheckingActiveSos] = useState(true);

  const [isAvailable, setIsAvailable] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(true);

  const [incoming, setIncoming] = useState<SosRecord[]>([]);

  // Guard the route. Every dashboard visit starts with an explicit choice,
  // because one account can both request and provide help.
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [hydrated, user, router]);

  // Pull current availability from user-service automatically on load.
  useEffect(() => {
    if (!user) return;
    userApi
      .get(`/users/${user.userId}`)
      .then(({ data }) => setIsAvailable(!!data.isAvailable))
      .catch(() => {})
      .finally(() => setLoadingAvailability(false));
  }, [user]);

  // Check for a locally-tracked active SOS and verify it's still not resolved.
  useEffect(() => {
    if (!user) return;
    const storedId = getActiveSosId(user.userId);
    if (!storedId) {
      setCheckingActiveSos(false);
      return;
    }
    sosApi
      .get(`/sos/${storedId}`)
      .then(({ data }) => {
        if (data.status === "resolved" || data.status === "cancelled") {
          clearActiveSosId(user.userId);
          setActiveSos(null);
        } else {
          setActiveSos(data);
        }
      })
      .catch(() => clearActiveSosId(user.userId))
      .finally(() => setCheckingActiveSos(false));
  }, [user]);

  // Auto socket registration — fires on mount AND on every reconnect, since a
  // reconnect gets a fresh socket id that the backend needs to re-associate.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onSosStatus = (data: SosRecord) => {
      setActiveSos((prev) => (prev?._id === data._id ? data : prev));
      if (data.status === "cancelled" && user) clearActiveSosId(user.userId);
    };

    const registerAll = () => {
      socket.emit("register-volunteer", user.userId);
      const sosId = getActiveSosId(user.userId);
      if (sosId) socket.emit("join-sos-room", sosId);
    };

    if (socket.connected) registerAll();
    socket.on("connect", registerAll);
    socket.on("sos-status", onSosStatus);

    return () => {
      socket.off("connect", registerAll);
      socket.off("sos-status", onSosStatus);
    };
  }, [user]);

  // Live incoming SOS feed for volunteer mode.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onNewSos = (data: SosRecord) => {
      setIncoming((prev) =>
        prev.some((s) => s._id === data._id) ? prev : [data, ...prev]
      );
    };
    const onSosTaken = ({ sosId }: { sosId: string }) => {
      setIncoming((prev) => prev.filter((s) => s._id !== sosId));
    };

    socket.on("new-sos", onNewSos);
    socket.on("sos-taken", onSosTaken);

    return () => {
      socket.off("new-sos", onNewSos);
      socket.off("sos-taken", onSosTaken);
    };
  }, [user]);

  const handleSosCreated = useCallback(
    (sosId: string) => {
      if (!user) return;
      setActiveSosId(user.userId, sosId);
      getSocket().emit("join-sos-room", sosId);
    },
    [user]
  );

  const handleAccepted = useCallback((sosId: string) => {
    setIncoming((prev) => prev.filter((s) => s._id !== sosId));
  }, []);

  const chooseMode = (nextMode: Role) => {
    setMode(nextMode);
    setHasChosenMode(true);
  };

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-ink/30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Navbar isAvailable={mode === "volunteer" ? isAvailable : undefined} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!hasChosenMode ? (
          <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-card text-center animate-float-in">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/40">Choose your view</p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold mt-2">How can SOS Connect help today?</h1>
            <p className="text-sm text-ink/50 mt-3">You can switch between both views whenever you need.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-7 text-left">
              <button onClick={() => chooseMode("victim")} className="rounded-2xl border border-danger-100 bg-danger-50 p-5 transition hover:-translate-y-0.5 hover:shadow-card active:scale-[0.98]">
                <LifeBuoy className="text-danger-500" size={24} />
                <span className="mt-4 block font-display font-semibold">I need help</span>
                <span className="mt-1 block text-sm text-ink/55">Raise an SOS and share your emergency location.</span>
              </button>
              <button onClick={() => chooseMode("volunteer")} className="rounded-2xl border border-safe-100 bg-safe-50 p-5 transition hover:-translate-y-0.5 hover:shadow-card active:scale-[0.98]">
                <HeartHandshake className="text-safe-600" size={24} />
                <span className="mt-4 block font-display font-semibold">I want to volunteer</span>
                <span className="mt-1 block text-sm text-ink/55">Go on duty and see SOS requests sent near you.</span>
              </button>
            </div>
          </section>
        ) : (
          <>
            {mode === "victim" && (
          <section>
            {checkingActiveSos ? (
              <div className="flex items-center justify-center py-16 text-ink/30">
                <Loader2 className="animate-spin" />
              </div>
            ) : activeSos ? (
              <ActiveSOSCard sos={activeSos} />
            ) : (
              <SOSButton onCreated={handleSosCreated} />
            )}
          </section>
            )}

            {mode === "volunteer" && (
          <section className="space-y-4">
            {loadingAvailability ? (
              <div className="flex items-center justify-center py-8 text-ink/30">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              <AvailabilityToggle isAvailable={isAvailable} onChange={setIsAvailable} />
            )}

            <div>
              <h2 className="font-display font-semibold text-sm text-ink/60 mb-3">
                {isAvailable ? "Incoming SOS calls" : "Go on duty to see nearby SOS calls"}
              </h2>

              {isAvailable && incoming.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-ink/30 bg-white/50 rounded-3xl border border-dashed border-ink/10">
                  <Inbox size={22} />
                  <p className="text-sm">Abhi koi SOS nahi hai. Hum sun rahe hain…</p>
                </div>
              )}

              <div className="space-y-4">
                {incoming.map((sos) => (
                  <IncomingSOSCard key={sos._id} sos={sos} onAccepted={handleAccepted} />
                ))}
              </div>
            </div>
          </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
