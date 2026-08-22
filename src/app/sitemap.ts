import { MetadataRoute } from 'next';
import { fetchPublishedCoursesServer } from '@/lib/server-courses';

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
    const courses = await fetchPublishedCoursesServer();
    if (Array.isArray(courses)) {
      const dynamicRoutes = courses.map((course: any) => ({
        url: `${baseUrl}/courses/${course.slug}`,
        lastModified: new Date(course.publishedAt || new Date()),
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      }));
      return [...staticRoutes, ...dynamicRoutes];
    }
  } catch (error) {
    console.error('Error fetching courses for sitemap', error);
  }

  return staticRoutes;
}
