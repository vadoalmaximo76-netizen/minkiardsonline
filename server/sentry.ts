import * as Sentry from "@sentry/node";
import { type Express } from "express";

let sentryInitialized = false;

export function initSentry(app: Express): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn("[Sentry] SENTRY_DSN not set. Error tracking is disabled.");
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: 0.1,
    });

    Sentry.setupExpressErrorHandler(app);

    sentryInitialized = true;
    console.log("[Sentry] Initialized successfully");
  } catch (error) {
    console.error("[Sentry] Failed to initialize Sentry:", error);
  }
}

export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  if (!sentryInitialized) return;

  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info"
): void {
  if (!sentryInitialized) return;
  Sentry.captureMessage(message, level);
}
