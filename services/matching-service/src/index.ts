import dotenv from "dotenv";
import { Kafka } from "kafkajs";

import redis, { connectRedis } from "./redis";

dotenv.config();

interface SosEvent {
  _id: string;
  lat: number;
  lng: number;
  acceptedBy?: string;
  [key: string]: unknown;
}

interface LocationEvent {
  volunteerId: string;
  lat: number;
  lng: number;
}

interface AvailabilityEvent {
  volunteerId: string;
  isAvailable: boolean;
}

const brokers = (process.env.KAFKA_BROKERS ?? "kafka:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafka = new Kafka({ clientId: "matching-service", brokers });
const producer = kafka.producer();
const matchingConsumer = kafka.consumer({ groupId: "matching-group" });
const locationConsumer = kafka.consumer({ groupId: "matching-location-group" });
const sosServiceUrl = process.env.SOS_SERVICE_URL ?? "http://sos-service:4001";
const volunteerAcceptanceTimeoutMs = 5 * 60_000;

function parseEvent<T>(value: Buffer | null): T {
  if (!value) throw new Error("Kafka event payload is empty");
  return JSON.parse(value.toString()) as T;
}

function scheduleVolunteerSearchExpiry(sosId: string): void {
  setTimeout(async () => {
    try {
      await redis.zRem("active:sos:geo", sosId);
      const response = await fetch(`${sosServiceUrl}/sos/${sosId}/volunteer-not-found`, {
        method: "PATCH"
      });

      // A 409 means someone accepted or resolved the SOS during the window,
      // which is the expected outcome and must not notify the requester.
      if (response.status === 409) return;
      if (!response.ok) {
        throw new Error(`SOS volunteer timeout update failed (${response.status}): ${await response.text()}`);
      }

      const sos = await response.json() as SosEvent;
      await producer.send({
        topic: "sos.volunteer-not-found",
        messages: [{ value: JSON.stringify(sos) }]
      });
      console.log(`SOS ${sosId} had no volunteer acceptance after five minutes`);
    } catch (error) {
      console.error(`Unable to expire volunteer search for SOS ${sosId}`, error);
    }
  }, volunteerAcceptanceTimeoutMs);
}

async function checkAndMatchActiveSosForVolunteer(volunteerId: string, lat: number, lng: number): Promise<void> {
  try {
    const nearbySosIds = await redis.geoSearch(
      "active:sos:geo",
      { longitude: lng, latitude: lat },
      { radius: 5, unit: "km" }
    );

    for (const sosId of nearbySosIds) {
      const response = await fetch(`${sosServiceUrl}/sos/${sosId}/match`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedVolunteers: [volunteerId] })
      });
      if (response.ok) {
        const matchedSos = (await response.json()) as SosEvent;
        await producer.send({
          topic: "sos.matched",
          messages: [{ value: JSON.stringify(matchedSos) }]
        });
        console.log(`Dynamically matched volunteer ${volunteerId} to active SOS ${sosId}`);
      }
    }
  } catch (error) {
    console.error(`Error dynamically matching active SOS for volunteer ${volunteerId}`, error);
  }
}

async function handleSosEvent(topic: string, value: Buffer | null): Promise<void> {
  const data = parseEvent<SosEvent>(value);

  if (topic === "sos.created") {
    if (typeof data.lat !== "number" || typeof data.lng !== "number") {
      throw new Error("SOS event is missing coordinates");
    }

    await redis.geoAdd("active:sos:geo", {
      longitude: data.lng,
      latitude: data.lat,
      member: data._id
    });

    const nearby = await redis.geoSearch(
      "volunteers:geo",
      { longitude: data.lng, latitude: data.lat },
      { radius: 5, unit: "km" },
      { SORT: "ASC", COUNT: 5 }
    );
    console.log(`SOS ${data._id} — nearby volunteers:`, nearby);

    // Persist the matched state before notifying anyone. This is what lets a
    // selected volunteer accept the SOS and lets the requester retrieve the
    // current status after a reconnect.
    const response = await fetch(`${sosServiceUrl}/sos/${data._id}/match`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchedVolunteers: nearby })
    });
    // Kafka delivery is at-least-once. A previous attempt may already have
    // matched, accepted, cancelled, or timed out this SOS. That is a normal
    // duplicate event, not a retryable matching failure.
    if (response.status === 409) {
      console.log(`SOS ${data._id} is already past the open matching state; skipping duplicate event`);
      return;
    }
    if (!response.ok) {
      throw new Error(`SOS service match update failed (${response.status}): ${await response.text()}`);
    }
    const matchedSos = await response.json() as SosEvent;

    await producer.send({
      topic: "sos.matched",
      messages: [{ value: JSON.stringify(matchedSos) }]
    });
    scheduleVolunteerSearchExpiry(data._id);
    return;
  }

  if (topic === "sos.accepted") {
    if (!data.acceptedBy) throw new Error("Accepted SOS event is missing acceptedBy");
    await redis.zRem("active:sos:geo", data._id);
    await redis.zRem("volunteers:geo", data.acceptedBy);
    console.log(`Volunteer ${data.acceptedBy} removed from available index and SOS ${data._id} removed from active index`);
    return;
  }

  if (topic === "sos.resolved") {
    await redis.zRem("active:sos:geo", data._id);
    console.log(`SOS ${data._id} resolved`);
  }

  if (topic === "sos.cancelled") {
    await redis.zRem("active:sos:geo", data._id);
    console.log(`SOS ${data._id} cancelled`);
  }
}

async function start(): Promise<void> {
  await connectRedis();
  await producer.connect();
  await matchingConsumer.connect();
  await locationConsumer.connect();

  await matchingConsumer.subscribe({ topics: ["sos.created", "sos.accepted", "sos.resolved", "sos.cancelled"], fromBeginning: false });
  await locationConsumer.subscribe({ topics: ["volunteer.location.updated", "volunteer.availability.updated"], fromBeginning: false });

  await matchingConsumer.run({
    eachMessage: async ({ topic, message }) => handleSosEvent(topic, message.value)
  });
  await locationConsumer.run({
    eachMessage: async ({ topic, message }) => {
      if (topic === "volunteer.availability.updated") {
        const data = parseEvent<AvailabilityEvent>(message.value);
        if (typeof data.volunteerId !== "string" || typeof data.isAvailable !== "boolean") {
          throw new Error("Availability event is invalid");
        }
        if (!data.isAvailable) {
          await redis.zRem("volunteers:geo", data.volunteerId);
        } else {
          const pos = await redis.geoPos("volunteers:geo", data.volunteerId);
          const coord = pos?.[0];
          if (coord && typeof coord.latitude === "number" && typeof coord.longitude === "number") {
            await checkAndMatchActiveSosForVolunteer(data.volunteerId, coord.latitude, coord.longitude);
          }
        }
        return;
      }

      const data = parseEvent<LocationEvent>(message.value);
      if (typeof data.volunteerId !== "string" || typeof data.lat !== "number" || typeof data.lng !== "number") {
        throw new Error("Location event is invalid");
      }
      await redis.geoAdd("volunteers:geo", {
        longitude: data.lng,
        latitude: data.lat,
        member: data.volunteerId
      });

      await checkAndMatchActiveSosForVolunteer(data.volunteerId, data.lat, data.lng);

      console.log(`Volunteer ${data.volunteerId} location updated`);
    }
  });

  console.log("Matching service is running");
}

start().catch((error: unknown) => {
  console.error("Failed to start matching service", error);
  // redis.flushDb().then(() => redis.quit()).catch((err) => console.error("Error during Redis cleanup:", err))
  process.exit(1);

});
