import "dotenv/config";

import { Kafka } from "kafkajs";

import { classify } from "./classifier";

interface SosCreatedEvent {
  _id: string;
  description: string;
}

const sosServiceUrl = process.env.SOS_SERVICE_URL ?? "http://sos-service:4001";
const kafka = new Kafka({ clientId: "severity-service", brokers: ["kafka:9092"] });
const consumer = kafka.consumer({ groupId: "severity-group" });

function parseSosEvent(value: Buffer | null): SosCreatedEvent {
  if (!value) throw new Error("Kafka event payload is empty");
  const data = JSON.parse(value.toString()) as Partial<SosCreatedEvent>;
  if (typeof data._id !== "string" || typeof data.description !== "string") {
    throw new Error("Invalid sos.created payload");
  }
  return { _id: data._id, description: data.description };
}

async function processSosCreated(value: Buffer | null): Promise<void> {
  const sos = parseSosEvent(value);
  const classification = await classify(sos.description);
  console.log(`SOS ${sos._id} classified as:`, classification);

  const response = await fetch(`${sosServiceUrl}/sos/${sos._id}/severity`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(classification)
  });
  if (!response.ok) {
    throw new Error(`SOS service severity update failed (${response.status}): ${await response.text()}`);
  }
}

async function start(): Promise<void> {
  await consumer.connect();
  await consumer.subscribe({ topic: "sos.created", fromBeginning: false });
  await consumer.run({ eachMessage: async ({ message }) => processSosCreated(message.value) });
  console.log("Severity service is running");
}

start().catch((error: unknown) => {
  console.error("Failed to start severity service", error);
  process.exit(1);
});
