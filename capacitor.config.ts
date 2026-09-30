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
  backgroundColor?: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
    cleartext?: boolean;
  };
  android?: {
    backgroundColor?: string;
    allowMixedContent?: boolean;
    webContentsDebuggingEnabled?: boolean;
    buildOptions?: {
      releaseType?: 'AAB' | 'APK';
    };
  };
  plugins?: {
    CapacitorHttp?: {
      enabled: boolean;
    };
    StatusBar?: {
      overlaysWebView?: boolean;
      style?: string;
      backgroundColor?: string;
    };
    SplashScreen?: {
      launchShowDuration?: number;
      launchAutoHide?: boolean;
      backgroundColor?: string;
      showSpinner?: boolean;
    };
    LocalNotifications?: {
      smallIcon?: string;
      iconColor?: string;
      sound?: string;
    };
  };
}

const config: CapacitorConfig = {
  appId: 'com.pulseepg.tvguide',
  appName: 'PulseEPG',
  webDir: 'dist',
  backgroundColor: '#0a0e17',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    backgroundColor: '#0a0e17',
    allowMixedContent: true,
    buildOptions: {
      releaseType: 'AAB',
    },
  },
  plugins: {
    // Active les requêtes HTTPS natives sur Android pour contourner le CORS sur les fichiers .xml.gz distants
    CapacitorHttp: {
      enabled: true,
    },
    // Empêche setDecorFitsSystemWindows(false) d'interrompre le cycle de vie de l'Activity sur Box Android TV
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0a0e17',
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#0a0e17',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#E11D48',
      sound: 'pulse_alert',
    },
  },
};

export default config;
