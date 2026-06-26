export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface DeviceInfo {
  deviceType: DeviceType;
  browserName: string;
}

/**
 * Parse User-Agent string to detect device type and browser name
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  // Mobile detection
  const mobileRegex = /mobile|android|iphone|ipad|ipod|windows phone|webos|blackberry/i;
  const deviceType: DeviceType = mobileRegex.test(userAgent) ? 'mobile' : 'desktop';

  // Browser detection
  let browserName = 'Unknown';

  if (/edge|edg\//i.test(userAgent)) {
    browserName = 'Edge';
  } else if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) {
    browserName = 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    browserName = 'Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    browserName = 'Safari';
  } else if (/opera|opr\//i.test(userAgent)) {
    browserName = 'Opera';
  } else if (/trident|msie|rv:/i.test(userAgent)) {
    browserName = 'Internet Explorer';
  }

  return { deviceType, browserName };
}

/**
 * Extract IP address from request headers
 */
export function extractClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback for IP retrieved from socket connection
  return 'unknown';
}
