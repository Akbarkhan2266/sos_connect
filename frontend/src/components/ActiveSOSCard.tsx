"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Clock3 } from "lucide-react";
import { SosRecord, SEVERITY_STYLES, STATUS_STEPS } from "@/lib/types";
import MapPreview from "./MapPreview";

export default function ActiveSOSCard({ sos }: { sos: SosRecord }) {
  const router = useRouter();
  const sev = SEVERITY_STYLES[sos.severity];
  const steps = sos.status === "volunteer_not_found"
    ? STATUS_STEPS.filter((step) => ["open", "matched", "volunteer_not_found"].includes(step.key))
    : sos.status === "cancelled"
      ? STATUS_STEPS.filter((step) => ["open", "matched", "cancelled"].includes(step.key))
      : STATUS_STEPS.filter((step) => !["volunteer_not_found", "cancelled"].includes(step.key));
  const stepIndex = steps.findIndex((s) => s.key === sos.status);

  return (
    <div className="bg-white rounded-3xl shadow-card p-6 animate-float-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="pulse-rings text-danger-500">
            <span className="block w-2.5 h-2.5 rounded-full bg-danger-500" />
          </span>
          <span className="font-display font-semibold text-sm">Your SOS is active</span>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sev.bg} ${sev.text}`}>
          {sev.label}
        </span>
      </div>

      <p className="text-sm text-ink/70 mb-4 line-clamp-2">{sos.description}</p>

      <MapPreview lat={sos.lat} lng={sos.lng} />

      <div className="flex items-center gap-2 mt-4 text-xs text-ink/40">
        <Clock3 size={12} />
        Step {stepIndex + 1} of {steps.length} — {steps[stepIndex]?.label}
      </div>

      <button
        onClick={() => router.push(`/dashboard/sos/${sos._id}`)}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-ink text-white font-medium text-sm py-3 rounded-2xl hover:bg-ink/90 active:scale-[0.98] transition"
      >
        Track live status
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
