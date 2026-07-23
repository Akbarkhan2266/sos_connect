import "dotenv/config";

import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import mongoose from "mongoose";

import authRoutes from "./route/auth.routes";
import userRoutes from "./route/user.routes";

const mongoUrl = process.env.MONGO_URL;
const port = Number(process.env.PORT ?? 4000);

if (!mongoUrl || !process.env.JWT_SECRET) {
  throw new Error("MONGO_URL and JWT_SECRET must be configured");
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.get("/users/health", (_req, res) => res.json({ status: "ok" }));
async function start(): Promise<void> {
  await mongoose.connect(mongoUrl!);
  app.listen(port, () => console.log(`User service listening on port ${port}`));
}


start().catch((error: unknown) => {
  console.error("Failed to start user service", error);
  process.exit(1);
});
