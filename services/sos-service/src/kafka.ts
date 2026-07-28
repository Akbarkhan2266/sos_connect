import { Kafka } from "kafkajs";

const brokers = (process.env.KAFKA_BROKERS ?? "kafka:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

export const kafka = new Kafka({
  clientId: "sos-service",
  brokers
});

export const producer = kafka.producer();
