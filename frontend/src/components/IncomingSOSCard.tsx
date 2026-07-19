"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Tag, UserRound, Phone } from "lucide-react";
import { toast } from "sonner";
import { sosApi, userApi, extractErrorMessage } from "@/lib/api";
import { SosRecord, SEVERITY_STYLES } from "@/lib/types";
import MapPreview from "./MapPreview";

export default function IncomingSOSCard({
  sos,
  onAccepted,
}: {
  sos: SosRecord;
  onAccepted: (sosId: string) => void;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [victim, setVictim] = useState<{ name: string; phone: string | null } | null>(null);
  const sev = SEVERITY_STYLES[sos.severity] ?? SEVERITY_STYLES.pending;

  useEffect(() => {
    let cancelled = false;
    userApi
      .get(`/users/${sos.victimId}`)
      .then(({ data }) => {
        if (!cancelled && typeof data.name === "string") {
          setVictim({ name: data.name, phone: typeof data.phone === "string" ? data.phone : null });
        }
      })
      .catch(() => {
        if (!cancelled) setVictim(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sos.victimId]);

  const accept = async () => {
    setAccepting(true);
    try {
      await sosApi.post(`/sos/${sos._id}/accept`, {});
      toast.success("Accept kar liya — victim ko notify kar diya gaya.");
      onAccepted(sos._id);
      router.push(`/dashboard/sos/${sos._id}`);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Ye SOS accept ho chuka hai."));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-card p-5 animate-float-in">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sev.bg} ${sev.text}`}>
          {sev.label} severity
        </span>
        <span className="flex items-center gap-1 text-xs text-ink/40 capitalize">
          <Tag size={11} />
          {sos.category}
        </span>
      </div>

      <p className="text-sm text-ink/80 mb-3">{sos.description}</p>

      <div className="mb-3 rounded-xl bg-ink/[0.03] px-3 py-2 text-sm text-ink/65">
        <div className="flex items-center gap-2">
          <UserRound size={15} className="text-signal-600" />
          <span>Victim: {victim?.name ?? "Loading…"}</span>
        </div>
        {victim?.phone && (
          <a href={`tel:${victim.phone}`} className="mt-1.5 flex w-fit items-center gap-2 text-signal-700 hover:text-signal-800">
            <Phone size={14} />
            {victim.phone}
          </a>
        )}
      </div>

      <MapPreview lat={sos.lat} lng={sos.lng} />

      <button
        onClick={accept}
        disabled={accepting}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-safe-500 text-white font-medium text-sm py-3 rounded-2xl hover:bg-safe-600 active:scale-[0.98] transition disabled:opacity-60"
      >
        {accepting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {accepting ? "Accepting…" : "Accept & respond"}
      </button>
    </div>
  );
}
