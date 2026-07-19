"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket } from "@/lib/socket";

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  // Rehydrate auth from localStorage the moment the app loads client-side.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Connect the socket automatically the moment we know who's logged in —
  // no button, no manual step. Runs once per authenticated session and
  // reconnects on its own if dropped.
  useEffect(() => {
    if (hydrated && user) {
      getSocket();
    }
  }, [hydrated, user]);

  return (
    <>
      {children}
      <Toaster position="top-center" richColors toastOptions={{ className: "font-body text-sm" }} />
    </>
  );
}
