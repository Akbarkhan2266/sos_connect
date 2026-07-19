"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Siren, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { sosApi, extractErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { saveLiveLocation } from "@/lib/liveLocation";

type Stage = "idle" | "locating" | "describe" | "sending";

const EMERGENCY_OPTIONS = [
  "Chest pain or medical emergency",
  "Bleeding or injury",
  "Fire or smoke",
  "Stuck or trapped",
  "Road accident",
] as const;

export default function SOSButton({ onCreated }: { onCreated: (sosId: string) => void }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [stage, setStage] = useState<Stage>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [isOther, setIsOther] = useState(false);

  const startFlow = () => {
    setStage("locating");
    if (!("geolocation" in navigator)) {
      toast.error("Is device par location available nahi hai.");
      setStage("idle");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(location);
        if (user) saveLiveLocation(user.userId, location);
        setStage("describe");
      },
      () => {
        toast.error("Location permission zaroori hai SOS bhejne ke liye.");
        setStage("idle");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const cancel = () => {
    setStage("idle");
    setDescription("");
    setSelectedProblem(null);
    setIsOther(false);
    setCoords(null);
  };

  const submit = async () => {
    if (!coords || !description.trim()) {
      toast.error("Please select or describe the emergency.");
      return;
    }
    setStage("sending");
    try {
      const { data } = await sosApi.post("/sos", {
        lat: coords.lat,
        lng: coords.lng,
        description: description || "Emergency — no description provided",
      });
      toast.success("SOS bhej diya. Help aa rahi hai.");
      onCreated(data.sosId);
      router.push(`/dashboard/sos/${data.sosId}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "SOS bhejne mein dikkat hui."));
      setStage("describe");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 sm:p-6 shadow-card mb-8">
        <p className="font-display font-semibold text-lg">What kind of help do you need?</p>
        <p className="text-sm text-ink/50 mt-1">Choose the closest problem so responders have useful context.</p>
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          {EMERGENCY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => { setSelectedProblem(option); setDescription(option); setIsOther(false); }}
              className={`rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition ${selectedProblem === option ? "border-danger-500 bg-danger-50 text-danger-700" : "border-ink/10 text-ink/65 hover:bg-ink/[0.03]"}`}
            >
              {option}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setSelectedProblem("other"); setDescription(""); setIsOther(true); }}
            className={`rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition ${selectedProblem === "other" ? "border-danger-500 bg-danger-50 text-danger-700" : "border-ink/10 text-ink/65 hover:bg-ink/[0.03]"}`}
          >
            Other — describe the problem
          </button>
        </div>
        {isOther && <textarea autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what happened…" rows={3} className="mt-3 w-full px-4 py-3 rounded-2xl bg-ink/[0.03] border border-transparent focus:border-danger-500 focus:bg-white outline-none text-sm resize-none transition-colors" />}
      </div>
      <button
        onClick={startFlow}
        disabled={stage !== "idle" || !description.trim()}
        aria-label="Send SOS"
        className="pulse-rings text-danger-500 disabled:opacity-70"
      >
        <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-gradient-to-br from-danger-400 to-danger-600 flex flex-col items-center justify-center text-white shadow-glow active:scale-[0.97] transition-transform">
          {stage === "locating" ? (
            <Loader2 size={40} className="animate-spin" />
          ) : (
            <Siren size={44} />
          )}
          <span className="font-display font-semibold text-sm mt-2 tracking-wide">
            {stage === "locating" ? "Locating…" : "SEND SOS"}
          </span>
        </div>
      </button>
      <p className="text-sm text-ink/40 mt-6 text-center max-w-[220px]">
        Tap karo — nearest available volunteers ko turant notify kiya jayega.
      </p>

      {(stage === "describe" || stage === "sending") && coords && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-soft p-6 animate-float-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">What&apos;s happening?</h3>
              <button
                onClick={cancel}
                disabled={stage === "sending"}
                className="w-8 h-8 rounded-full flex items-center justify-center text-ink/40 hover:bg-ink/5"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-ink/40 font-mono mb-3">
              📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>

            <div className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{description}</div>

            <button
              onClick={submit}
              disabled={stage === "sending"}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-danger-500 text-white font-medium text-sm py-3.5 rounded-2xl hover:bg-danger-600 active:scale-[0.98] transition disabled:opacity-60"
            >
              {stage === "sending" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {stage === "sending" ? "Sending…" : "Confirm & send SOS"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
