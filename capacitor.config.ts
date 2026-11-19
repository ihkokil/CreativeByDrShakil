const config = {
  appId: 'com.creativebydrshakil.app',
  appName: 'Creative By Dr. Shakil',
  webDir: 'public',
  server: {
    url: 'https://creativebydrshakil.com',
    cleartext: false,
    allowNavigation: [
      'creativebydrshakil.com',
      '*.creativebydrshakil.com',
      '*.youtube.com',
      '*.youtube-nocookie.com',
      '*.pipratube.com',
      '*.b-cdn.net',
    ],
  },
  android: {
    backgroundColor: '#0a0a0c',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#0a0a0c',
    contentInset: 'automatic',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0a0a0c',
      androidSplashResourceName: 'splash_icon',
      androidScaleType: 'CENTER_INSIDE',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0c',
    },
  },
};

export default config;
