export type DeviceType = 'desktop' | 'mobile' | 'tablet';

let cachedHash: string | null = null;

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'fallback-' + Math.abs(hash).toString(16);
}

function cleanGPUHardware(vendor: string, renderer: string): string {
  const combined = `${vendor} ${renderer}`.toLowerCase();
  
  // Specific hardware chip matchers (independent of browser wrappers)
  const nvidia = combined.match(/(?:geforce|quadro|rtx|gtx|gt|mx|titan)\s+[a-z0-9\s-]+/i) || combined.match(/nvidia\s+[a-z0-9\s-]+/i);
  if (nvidia) {
    return nvidia[0].replace(/\s+/g, ' ').replace(/d3d\d+|pcie|sse\d*|direct3d[^\)]*/gi, '').trim();
  }

  const amd = combined.match(/(?:radeon|firepro)\s+[a-z0-9\s-]+/i) || combined.match(/amd\s+[a-z0-9\s-]+/i);
  if (amd) {
    return amd[0].replace(/\s+/g, ' ').trim();
  }

  const intel = combined.match(/intel\s+(?:iris|uhd|hd|arc)\s*[a-z0-9\s-]*/i) || combined.match(/(?:iris|uhd|hd|arc)\s+graphics\s*\d*/i);
  if (intel) {
    return intel[0].replace(/\s+/g, ' ').trim();
  }

  const apple = combined.match(/apple\s+m\d+[\w\s]*/i) || (combined.includes('apple') ? 'apple-gpu' : null);
  if (apple) {
    return typeof apple === 'string' ? apple : apple[0].trim();
  }

  const adreno = combined.match(/adreno\s*(?:\(tm\))?\s*\d+/i);
  if (adreno) {
    return adreno[0].replace(/\(tm\)/gi, '').replace(/\s+/g, ' ').trim();
  }

  const mali = combined.match(/mali(?:-[\w\d]+)?/i);
  if (mali) {
    return mali[0].trim();
  }

  // Generic cleanup fallback
  return combined
    .replace(/google\s+inc\.?/gi, '')
    .replace(/nvidia\s+corporation/gi, 'nvidia')
    .replace(/amd\s+corporation/gi, 'amd')
    .replace(/intel\s+corporation/gi, 'intel')
    .replace(/angle\s*\(/gi, '')
    .replace(/,\s*direct3d[^\)]*/gi, '')
    .replace(/,\s*opengl[^\)]*/gi, '')
    .replace(/,\s*vulkan[^\)]*/gi, '')
    .replace(/,\s*metal[^\)]*/gi, '')
    .replace(/\([0-9a-fxX]+\)/g, '')
    .replace(/vs_\d+_\d+\s+ps_\d+_\d+/gi, '')
    .replace(/\/pcie\/sse\d*/gi, '')
    .replace(/d3d\d+/gi, '')
    .replace(/[,\(\)]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWebGLInfo(): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    return cleanGPUHardware(vendor, renderer);
  } catch {
    return '';
  }
}

function getAudioFingerprint(): string {
  if (typeof window === 'undefined') return '44100';
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return '44100';
    const ctx = new AudioCtx();
    const sampleRate = ctx.sampleRate || 44100;
    ctx.close().catch(() => {});
    return `${sampleRate}`;
  } catch {
    return '44100';
  }
}

function getNormalizedScreen(): string {
  if (typeof window === 'undefined' || !window.screen) return '1920x1080';
  
  const w = window.screen.width || 0;
  const h = window.screen.height || 0;
  const dpr = window.devicePixelRatio || 1;

  const directMax = Math.max(w, h);
  const directMin = Math.min(w, h);
  
  const scaledMax = Math.round(directMax * dpr);
  const scaledMin = Math.round(directMin * dpr);

  const standardWidths = [1280, 1366, 1440, 1536, 1600, 1920, 2160, 2560, 2880, 3200, 3840, 4096, 5120];

  let resolvedMax = directMax;
  let resolvedMin = directMin;

  if (standardWidths.includes(scaledMax) && !standardWidths.includes(directMax)) {
    resolvedMax = scaledMax;
    resolvedMin = scaledMin;
  } else if (standardWidths.includes(directMax)) {
    resolvedMax = directMax;
    resolvedMin = directMin;
  } else if (standardWidths.includes(scaledMax)) {
    resolvedMax = scaledMax;
    resolvedMin = scaledMin;
  } else {
    resolvedMax = scaledMax || directMax;
    resolvedMin = scaledMin || directMin;
  }

  const ratio = (resolvedMax > 0 && resolvedMin > 0) ? (resolvedMax / resolvedMin).toFixed(2) : '1.78';
  return `${resolvedMax}x${resolvedMin}_r${ratio}`;
}

