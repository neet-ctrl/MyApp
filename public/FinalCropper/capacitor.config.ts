import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shakti.smartimagecropper',
  appName: 'Smart Image Cropper',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  android: {
    webContentsDebuggingEnabled: true,
    allowMixedContent: true
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: false
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false
    }
  }
};

export default config;
