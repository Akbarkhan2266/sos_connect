"use client";

import { useRouter } from "next/navigation";
import { Radio, LogOut, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { disconnectSocket } from "@/lib/socket";
import { userApi } from "@/lib/api";
import ConnectionStatus from "./ConnectionStatus";

export default function Navbar({ isAvailable }: { isAvailable?: boolean }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    try {
      await userApi.post("/auth/logout");
    } catch {
      // Clear local UI state even if the backend is temporarily unavailable.
    }
    disconnectSocket();
    logout();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-paper/85 border-b border-ink/5">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-danger-500 flex items-center justify-center text-white">
            <Radio size={16} />
          </div>
          <span className="font-display font-semibold text-[15px] tracking-tight">
            SOS Connect
          </span>
        </div>

        <div className="flex items-center gap-4">
          <ConnectionStatus />

          {isAvailable !== undefined && (
            <span
              className={`hidden sm:flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                isAvailable
                  ? "bg-safe-50 text-safe-700"
                  : "bg-ink/5 text-ink/40"
              }`}
            >
              <ShieldCheck size={12} />
              {isAvailable ? "On duty" : "Off duty"}
            </span>
          )}

          {user && (
            <span className="hidden sm:block text-sm font-medium text-ink/70">
              {user.name}
            </span>
          )}

          <button
            onClick={handleLogout}
            aria-label="Log out"
            className="w-9 h-9 rounded-full flex items-center justify-center text-ink/50 hover:text-danger-600 hover:bg-danger-50 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
