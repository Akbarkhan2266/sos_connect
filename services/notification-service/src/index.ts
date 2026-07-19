import "dotenv/config";

import http from "http";

import cors from "cors";
import express from "express";
import { Kafka } from "kafkajs";
import { Server } from "socket.io";

import { registerSocketHandlers, removePendingSos, savePendingSos } from "./controller/socket.controller";

interface SosEvent {
  _id: string;
  acceptedBy?: string;
  matchedVolunteers?: string[];
  [key: string]: unknown;
}

const port = Number(process.env.PORT ?? 4003);
const app = express();
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const kafka = new Kafka({ clientId: "notification-service", brokers: ["localhost:9092"] });
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "notification-group" });

function parseEvent(value: Buffer | null): SosEvent {
  if (!value) throw new Error("Kafka event payload is empty");
  return JSON.parse(value.toString()) as SosEvent;
}

function validVolunteerIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

async function relayKafkaEvent(topic: string, value: Buffer | null): Promise<void> {
  const data = parseEvent(value);

  if (topic === "sos.matched") {
    // The person who raised the SOS sees the matching status even if no
    // volunteer is currently available. Volunteers still receive the SOS only
    // when they were selected by matching-service.
    io.to(`sos-${data._id}`).emit("sos-status", data);
    for (const volunteerId of validVolunteerIds(data.matchedVolunteers)) {
      savePendingSos(volunteerId, data);
      io.to(`volunteer-${volunteerId}`).emit("new-sos", data);
    }
    return;
  }

  if (topic === "sos.accepted") {
    removePendingSos(data._id);
    io.to(`sos-${data._id}`).emit("sos-status", data);
    io.to(`sos-${data._id}`).emit("sos-accepted", {
      volunteerId: data.acceptedBy,
      message: "Volunteer aa raha hai"
    });
    for (const volunteerId of validVolunteerIds(data.matchedVolunteers)) {
      if (volunteerId !== data.acceptedBy) {
        io.to(`volunteer-${volunteerId}`).emit("sos-taken", { sosId: data._id });
      }
    }
    return;
  }

  if (topic === "sos.volunteer-not-found") {
    removePendingSos(data._id);
    io.to(`sos-${data._id}`).emit("sos-status", data);
    io.to(`sos-${data._id}`).emit("volunteer-not-found", {
      sosId: data._id,
      message: "No volunteer could accept your SOS in the last minute. We are still looking for help."
    });
    return;
  }

  if (topic === "sos.cancelled") {
    removePendingSos(data._id);
    io.to(`sos-${data._id}`).emit("sos-status", data);
    io.to(`sos-${data._id}`).emit("sos-cancelled", data);
    for (const volunteerId of validVolunteerIds(data.matchedVolunteers)) {
      io.to(`volunteer-${volunteerId}`).emit("sos-taken", { sosId: data._id });
    }
    return;
  }

  if (topic === "sos.resolved") { 
    removePendingSos(data._id);
    io.to(`sos-${data._id}`).emit("sos-status", data);
    io.to(`sos-${data._id}`).emit("sos-resolved", data);
  }
}

async function start(): Promise<void> {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({
    topics: ["sos.matched", "sos.accepted", "sos.volunteer-not-found", "sos.cancelled", "sos.resolved"],
    fromBeginning: false
  });
  await consumer.run({
    eachMessage: async ({ topic, message }) => relayKafkaEvent(topic, message.value)
  });

  io.on("connection", (socket) => registerSocketHandlers(io, socket, producer));
  server.listen(port, () => console.log(`Notification service listening on port ${port}`));
}

start().catch((error: unknown) => {
  console.error("Failed to start notification service", error);
  process.exit(1);
});
