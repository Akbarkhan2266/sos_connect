"use client";

import { LifeBuoy, HeartHandshake } from "lucide-react";
import { Role } from "@/store/useAuthStore";

export default function ModeToggle({
  mode,
  onChange,
}: {
  mode: Role;
  onChange: (mode: Role) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 bg-ink/[0.04] p-1.5 rounded-2xl">
      <button
        onClick={() => onChange("victim")}
        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
          mode === "victim"
            ? "bg-danger-500 text-white shadow-glow"
            : "text-ink/50 hover:text-ink/70"
        }`}
      >
        <LifeBuoy size={15} />
        I need help
      </button>
      <button
        onClick={() => onChange("volunteer")}
        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
          mode === "volunteer"
            ? "bg-safe-500 text-white shadow-[0_0_0_6px_rgba(22,199,132,0.10)]"
            : "text-ink/50 hover:text-ink/70"
        }`}
      >
        <HeartHandshake size={15} />
        I want to help
      </button>
    </div>
  );
}
