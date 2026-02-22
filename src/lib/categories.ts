export interface CategorySummary {
  id: string;
  name: string;
  displayName: string;
}

export async function fetchCategories(): Promise<CategorySummary[]> {
  const response = await fetch('/api/categories', { cache: 'no-store' });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load categories.');
  }

  return Array.isArray(data?.categories) ? data.categories : [];
}