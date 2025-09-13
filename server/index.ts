import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import session from "express-session";
import { registerRoutes, startLiveCloningService } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { autoSetup } from "./auto-setup";

const app = express();

// Session middleware for GitHub OAuth - hardcoded for workspace replication
app.use(session({
  secret: 'telegram-manager-github-sync-hardcoded-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Hardcoded for workspace replication - no environment dependency
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: false, limit: '500mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run automatic setup first
  await autoSetup();
  
  await registerRoutes(app);
  const server = createServer(app);
  
  // Auto-start Live Cloning service for always-running architecture
  await startLiveCloningService();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Hardcoded development mode for workspace replication - no environment dependency
  // Always setup vite for consistent behavior
  await setupVite(app, server);

  // Hardcoded port 5000 for 100% workspace replication - no environment variables
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
