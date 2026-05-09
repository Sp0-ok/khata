import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.khatabook",
  appName: "KhataBook",
  webDir: "dist/client",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    Keyboard: {
      resize: "none",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
