import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { registerAuthRoutes } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { initSentry } from "./sentry";
import { isRedisConfigured, setPlayerOnline, getOnlinePlayerCount } from "./redis";
import { isCloudinaryConfigured } from "./cloudinary";
import { isFreesoundConfigured } from "./freesound";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

initSentry(app);

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
  try {
    // Check for OPENAI_API_KEY in production
    if (process.env.NODE_ENV === 'production' && !process.env.OPENAI_API_KEY) {
      console.warn('WARNING: OPENAI_API_KEY is not set. Card analysis and CPU functionality will not work.');
    }

    registerAuthRoutes(app);

    app.get('/api/sentry-dsn', (_req, res) => {
      res.json({ dsn: process.env.SENTRY_DSN || null });
    });

    app.get('/api/posthog-key', (_req, res) => {
      res.json({ key: process.env.POSTHOG_API_KEY || null });
    });

    app.get('/api/integrations-status', async (_req, res) => {
      res.json({
        cloudinary: isCloudinaryConfigured(),
        sentry: !!process.env.SENTRY_DSN,
        redis: isRedisConfigured(),
        posthog: !!process.env.POSTHOG_API_KEY,
        freesound: isFreesoundConfigured(),
        onlinePlayers: isRedisConfigured() ? await getOnlinePlayerCount() : null,
      });
    });

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/sw.js') {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      else if (req.path.endsWith('.html') || req.path === '/' || !req.path.includes('.')) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
      next();
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Use PORT environment variable for Autoscale deployments, fallback to 5000 for development
    const port = parseInt(process.env.PORT || "5000", 10);
    const host = "0.0.0.0";
    
    server.listen({
      port,
      host,
      reusePort: true,
    }, () => {
      log(`serving on ${host}:${port}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();
