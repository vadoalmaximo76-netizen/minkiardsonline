import * as Sentry from "@sentry/react";

let sentryInitialized = false;

export async function initSentry(): Promise<void> {
  if (sentryInitialized) {
    console.warn("[Sentry Client] Already initialized");
    return;
  }

  try {
    let dsn: string | null = null;

    try {
      const response = await fetch("/api/sentry-dsn");
      if (response.ok) {
        const data = await response.json();
        dsn = data.dsn;
      } else {
        console.warn("[Sentry Client] Failed to fetch DSN from /api/sentry-dsn");
      }
    } catch (error) {
      console.warn(
        "[Sentry Client] Error fetching DSN from /api/sentry-dsn:",
        error
      );
    }

    if (!dsn) {
      console.warn(
        "[Sentry Client] DSN not available. Client-side error tracking is disabled."
      );
      return;
    }

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || "development",
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
    });

    sentryInitialized = true;
    console.log("[Sentry Client] Initialized successfully");
  } catch (error) {
    console.error("[Sentry Client] Failed to initialize Sentry:", error);
  }
}

export function captureError(
  error: Error,
  context?: Record<string, any>
): void {
  if (!sentryInitialized) {
    console.error("[Sentry Client] Not initialized. Error:", error.message);
    return;
  }

  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
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
  if (!sentryInitialized) {
    console.log(
      `[Sentry Client] Not initialized. Message (${level}):`,
      message
    );
    return;
  }

  Sentry.captureMessage(message, level);
}
