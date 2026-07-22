import { getSupabaseAdmin } from '@/lib/db';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';

export async function getStarterCatalogFromDB(): Promise<any[]> {
  const supabase = getSupabaseAdmin();

  const { data: starterCourses = [] } = await supabase
    // @ts-ignore: StarterCatalog might be missing from generated types
    .from('StarterCatalog')
    .select('*')
    .order('sortOrder', { ascending: true });

  return starterCourses || [];
}

export async function getStarterCatalogSummary(): Promise<any[]> {
  const catalog = await getStarterCatalogFromDB();

  return catalog.map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    topicCount: item.topicJson
      ? parseCurriculumJson(item.topicJson).length
      : 0,
  }));
}

export function buildCurriculumFromStarter(mainTopicIds: string[], catalog: any[]): any[] {
  const catalogMap = new Map(catalog.map((item: any) => [item.id, item]));
  const curriculum: any[] = [];

  for (const topicId of mainTopicIds) {
    const item = catalogMap.get(topicId);
    if (!item) continue;

    const topicNodes = item.topicJson ? parseCurriculumJson(item.topicJson) : [];
    curriculum.push(...topicNodes);
  }

  return curriculum;
}
