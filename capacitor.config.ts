import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.medya.app",
  appName: "BeyTool",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
