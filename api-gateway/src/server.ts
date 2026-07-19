import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4005);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

const services = {
  user: process.env.USER_SERVICE_URL ?? "http://localhost:4000",
  sos: process.env.SOS_SERVICE_URL ?? "http://localhost:4001",
  notification: process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:4003",
};

app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

function serviceProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // `/api/auth/*`, `/api/users/*`, and `/api/sos/*` become the native
    // service routes (`/auth/*`, `/users/*`, and `/sos/*`).
    pathRewrite: { "^/api": "" },
    logLevel: "warn",
    onError(error, _req, res) {
      console.error(`Proxy error for ${target}:`, error.message);
      if (!res.headersSent) res.status(502).json({ error: "Service unavailable" });
    },
  });
}

// The browser talks only to these gateway paths. Individual backend services
// remain private when the stack is deployed.
app.use("/api/auth", serviceProxy(services.user));
app.use("/api/users", serviceProxy(services.user));
app.use("/api/sos", serviceProxy(services.sos));

// Socket.IO uses an HTTP handshake followed by a WebSocket upgrade. Preserve
// its `/socket.io` path while proxying both transports to notification-service.
app.use(
  "/socket.io",
  createProxyMiddleware({
    target: services.notification,
    changeOrigin: true,
    ws: true,
    pathRewrite: (path) => (path.startsWith("/socket.io") ? path : `/socket.io${path}`),
    logLevel: "warn",
    onError(error, _req, res) {
      console.error(`Socket proxy error for ${services.notification}:`, error.message);
      if (!res.headersSent) res.status(502).json({ error: "Notification service unavailable" });
    },
  })
);

app.listen(port, "0.0.0.0", () => {
  console.log(`API gateway listening on http://0.0.0.0:${port}`);
  console.log(`/api/auth, /api/users -> ${services.user}`);
  console.log(`/api/sos -> ${services.sos}`);
  console.log(`/socket.io -> ${services.notification}`);
});
