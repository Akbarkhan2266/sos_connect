# SOS Connect

Microservices-based emergency response coordinator.

| Service | Port |
| --- | --- |
| user-service | 4000 |
| sos-service | 4001 |
| matching-service | No HTTP port (Kafka consumer) |
| notification-service | 4003 |
| severity-service | No HTTP port (Kafka consumer) |

## Start infrastructure

```bash
docker compose up -d
```

Redis is hosted on Redis Cloud — see `services/matching-service/.env.example` for the required connection settings.

## Kafka topics

Create the project topics with:

```bash
cd services/kafka-admin
npm install
npm run topics
```
