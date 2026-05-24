import childProcess from 'child_process';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { registerAuthRoutes } from "./auth";
import { setupVite, serveStatic, log } from "./vite";
import { initSentry } from "./sentry";
import { isRedisConfigured, setPlayerOnline, getOnlinePlayerCount } from "./redis";
import { probeAndSwitchIfNeeded } from "./db";
import pg from 'pg';
import { isCloudinaryConfigured } from "./cloudinary";
import { isFreesoundConfigured } from "./freesound";
import { logResendConfigStatus } from "./resendClient";
console.log("DEBUG: DATABASE_URL is", process.env.DATABASE_URL ? "SET" : "NOT SET");
console.log("DEBUG: EXTERNAL_DATABASE_URL is", process.env.EXTERNAL_DATABASE_URL ? "SET" : "NOT SET");

// Auto-detect production mode: if dist/public exists and NODE_ENV is not explicitly set,
// we are running from a compiled bundle in production.
const __server_dir = dirname(fileURLToPath(import.meta.url));
if (!process.env.NODE_ENV) {
  const hasBuild = fs.existsSync(path.resolve(__server_dir, 'public'));
  if (hasBuild) {
    process.env.NODE_ENV = 'production';
  }
}

// Patch child_process.spawn so all child processes run in their own process group.
// This prevents SIGHUP sent to our process group from reaching esbuild (used by Vite).
const _origSpawn = childProcess.spawn.bind(childProcess);
(childProcess as any).spawn = (cmd: string, args?: any, opts: any = {}) => {
  return _origSpawn(cmd, args, { ...opts, detached: true });
};

// Node.js installs its own SIGHUP handler on startup (overriding inherited SIG_IGN).
// We install a no-op to prevent Node.js from exiting when Replit sends SIGHUP.
process.on('SIGHUP', () => {});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason instanceof Error ? reason.message : reason);
});

const app = express();
app.use(compression());
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

    // Log Resend email configuration status so admins can spot missing config at a glance
    await logResendConfigStatus();

    // Run idempotent schema migrations on startup (safe to run every boot)
    try {
      const { Pool } = pg;
      const migPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
      const schemaMigrations = [
        `ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMP`,
        `ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS disqualification_reason TEXT`,
        `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP`,
        `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS note TEXT`,
        `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_24h BOOLEAN NOT NULL DEFAULT FALSE`,
        `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_1h BOOLEAN NOT NULL DEFAULT FALSE`,
        `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS notified_30m BOOLEAN NOT NULL DEFAULT FALSE`,
        `ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS player_ids JSONB DEFAULT '[]'`,
        `ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`,
      ];
      for (const migSql of schemaMigrations) {
        try { await migPool.query(migSql); } catch (_e) { /* already exists — ignore */ }
      }
      await migPool.end();
      console.log('✅ Startup schema migrations applied');
    } catch (migErr) {
      console.warn('⚠️ Startup schema migrations skipped:', (migErr as Error).message);
    }

    // Probe the primary DB at startup; switch to fallback before any request if quota exceeded
    await probeAndSwitchIfNeeded();

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

      // Keepalive heartbeat: emit a lightweight 'heartbeat' event every 20s to all
      // connected sockets. This prevents the production proxy from dropping idle
      // WebSocket connections (which typically have a ~5-minute idle timeout).
      setInterval(() => {
        const io = (global as any).io;
        if (io) {
          io.emit('heartbeat', { ts: Date.now() });
        }
      }, 20_000);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
})();
