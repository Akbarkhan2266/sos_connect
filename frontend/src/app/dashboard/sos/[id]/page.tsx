"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, ArrowLeft, UserRound, Navigation, Phone, XCircle, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { sosApi, userApi, extractErrorMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { clearActiveSosId } from "@/lib/activeSos";
import { getRecentLiveLocation, saveLiveLocation } from "@/lib/liveLocation";
import { SosRecord, STATUS_STEPS, SEVERITY_STYLES } from "@/lib/types";
import Navbar from "@/components/Navbar";
import MapPreview from "@/components/MapPreview";
import LiveSosMap from "@/components/LiveSosMap";

export default function SosTrackingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [sos, setSos] = useState<SosRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [counterpartLocation, setCounterpartLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ownLocation, setOwnLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [counterpart, setCounterpart] = useState<{ name: string; phone: string | null } | null>(null);
  const locationWatchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/login");
  }, [hydrated, user, router]);

  // A resolved SOS is complete for both people in the private SOS room. Give
  // them a moment to see the confirmation, then return each participant to
  // the dashboard automatically.
  useEffect(() => {
    if (sos?.status !== "resolved") return;
    const redirectTimer = window.setTimeout(() => router.replace("/dashboard"), 5_000);
    return () => window.clearTimeout(redirectTimer);
  }, [sos?.status, router]);

  // Automatic hydrate + auto join-sos-room, on mount and on every reconnect.
  useEffect(() => {
    if (!params.id) return;
    sosApi
      .get(`/sos/${params.id}`)
      .then(({ data }) => {
        setSos(data);
        if (user && data.status === "accepted") {
          if (data.acceptedBy === user.userId) {
            setCounterpartLocation((prev) => prev ?? { lat: data.lat, lng: data.lng });
          } else if (data.victimId === user.userId) {
            setOwnLocation((prev) => prev ?? { lat: data.lat, lng: data.lng });
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    const socket = getSocket();
    const join = () => socket.emit("join-sos-room", params.id);
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
    };
  }, [params.id, user]);

  useEffect(() => {
    const socket = getSocket();

    const onStatus = (data: SosRecord) => {
      if (data._id !== params.id) return;
      setSos(data);
      if (user && data.status === "accepted") {
        if (data.acceptedBy === user.userId) {
          setCounterpartLocation((prev) => prev ?? { lat: data.lat, lng: data.lng });
        } else if (data.victimId === user.userId) {
          setOwnLocation((prev) => prev ?? { lat: data.lat, lng: data.lng });
        }
      }
    };

    const onAccepted = (data: { volunteerId: string; message: string; lat?: number; lng?: number }) => {
      setSos((prev) =>
        prev ? { ...prev, status: "accepted", acceptedBy: data.volunteerId } : prev
      );
      if (data.lat && data.lng && user?.userId === data.volunteerId) {
        setCounterpartLocation({ lat: data.lat, lng: data.lng });
      }
      toast.success(data.message || "Volunteer aa raha hai!");
    };

    const onResolved = () => {
      setSos((prev) => (prev ? { ...prev, status: "resolved" } : prev));
      if (user) clearActiveSosId(user.userId);
      toast.success("SOS resolved. Returning to the dashboard in 5 seconds.");
    };

    const onCancelled = () => {
      setSos((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      if (user) clearActiveSosId(user.userId);
      toast.info("SOS cancelled.");
    };

    const onVolunteerNotFound = (data: { message?: string }) => {
      toast.warning(data.message || "No volunteer could accept your SOS yet. We are still looking for help.");
    };

    socket.on("sos-status", onStatus);
    socket.on("sos-accepted", onAccepted);
    socket.on("sos-resolved", onResolved);
    socket.on("sos-cancelled", onCancelled);
    socket.on("volunteer-not-found", onVolunteerNotFound);
    return () => {
      socket.off("sos-status", onStatus);
      socket.off("sos-accepted", onAccepted);
      socket.off("sos-resolved", onResolved);
      socket.off("sos-cancelled", onCancelled);
      socket.off("volunteer-not-found", onVolunteerNotFound);
    };
  }, [params.id, user]);

  // The SOS record stores participant IDs, so look up the other participant's
  // public profile once their identity is known. This lets both sides see a
  // human name instead of an opaque Mongo id.
  useEffect(() => {
    if (!sos || !user) return;
    const counterpartId = sos.victimId === user.userId ? sos.acceptedBy : sos.victimId;
    if (!counterpartId) {
      setCounterpart(null);
      return;
    }

    let cancelled = false;
    userApi
      .get(`/users/${counterpartId}`)
      .then(({ data }) => {
        if (!cancelled && typeof data.name === "string") {
          setCounterpart({ name: data.name, phone: typeof data.phone === "string" ? data.phone : null });
        }
      })
      .catch(() => {
        if (!cancelled) setCounterpart(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sos?.victimId, sos?.acceptedBy, user]);

  // Once accepted, both participants share their live location in the private
  // SOS room. This lets the victim see the responder's ETA and lets the
  // responder see if the victim has moved.
  useEffect(() => {
    if (!sos || sos.status !== "accepted" || !user || !("geolocation" in navigator)) return;
    const socket = getSocket();
    const role = sos.acceptedBy === user.userId ? "volunteer" : "victim";
    const sendLocation = (location: { lat: number; lng: number }) => {
      setOwnLocation(location);
      saveLiveLocation(user.userId, location);
      socket.emit("sos-location-update", { sosId: sos._id, role, ...location });
    };
    const publishLocation = (position: GeolocationPosition) => {
      sendLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    };
    const onLocation = (data: { role: "victim" | "volunteer"; lat: number; lng: number }) => {
      if (data.role !== role) setCounterpartLocation({ lat: data.lat, lng: data.lng });
    };

    socket.on("sos-location", onLocation);
    const recentLocation = getRecentLiveLocation(user.userId);
    if (recentLocation) sendLocation(recentLocation);
    // Send a fresh location immediately. watchPosition may otherwise begin with
    // a cached fix, making the live map look frozen until the device moves.
    navigator.geolocation.getCurrentPosition(
      publishLocation,
      () => toast.error("Current location nahi mil rahi — permission check karo."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );
    locationWatchRef.current = navigator.geolocation.watchPosition(
      publishLocation,
      () => toast.error("Live location share nahi ho pa rahi — permission check karo."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );

    return () => {
      socket.off("sos-location", onLocation);
      if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    };
  }, [sos, user]);

  const resolve = useCallback(async () => {
    if (!sos) return;
    setResolving(true);
    try {
      await sosApi.post(`/sos/${sos._id}/resolve`, {});
      setSos((prev) => (prev ? { ...prev, status: "resolved" } : prev));
      if (user) clearActiveSosId(user.userId);
      toast.success("Marked as resolved. Returning to the dashboard in 5 seconds.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Resolve nahi ho paya."));
    } finally {
      setResolving(false);
    }
  }, [sos, user]);

  const cancel = useCallback(async () => {
    if (!sos || !user) return;
    setCancelling(true);
    try {
      await sosApi.post(`/sos/${sos._id}/cancel`, {});
      setSos((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      clearActiveSosId(user.userId);
      toast.success("SOS cancelled. Volunteers ko notify kar diya gaya hai.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "SOS cancel nahi ho paya."));
    } finally {
      setCancelling(false);
    }
  }, [sos, user]);

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="animate-spin text-ink/30" />
      </div>
    );
  }

  const isAssignedVolunteer = sos?.acceptedBy === user.userId;
  const isVictim = sos?.victimId === user.userId;

  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink mb-5"
        >
          <ArrowLeft size={15} />
          Back to dashboard
        </button>

        {loading && (
          <div className="flex items-center justify-center py-24 text-ink/30">
            <Loader2 className="animate-spin" />
          </div>
        )}

        {notFound && !loading && (
          <div className="text-center py-24 text-ink/40">
            <p className="font-display font-semibold text-lg mb-1">SOS not found</p>
            <p className="text-sm">This request may have been removed.</p>
          </div>
        )}

        {sos && !loading && (
          <div className="space-y-6">
            {isVictim && <Timeline status={sos.status} />}

            <div className="bg-white rounded-3xl shadow-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    SEVERITY_STYLES[sos.severity].bg
                  } ${SEVERITY_STYLES[sos.severity].text}`}
                >
                  {SEVERITY_STYLES[sos.severity].label} severity
                </span>
                <span className="text-xs text-ink/40 capitalize">{sos.category}</span>
              </div>

              <p className="text-sm text-ink/80">{sos.description}</p>

              {sos.status === "accepted" && counterpartLocation && ownLocation ? (
                <LiveSosMap
                  victim={isAssignedVolunteer ? counterpartLocation : ownLocation}
                  volunteer={isAssignedVolunteer ? ownLocation : counterpartLocation}
                />
              ) : (
                <MapPreview lat={sos.lat} lng={sos.lng} />
              )}

              {sos.status === "accepted" && (!counterpartLocation || !ownLocation) && (
                <div className="flex items-center gap-3 rounded-2xl bg-signal-50 px-4 py-3 text-sm text-signal-700">
                  <Navigation size={17} className="shrink-0 animate-pulse" />
                  Waiting for both live locations to start the response map…
                </div>
              )}

              {sos.acceptedBy && (
                <div className="rounded-2xl bg-signal-50 px-4 py-3 text-sm text-ink/65">
                  <div className="flex items-center gap-2">
                    <UserRound size={16} className="shrink-0 text-signal-600" />
                    <span>
                      <span className="font-medium text-ink">{counterpart?.name ?? (isAssignedVolunteer ? "Victim" : "Volunteer")}</span>
                      {isAssignedVolunteer ? " is sharing their live location with you." : " is assigned and sharing their live location."}
                    </span>
                  </div>
                  {counterpart?.phone && (
                    <a href={`tel:${counterpart.phone}`} className="mt-2 flex w-fit items-center gap-2 text-signal-700 hover:text-signal-800">
                      <Phone size={15} />
                      {counterpart.phone}
                    </a>
                  )}
                </div>
              )}

              {sos.status === "accepted" && isAssignedVolunteer && (
                <button
                  onClick={resolve}
                  disabled={resolving}
                  className="w-full flex items-center justify-center gap-2 bg-safe-500 text-white font-medium text-sm py-3.5 rounded-2xl hover:bg-safe-600 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {resolving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {resolving ? "Marking resolved…" : "Mark resolved"}
                </button>
              )}

              {sos.victimId === user.userId && ["open", "matched", "volunteer_not_found"].includes(sos.status) && (
                <button
                  onClick={cancel}
                  disabled={cancelling}
                  className="w-full flex items-center justify-center gap-2 border border-danger-200 bg-danger-50 text-danger-700 font-medium text-sm py-3.5 rounded-2xl hover:bg-danger-100 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {cancelling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                  {cancelling ? "Cancelling…" : "Cancel SOS"}
                </button>
              )}

              {sos.status === "resolved" && (
                isAssignedVolunteer ? (
                  <ThankVolunteer />
                ) : (
                  <div className="flex items-center justify-center gap-2 text-safe-700 bg-safe-50 rounded-2xl py-3.5 text-sm font-medium">
                    <CheckCircle2 size={16} />
                    This SOS has been resolved
                  </div>
                )
              )}

              {sos.status === "cancelled" && (
                <div className="flex items-center justify-center gap-2 text-ink/60 bg-ink/[0.04] rounded-2xl py-3.5 text-sm font-medium">
                  <XCircle size={16} />
                  This SOS was cancelled
                </div>
              )}

              {sos.status === "volunteer_not_found" && (
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-600">
                  No volunteer could accept your SOS in the last 5 minutes. We are still looking for help.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ThankVolunteer() {
  return (
    <div className="rounded-2xl bg-safe-50 px-5 py-6 text-center text-safe-700">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-safe-500 text-white">
        <HeartHandshake size={22} />
      </div>
      <p className="font-display text-lg font-semibold">Thank you, volunteer!</p>
      <p className="mt-1 text-sm text-safe-700/80">You completed this SOS. Your help and time mean a lot.</p>
    </div>
  );
}

function Timeline({ status }: { status: SosRecord["status"] }) {
  const steps = status === "volunteer_not_found"
    ? STATUS_STEPS.filter((step) => ["open", "matched", "volunteer_not_found"].includes(step.key))
    : status === "cancelled"
      ? STATUS_STEPS.filter((step) => ["open", "matched", "cancelled"].includes(step.key))
      : STATUS_STEPS.filter((step) => !["volunteer_not_found", "cancelled"].includes(step.key));
  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="bg-white rounded-3xl shadow-card p-6">
      <div className="flex items-center">
        {steps.map((step, i) => {
          const done = i <= currentIndex;
          const isLast = i === steps.length - 1;
          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    done ? "bg-danger-500 text-white" : "bg-ink/[0.06] text-ink/30"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-[11px] font-medium ${
                    done ? "text-ink/70" : "text-ink/30"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-2 rounded-full transition-colors ${
                    i < currentIndex ? "bg-danger-500" : "bg-ink/[0.08]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
