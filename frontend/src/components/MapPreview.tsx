"use client";

import { MapPin, ExternalLink } from "lucide-react";

export default function MapPreview({ lat, lng }: { lat: number; lng: number }) {
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-[repeating-linear-gradient(135deg,rgba(14,124,134,0.04)_0px,rgba(14,124,134,0.04)_2px,transparent_2px,transparent_10px)] px-4 py-3 hover:border-signal-500/40 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-signal-50 text-signal-600 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-ink/40 font-medium">Location</p>
          <p className="font-mono text-sm text-ink/80 truncate">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </p>
        </div>
      </div>
      <ExternalLink
        size={14}
        className="text-ink/30 group-hover:text-signal-600 transition-colors shrink-0"
      />
    </a>
  );
}
