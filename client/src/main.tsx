import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSentry, captureError } from "./lib/sentry";
import { initPostHog } from "./lib/posthog";

initSentry();
initPostHog();

window.onerror = function(message, source, lineno, colno, error) {
  console.error('[GLOBAL ERROR]', message, source, lineno, colno, error);
  if (error) captureError(error, { source, lineno, colno });
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error('[UNHANDLED REJECTION]', event.reason);
  if (event.reason instanceof Error) {
    captureError(event.reason, { type: 'unhandledrejection' });
  }
});

createRoot(document.getElementById("root")!).render(<App />);
