import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.fieldnote.app",
  appName: "Fieldnote",
  webDir: "dist",
  android: { allowMixedContent: false },
  server: { androidScheme: "https" },
};

export default config;
