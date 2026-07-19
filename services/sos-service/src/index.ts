import "dotenv/config";

import cors from "cors";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import { producer } from "./kafka";
import { authMiddleware } from "./middleware/auth";
import Sos, { SosSeverity } from "./models/sos.model";

const mongoUrl = process.env.MONGO_URL;
const port = Number(process.env.PORT ?? 4001);

if (!mongoUrl || !process.env.JWT_SECRET) {
  throw new Error("MONGO_URL and JWT_SECRET must be configured");
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

async function publish(topic: string, sos: unknown): Promise<void> {
  await producer.send({ messages: [{ value: JSON.stringify(sos) }], topic });
}

app.post("/sos", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { lat, lng, description } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number" || !description) {
      return res.status(400).json({ error: "lat, lng, and description are required" });
    }

    const sos = await Sos.create({ victimId: req.userId!, lat, lng, description });
    await publish("sos.created", sos.toJSON());
    return res.status(201).json({ sosId: sos.id, status: "sent" });
  } catch (error) {
    console.error("Unable to create SOS", error);
    return res.status(500).json({ error: "Unable to create SOS" });
  }
});

app.get("/sos/:id", async (req: Request, res: Response) => {
  try {
    const sos = await Sos.findById(req.params.id);
    if (!sos) return res.status(404).json({ error: "SOS not found" });
    return res.json(sos);
  } catch {
    return res.status(400).json({ error: "Invalid SOS id" });
  }
});

// Called by matching-service once it has selected the nearby volunteers. Keeping
// this transition in the SOS service makes the status visible to API clients and
// ensures only one matcher can move an open SOS into the matchable state.
app.patch("/sos/:id/match", async (req: Request, res: Response) => {
  try {
    const { matchedVolunteers } = req.body;
    if (!Array.isArray(matchedVolunteers) || !matchedVolunteers.every((id) => typeof id === "string")) {
      return res.status(400).json({ error: "matchedVolunteers must be an array of volunteer ids" });
    }

    const sos = await Sos.findOneAndUpdate(
      { _id: req.params.id, status: "open" },
      { status: "matched", matchedVolunteers },
      { new: true }
    );
    if (!sos) return res.status(409).json({ error: "SOS is no longer open for matching" });
    return res.json(sos);
  } catch {
    return res.status(400).json({ error: "Invalid SOS id" });
  }
});

// Matching-service calls this after its one-minute acceptance window expires.
// The status predicate makes this safe if a volunteer accepts at the same time.
app.patch("/sos/:id/volunteer-not-found", async (req: Request, res: Response) => {
  try {
    const sos = await Sos.findOneAndUpdate(
      { _id: req.params.id, status: "matched" },
      { status: "volunteer_not_found" },
      { new: true }
    );
    if (!sos) return res.status(409).json({ error: "SOS has already been accepted or closed" });
    return res.json(sos);
  } catch {
    return res.status(400).json({ error: "Invalid SOS id" });
  }
});

app.post("/sos/:id/accept", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sos = await Sos.findOneAndUpdate(
      // The SOS card is sent only to selected volunteers. Checking the Redis
      // member id again can reject a valid card recipient when ids are
      // serialized differently; this status transition still allows exactly
      // one volunteer to accept.
      { _id: req.params.id, status: "matched" },
      { status: "accepted", acceptedBy: req.userId! },
      { new: true }
    );
    if (!sos) {
      return res.status(409).json({ error: "SOS already accepted or not in a matchable state" });
    }

    await publish("sos.accepted", sos.toJSON());
    return res.json({ status: "accepted", sos });
  } catch {
    return res.status(409).json({ error: "SOS already accepted or not in a matchable state" });
  }
});

app.post("/sos/:id/resolve", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sos = await Sos.findOneAndUpdate(
      { _id: req.params.id, status: "accepted", acceptedBy: req.userId! },
      { status: "resolved" },
      { new: true }
    );
    if (!sos) return res.status(409).json({ error: "Only the assigned volunteer can resolve this SOS" });

    await publish("sos.resolved", sos.toJSON());
    return res.json({ status: "resolved", sos });
  } catch {
    return res.status(409).json({ error: "Only the assigned volunteer can resolve this SOS" });
  }
});

app.post("/sos/:id/cancel", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sos = await Sos.findOneAndUpdate(
      {
        _id: req.params.id,
        victimId: req.userId!,
        status: { $in: ["open", "matched", "volunteer_not_found"] }
      },
      { status: "cancelled" },
      { new: true }
    );
    if (!sos) return res.status(409).json({ error: "Only an unaccepted SOS created by you can be cancelled" });

    await publish("sos.cancelled", sos.toJSON());
    return res.json({ status: "cancelled", sos });
  } catch {
    return res.status(400).json({ error: "Invalid SOS id" });
  }
});

app.patch("/sos/:id/severity", async (req: Request, res: Response) => {
  try {
    const { severity, category } = req.body;
    const allowedSeverities: SosSeverity[] = ["pending", "high", "medium", "low"];
    if (!allowedSeverities.includes(severity) || typeof category !== "string") {
      return res.status(400).json({ error: "severity and category are required" });
    }

    const sos = await Sos.findByIdAndUpdate(req.params.id, { severity, category }, { new: true, runValidators: true });
    if (!sos) return res.status(404).json({ error: "SOS not found" });
    return res.json(sos);
  } catch {
    return res.status(400).json({ error: "Invalid SOS id" });
  }
});

async function start(): Promise<void> {
  await mongoose.connect(mongoUrl!);
  await producer.connect().then(() => console.log("Kafka producer connected")).catch((error) => {
    console.error("Failed to connect Kafka producer", error);
    process.exit(1);
  });
  app.listen(port, () => console.log(`SOS service listening on port ${port}`));
}

start().catch((error: unknown) => {
  console.error("Failed to start SOS service", error);
  process.exit(1);
});
