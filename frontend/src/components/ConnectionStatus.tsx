"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

type Status = "live" | "reconnecting" | "offline";

const CONFIG: Record<Status, { label: string; dot: string; text: string }> = {
  live: { label: "Live", dot: "bg-safe-500", text: "text-safe-600" },
  reconnecting: { label: "Reconnecting…", dot: "bg-amber-500 animate-pulse", text: "text-amber-600" },
  offline: { label: "Offline", dot: "bg-ink/30", text: "text-ink/40" },
};

export default function ConnectionStatus() {
  const [status, setStatus] = useState<Status>("offline");

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setStatus("live");
    const onDisconnect = () => setStatus("offline");
    const onReconnectAttempt = () => setStatus("reconnecting");

    setStatus(socket.connected ? "live" : "reconnecting");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("reconnect_attempt", onReconnectAttempt);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("reconnect_attempt", onReconnectAttempt);
    };
  }, []);

  const cfg = CONFIG[status];

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </div>
  );
}
