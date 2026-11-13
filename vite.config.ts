import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base: "./"` makes the build work from any path: a static host, a sub-folder, or inside the Android app.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: { target: "es2020", sourcemap: false },
});
