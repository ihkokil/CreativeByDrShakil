import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://creativebydrshakil.com';
  
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin/',
        '/dashboard/',
        '/study/', // Students shouldn't have their course UI indexed
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
