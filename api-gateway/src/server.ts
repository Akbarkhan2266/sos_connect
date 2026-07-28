import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4005);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3001";

const services = {
  user: process.env.USER_SERVICE_URL ?? "http://user-service:4000",
  sos: process.env.SOS_SERVICE_URL ?? "http://sos-service:4001",
  notification: process.env.NOTIFICATION_SERVICE_URL ?? "http://notification-service:4003",
};

app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

function handleProxyError(res: any, errorMessage: string) {
  if (!res) return;

  if (typeof res.status === "function") {
    if (!res.headersSent) {
      res.status(502).json({ error: errorMessage });
    }
  } else if (typeof res.writeHead === "function") {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: errorMessage }));
    }
  } else if (typeof res.destroy === "function") {
    res.destroy();
  }
}

function serviceProxy(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // `/api/auth/*`, `/api/users/*`, and `/api/sos/*` become the native
    // service routes (`/auth/*`, `/users/*`, and `/sos/*`).
    pathRewrite: { "^/api": "" },
    logLevel: "warn",
    onError(error, _req, res: any) {
      console.error(`Proxy error for ${target}:`, error.message);
      handleProxyError(res, "Service unavailable");
    },
  });
}

// The browser talks only to these gateway paths. Individual backend services
// remain private when the stack is deployed.
app.use("/api/users", serviceProxy(services.user));
app.use("/api/auth", serviceProxy(services.user));
app.use("/api/sos", serviceProxy(services.sos));
app.use("/api/notifications", serviceProxy(services.notification));
// Socket.IO uses an HTTP handshake followed by a WebSocket upgrade. Preserve
// its `/socket.io` path while proxying both transports to notification-service.
const socketProxy = createProxyMiddleware({
  target: services.notification,
  changeOrigin: true,
  ws: true,
  logLevel: "warn",
  onError(error, req: any, res: any) {
    if (req) req.proxyTarget = services.notification;
    console.error(`Socket proxy error for ${services.notification}:`, error.message);
    handleProxyError(res, "Notification service unavailable");
  },
});

app.use("/socket.io", socketProxy);

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`API gateway listening on http://0.0.0.0:${port}`);
  console.log(`/api/auth, /api/users -> ${services.user}`);
  console.log(`/api/sos -> ${services.sos}`);
  console.log(`/socket.io -> ${services.notification}`);
});

server.on("upgrade", (req: any, socket, head) => {
  if (req.url?.startsWith("/socket.io")) {
    req.proxyTarget = services.notification;
    (socketProxy as any).upgrade(req, socket, head);
  }
});
