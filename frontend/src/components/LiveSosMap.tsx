"use client";

import { useCallback, useEffect, useRef } from "react";

type Coordinates = { lat: number; lng: number };
type Leaflet = typeof import("leaflet");

export default function LiveSosMap({ victim, volunteer }: { victim: Coordinates; volunteer: Coordinates }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const victimMarkerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const volunteerMarkerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const routeRef = useRef<import("leaflet").Polyline | null>(null);
  const fittedInitiallyRef = useRef(false);

  const updateLayers = useCallback((fitToParticipants = false) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !victimMarkerRef.current || !volunteerMarkerRef.current || !routeRef.current) return;

    const victimPoint: [number, number] = [victim.lat, victim.lng];
    const volunteerPoint: [number, number] = [volunteer.lat, volunteer.lng];
    const samePoint = haversineKm(victim, volunteer) < 0.02;

    victimMarkerRef.current.setLatLng(victimPoint).setRadius(samePoint ? 16 : 11);
    volunteerMarkerRef.current.setLatLng(volunteerPoint).setRadius(samePoint ? 9 : 11);
    routeRef.current.setLatLngs([victimPoint, volunteerPoint]);

    // Fit only on first load (or when the user explicitly recentres). During
    // pan/zoom, Leaflet keeps all layers geographically anchored to the map.
    if (fitToParticipants) {
      const bounds = L.latLngBounds([victimPoint, volunteerPoint]).pad(0.3);
      map.fitBounds(bounds, { maxZoom: 16, padding: [24, 24] });
    }
  }, [victim, volunteer]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    void import("leaflet").then((L) => {
      if (disposed || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      victimMarkerRef.current = L.circleMarker([victim.lat, victim.lng], {
        radius: 11,
        color: "#ffffff",
        weight: 3,
        fillColor: "#ef4444",
        fillOpacity: 1,
      }).addTo(map).bindTooltip("Victim", { permanent: true, direction: "top", offset: [0, -12] });
      volunteerMarkerRef.current = L.circleMarker([volunteer.lat, volunteer.lng], {
        radius: 11,
        color: "#ffffff",
        weight: 3,
        fillColor: "#10b981",
        fillOpacity: 1,
      }).addTo(map).bindTooltip("Volunteer", { permanent: true, direction: "bottom", offset: [0, 12] });
      routeRef.current = L.polyline([[victim.lat, victim.lng], [volunteer.lat, volunteer.lng]], {
        color: "#2563eb",
        weight: 4,
        opacity: 0.9,
        dashArray: "8 8",
      }).addTo(map);

      fittedInitiallyRef.current = true;
      map.fitBounds(L.latLngBounds([[victim.lat, victim.lng], [volunteer.lat, volunteer.lng]]).pad(0.3), {
        maxZoom: 16,
        padding: [24, 24],
      });
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      victimMarkerRef.current = null;
      volunteerMarkerRef.current = null;
      routeRef.current = null;
      fittedInitiallyRef.current = false;
    };
    // The map instance is intentionally created only once. Coordinate changes
    // are handled by the layer-update effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateLayers(!fittedInitiallyRef.current);
  }, [updateLayers]);

  const distanceKm = haversineKm(victim, volunteer);
  const etaMinutes = Math.max(1, Math.ceil((distanceKm / 30) * 60));

  return (
    <section className="overflow-hidden rounded-2xl border border-ink/10 bg-signal-50">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Live response map</p>
          <p className="text-xs text-ink/50">Blue line shows the live route between victim and volunteer</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-1.5 text-right shadow-card">
          <p className="text-xs font-semibold text-signal-700">~{etaMinutes} min away</p>
          <p className="text-[11px] text-ink/45">{distanceKm.toFixed(1)} km</p>
        </div>
      </div>

      <div ref={containerRef} className="h-72 w-full bg-[#dce9d7]" aria-label="Live map of victim and volunteer" />

      <div className="grid grid-cols-2 gap-px bg-ink/10 text-xs">
        <div className="flex items-center gap-2 bg-white px-4 py-3 text-danger-700">
          <span className="h-2.5 w-2.5 rounded-full bg-danger-500" /> Victim live location
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-3 text-safe-700">
          <span className="h-2.5 w-2.5 rounded-full bg-safe-500" /> Volunteer live location
        </div>
      </div>
    </section>
  );
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
