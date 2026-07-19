import { Producer } from "kafkajs";
import { Server, Socket } from "socket.io";

interface VolunteerLocationUpdate {
  volunteerId: string;
  lat: number;
  lng: number;
}

interface SosLocationUpdate {
  sosId: string;
  role: "victim" | "volunteer";
  lat: number;
  lng: number;
}

const latestSosLocations = new Map<string, Partial<Record<SosLocationUpdate["role"], SosLocationUpdate>>>();
const pendingSosByVolunteer = new Map<string, Map<string, unknown>>();

export function savePendingSos(volunteerId: string, sos: unknown): void {
  const sosId = (sos as { _id?: unknown })._id;
  if (typeof sosId !== "string") return;
  const pending = pendingSosByVolunteer.get(volunteerId) ?? new Map<string, unknown>();
  pending.set(sosId, sos);
  pendingSosByVolunteer.set(volunteerId, pending);
}

export function removePendingSos(sosId: string): void {
  for (const [volunteerId, pending] of pendingSosByVolunteer) {
    pending.delete(sosId);
    if (pending.size === 0) pendingSosByVolunteer.delete(volunteerId);
  }
}

function isLocationUpdate(payload: unknown): payload is VolunteerLocationUpdate {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return typeof value.volunteerId === "string" && typeof value.lat === "number" && typeof value.lng === "number";
}

function isSosLocationUpdate(payload: unknown): payload is SosLocationUpdate {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return typeof value.sosId === "string" && (value.role === "victim" || value.role === "volunteer")
    && typeof value.lat === "number" && typeof value.lng === "number";
}

export function registerSocketHandlers(io: Server, socket: Socket, producer: Producer): void {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("register-volunteer", (volunteerId: unknown) => {
    if (typeof volunteerId !== "string" || !volunteerId) return;
    socket.join(`volunteer-${volunteerId}`);
    for (const sos of pendingSosByVolunteer.get(volunteerId)?.values() ?? []) {
      socket.emit("new-sos", sos);
    }
    console.log(`Socket ${socket.id} joined volunteer-${volunteerId}`);
  });

  socket.on("join-sos-room", (sosId: unknown) => {
    if (typeof sosId !== "string" || !sosId) return;
    socket.join(`sos-${sosId}`);
    for (const location of Object.values(latestSosLocations.get(sosId) ?? {})) {
      socket.emit("sos-location", location);
    }
    console.log(`Socket ${socket.id} joined sos-${sosId}`);
  });

  socket.on("volunteer-location-update", async (payload: unknown) => {
    if (!isLocationUpdate(payload)) {
      socket.emit("error", { error: "Invalid volunteer location update" });
      return;
    }

    try {
      await producer.send({
        topic: "volunteer.location.updated",
        messages: [{ value: JSON.stringify(payload) }]
      });
    } catch (error) {
      console.error("Unable to publish volunteer location update", error);
      socket.emit("error", { error: "Unable to publish volunteer location update" });
    }
  });

  socket.on("volunteer-availability-change", async (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const value = payload as Record<string, unknown>;
    if (typeof value.volunteerId !== "string" || typeof value.isAvailable !== "boolean") return;
    await producer.send({
      topic: "volunteer.availability.updated",
      messages: [{ value: JSON.stringify(value) }]
    });
  });

  // Both the victim and the accepted volunteer join this room. Location is
  // deliberately sent only to the other participant, never broadcast globally.
  socket.on("sos-location-update", (payload: unknown) => {
    if (!isSosLocationUpdate(payload)) return;
    const locations = latestSosLocations.get(payload.sosId) ?? {};
    locations[payload.role] = payload;
    latestSosLocations.set(payload.sosId, locations);
    socket.to(`sos-${payload.sosId}`).emit("sos-location", payload);
  });

  socket.on("disconnect", () => console.log(`Socket disconnected: ${socket.id}`));
}
