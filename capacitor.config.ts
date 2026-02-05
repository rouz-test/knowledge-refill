import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rouz.knowledgerefill',
  appName: 'knowledge-refill',
  webDir: 'public',

  // ✅ Load the web app from a remote URL (e.g., Vercel) instead of bundling web assets
  server: {
    url: 'https://knowledge-refill.vercel.app',
    cleartext: false,
  },

  // Optional Android settings
  android: {
    // @ts-expect-error: supported by runtime, missing in type defs
    adjustMarginsForEdgeToEdge: 'force',
    allowMixedContent: false,
  },
};

export default config;
