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

  // Plugin settings
  plugins: {
    LocalNotifications: {
      // Android status bar (small) notification icon (res/drawable/ic_stat_refill.*)
      smallIcon: 'ic_stat_refill',
      // Optional: tint color for the small icon (Android only)
      // iconColor: '#2DD4BF',
    },
  },
};

export default config;
