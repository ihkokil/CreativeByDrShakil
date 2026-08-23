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

export interface GeoInfo {
  ipAddress: string;
  city: string | null;
  country: string | null;
  countryCode: string | null;
}

/**
 * Extract IP address from request headers
 */
export function extractClientIp(headers: Headers): string {
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return '127.0.0.1';
}

/**
 * Extract City and Country information from edge headers
 */
export function extractClientGeo(headers: Headers): GeoInfo {
  const ipAddress = extractClientIp(headers);

  // Cloudflare geo headers
  const cfCity = headers.get('cf-ipcity');
  const cfCountry = headers.get('cf-ipcountry');

  // Vercel geo headers
  const vercelCity = headers.get('x-vercel-ip-city');
  const vercelCountry = headers.get('x-vercel-ip-country');

  // Generic geo headers
  const generalCity = headers.get('x-client-city') || headers.get('x-geo-city');
  const generalCountry = headers.get('x-client-country') || headers.get('x-geo-country');

  const city = cfCity || vercelCity || generalCity || null;
  const countryCode = cfCountry || vercelCountry || headers.get('x-country-code') || null;

  // Format country code to friendly name if known
  let country = countryCode;
  if (countryCode === 'BD') country = 'Bangladesh';
  else if (countryCode === 'US') country = 'United States';
  else if (countryCode === 'GB' || countryCode === 'UK') country = 'United Kingdom';
  else if (countryCode === 'IN') country = 'India';
  else if (countryCode === 'CA') country = 'Canada';
  else if (countryCode === 'AU') country = 'Australia';
  else if (countryCode === 'AE') country = 'United Arab Emirates';
  else if (countryCode === 'SA') country = 'Saudi Arabia';
  else if (generalCountry) country = generalCountry;

  return {
    ipAddress,
    city: city ? decodeURIComponent(city) : null,
    country: country || null,
    countryCode: countryCode || null,
  };
}
