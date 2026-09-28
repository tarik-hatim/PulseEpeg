/**
 * Configuration Capacitor pour l'export APK Android
 * Commandes de build :
 * 1. npm run build
 * 2. npx cap add android
 * 3. npx cap sync android
 * 4. npx cap open android
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
  plugins?: {
    CapacitorHttp?: {
      enabled: boolean;
    };
  };
}

const config: CapacitorConfig = {
  appId: 'com.pulseepg.tvguide',
  appName: 'PulseEPG TV Guide',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    // Active les requêtes HTTP natives sur Android pour contourner le CORS sur les fichiers .xml.gz distants
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
