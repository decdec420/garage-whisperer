import { createRoot } from "react-dom/client";
import { initSentry } from "@/lib/sentry";
import { initPosthog } from "@/lib/posthog";
import App from "./App.tsx";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  initSentry(import.meta.env.VITE_SENTRY_DSN);
}

if (import.meta.env.VITE_POSTHOG_KEY) {
  initPosthog(
    import.meta.env.VITE_POSTHOG_KEY,
    import.meta.env.VITE_POSTHOG_HOST,
  );
}

createRoot(document.getElementById("root")!).render(<App />);
