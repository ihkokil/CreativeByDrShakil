import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://creativebydrshakil.com';

  const staticRoutes = [
    '',
    '/courses',
    '/contact',
    '/about',
    '/login',
    '/register',
    '/privacy',
    '/terms',
    '/refund',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    const res = await fetch(`${baseUrl}/api/courses/dynamic`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.courses)) {
        const dynamicRoutes = data.courses.map((course: any) => ({
          url: `${baseUrl}/courses/${course.slug}`,
          lastModified: new Date(course.updatedAt || new Date()),
          changeFrequency: 'weekly' as const,
          priority: 0.9,
        }));
        return [...staticRoutes, ...dynamicRoutes];
      }
    }
  } catch (error) {
    console.error('Error fetching courses for sitemap', error);
  }

  return staticRoutes;
}
