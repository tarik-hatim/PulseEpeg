/**
 * Configuration Capacitor officielle pour Google Play Store (.AAB & .APK Ready)
 * Package ID : com.pulseepg.tvguide
 * Commandes de build Play Store :
 * 1. npm run build
 * 2. npx cap sync android
 * 3. cd android && ./gradlew bundleRelease
 */
export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
  };
  android?: {
    buildOptions?: {
      releaseType?: 'AAB' | 'APK';
    };
  };
  plugins?: {
    CapacitorHttp?: {
      enabled: boolean;
    };
  };
}

const config: CapacitorConfig = {
  appId: "com.pulseepg.tvguide",
  appName: "PulseEPG",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  android: {
    buildOptions: {
      releaseType: "AAB",
    },
  },
  plugins: {
    // Active les requêtes HTTP natives sur Android pour contourner le CORS sur les fichiers .xml.gz distants
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
