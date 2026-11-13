import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the browser/PWA build. The Android app bundles its files, so skip it there.
if ("serviceWorker" in navigator && import.meta.env.PROD && !(window as unknown as { Capacitor?: unknown }).Capacitor) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
