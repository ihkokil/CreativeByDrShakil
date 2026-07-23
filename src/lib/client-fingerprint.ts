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

export async function getDeviceHash(): Promise<string> {
  if (typeof window === 'undefined') return 'server';
  if (cachedHash) return cachedHash;

  try {
    const properties = {
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      platform: navigator.platform || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      deviceMemory: 'deviceMemory' in navigator ? (navigator as any).deviceMemory || 0 : 0,
    };

    const rawString = [
      properties.hardwareConcurrency,
      properties.platform,
      properties.timezone,
      properties.touchSupport,
      properties.maxTouchPoints,
      properties.deviceMemory
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
