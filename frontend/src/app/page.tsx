"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Radio } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

export default function RootPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [hydrated, user, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-paper">
      <div className="pulse-rings text-danger-500">
        <div className="w-14 h-14 rounded-full bg-danger-500 flex items-center justify-center text-white shadow-glow">
          <Radio size={26} />
        </div>
      </div>
      <p className="font-display text-sm tracking-wide text-ink/50">
        connecting to SOS Connect…
      </p>
    </div>
  );
}
