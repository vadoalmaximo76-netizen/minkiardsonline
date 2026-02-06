import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.onerror = function(message, source, lineno, colno, error) {
  console.error('[GLOBAL ERROR]', message, source, lineno, colno, error);
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error('[UNHANDLED REJECTION]', event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
