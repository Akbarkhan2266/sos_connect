import "dotenv/config";

import { Kafka } from "kafkajs";

import { kafkaTopics } from "./topics";

const brokers = (process.env.KAFKA_BROKERS ?? "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafka = new Kafka({ clientId: "kafka-admin", brokers });
const admin = kafka.admin();

async function createTopics(): Promise<void> {
  await admin.connect();
  try {
    const created = await admin.createTopics({
      waitForLeaders: true,
      topics: kafkaTopics.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1
      }))
    });

    const metadata = await admin.fetchTopicMetadata({ topics: [...kafkaTopics] });
    console.log(created ? "Kafka topics created" : "Kafka topics already exist");
    console.log(metadata.topics.map((topic) => topic.name).sort().join("\n"));
  } finally {
    await admin.disconnect();
  }
}

createTopics().catch((error: unknown) => {
  console.error("Unable to initialize Kafka topics", error);
  process.exit(1);
});