export async function getDeviceHash(): Promise<string> {
  if (typeof window === 'undefined') return 'server';
  if (cachedHash) return cachedHash;

  try {
    const rawCores = navigator.hardwareConcurrency || 4;
    const coreBucket = rawCores >= 8 ? '8+' : String(rawCores);
    const touchSupport = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ? 'touch' : 'no-touch';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const gpu = getWebGLInfo();
    const audio = getAudioFingerprint();
    const screenRes = getNormalizedScreen();
    const os = detectOS(navigator.userAgent);

    const properties = {
      os,
      gpu,
      screenRes,
      audio,
      coreBucket,
      tz,
      touchSupport,
    };

    const rawString = [
      properties.os,
      properties.gpu,
      properties.screenRes,
      properties.audio,
      properties.coreBucket,
      properties.tz,
      properties.touchSupport,
    ].join('|');

    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;

    if (cryptoApi && cryptoApi.subtle && typeof cryptoApi.subtle.digest === 'function') {
      const encoder = new TextEncoder();
      const data = encoder.encode(rawString);
      const hashBuffer = await cryptoApi.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      cachedHash = hashHex;
      return hashHex;
    } else {
      cachedHash = simpleHash(rawString);
      return cachedHash;
    }
  } catch (err) {
    console.error('Failed to generate device fingerprint:', err);
    return 'unknown-fingerprint';
  }
}

export function detectOS(userAgent: string): string {
  if (typeof navigator !== 'undefined' && 'userAgentData' in navigator && (navigator as any).userAgentData && (navigator as any).userAgentData.platform) {
    return (navigator as any).userAgentData.platform;
  }
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac intel') || ua.includes('mac os')) return 'macOS';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('linux')) return 'Linux';
  return 'Unknown OS';
}

export function getDeviceCategory(
  userAgent: string,
  maxTouchPoints: number,
  screenWidth: number,
  screenHeight: number
): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator !== 'undefined' && 'userAgentData' in navigator && (navigator as any).userAgentData) {
    return (navigator as any).userAgentData.mobile ? 'mobile' : 'desktop';
  }
  const ua = userAgent.toLowerCase();

  // iPad desktop mode
  const isIPad = (ua.includes('macintosh') || ua.includes('macintel') || ua.includes('ipad')) && maxTouchPoints > 1;
  if (isIPad) return 'tablet';

  // Other tablets (Android tablet, etc.)
  const isTabletUA = /ipad|tablet|playbook|silk/i.test(ua) || (ua.includes('android') && !ua.includes('mobile'));
  if (isTabletUA) return 'tablet';

  // Touch screen + screen dimensions
  const isTouch = maxTouchPoints > 0 || 'ontouchstart' in (typeof window !== 'undefined' ? window : {});
  const minDim = Math.min(screenWidth, screenHeight);

  // Exclude touch-screen Windows laptops from being classified as tablets/mobile
  if (ua.includes('windows') && !ua.includes('phone')) {
    return 'desktop';
  }

  if (isTouch) {
    if (minDim < 600) {
      return 'mobile';
    } else if (minDim <= 1024) {
      return 'tablet';
    }
  }

  // Mobile UA check
  const isMobileUA = /mobile|iphone|ipod|android|windows phone|webos|blackberry/i.test(ua);
  if (isMobileUA) {
    return 'mobile';
  }

  return 'desktop';
}

export function getDeviceLabel(userAgent: string, category: 'mobile' | 'tablet' | 'desktop'): string {
  const ua = userAgent.toLowerCase();

  if (category === 'desktop') {
    if (ua.includes('macintosh') || ua.includes('mac os')) return 'Mac';
    if (ua.includes('windows')) return 'Windows PC';
    if (ua.includes('linux')) return 'Linux PC';
    return 'Desktop PC';
  }

  if (category === 'tablet') {
    if (ua.includes('ipad') || (ua.includes('macintosh') && typeof window !== 'undefined' && 'ontouchend' in document)) return 'iPad';
    if (ua.includes('android')) {
      const match = userAgent.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        const parts = match[1].split(';');
        const modelPart = parts.find(p => p.includes('Build/') || p.trim().startsWith('SM-') || p.trim().split(' ').length > 1);
        if (modelPart) {
          return modelPart.split('Build/')[0].trim() || 'Android Tablet';
        }
      }
      return 'Android Tablet';
    }
    return 'Tablet';
  }

  if (category === 'mobile') {
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('android')) {
      const match = userAgent.match(/\(([^)]+)\)/);
      if (match && match[1]) {
        const parts = match[1].split(';');
        for (let i = parts.length - 1; i >= 0; i--) {
          const part = parts[i].trim();
          if (part.includes('Build/') || part.startsWith('SM-') || part.split(' ').length > 1) {
            const clean = part.split('Build/')[0].trim();
            if (clean && !clean.toLowerCase().includes('linux') && !clean.toLowerCase().includes('android')) {
              return clean;
            }
          }
        }
      }
      return 'Android Phone';
    }
    return 'Mobile Phone';
  }

  return 'Unknown Device';
}
