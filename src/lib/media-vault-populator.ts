import { getSupabaseAdmin } from '@/lib/db';

export async function populateMediaVaultNodes(nodes: any[], customSupabase?: any): Promise<any[]> {
  if (!nodes || nodes.length === 0) return nodes;

  const supabase = customSupabase || getSupabaseAdmin();
  const folderIds: string[] = [];

  const collectFolderIds = (items: any[]) => {
    for (const item of items) {
      if (item.mediaVaultFolderId) {
        folderIds.push(item.mediaVaultFolderId);
      }
      if (item.children && Array.isArray(item.children)) {
        collectFolderIds(item.children);
      }
    }
  };

  collectFolderIds(nodes);

  if (folderIds.length === 0) return nodes;

  const uniqueFolderIds = [...new Set(folderIds)];

  // Fetch folder titles and child media nodes in parallel
  const [{ data: folderNodes = [] }, { data: mediaNodes = [] }]: [
    { data: any[] | null },
    { data: any[] | null }
  ] = await Promise.all([
    supabase
      .from('VideoLibraryNode')
      .select('id, title')
      .in('id', uniqueFolderIds),
    supabase
      .from('VideoLibraryNode')
      .select('id, title, type, url, duration, parentId, sortOrder, attachments')
      .in('parentId', uniqueFolderIds)
      .order('sortOrder', { ascending: true }),
  ]);

  const folderTitleMap = new Map<string, string>();
  for (const fn of folderNodes || []) {
    folderTitleMap.set(fn.id, fn.title);
  }

  // Group by folderId (parentId)
  const nodesByFolder = new Map<string, any[]>();
  for (const node of (mediaNodes || [])) {
    const list = nodesByFolder.get(node.parentId) || [];
    list.push(node);
    nodesByFolder.set(node.parentId, list);
  }

  // Recursively inject children from media vault and update folder titles
  const populate = (items: any[]): any[] => {
    return items.map(item => {
      const updatedItem = { ...item };

      if (updatedItem.mediaVaultFolderId) {
        // Sync the folder title if it was found
        if (folderTitleMap.has(updatedItem.mediaVaultFolderId)) {
          updatedItem.title = folderTitleMap.get(updatedItem.mediaVaultFolderId);
        }

        if (nodesByFolder.has(updatedItem.mediaVaultFolderId)) {
          const vaultChildren = nodesByFolder.get(updatedItem.mediaVaultFolderId)!.map(vn => ({
            id: vn.type === 'quiz' ? `quiz_${vn.id}` : vn.id,
            title: vn.title,
            type: vn.type || 'self-hosted',
            url: vn.url || null,
            quizId: vn.type === 'quiz' ? (vn.url || vn.id) : undefined,
            attachments: vn.attachments || null,
            duration: vn.duration || null,
            children: [],
          }));

          // Merge vault children with any existing children
          const existingChildren = updatedItem.children && Array.isArray(updatedItem.children) ? updatedItem.children : [];
          updatedItem.children = [...existingChildren, ...vaultChildren];
        }
      }

      if (updatedItem.children && Array.isArray(updatedItem.children)) {
        updatedItem.children = populate(updatedItem.children);
      }

      return updatedItem;
    });
  };

  return populate(nodes);
}

export async function populateMediaVaultNodesBatch(allNodes: any[][], customSupabase?: any): Promise<any[][]> {
  if (!allNodes || allNodes.length === 0) return allNodes;

  const supabase = customSupabase || getSupabaseAdmin();
  const folderIds: string[] = [];

  const collectFolderIds = (items: any[]) => {
    for (const item of items) {
      if (item.mediaVaultFolderId) {
        folderIds.push(item.mediaVaultFolderId);
      }
      if (item.children && Array.isArray(item.children)) {
        collectFolderIds(item.children);
      }
    }
  };

  for (const nodes of allNodes) {
    if (nodes && nodes.length > 0) {
      collectFolderIds(nodes);
    }
  }

  if (folderIds.length === 0) return allNodes;

  const uniqueFolderIds = [...new Set(folderIds)];

  const [{ data: folderNodes = [] }, { data: mediaNodes = [] }]: [
    { data: any[] | null },
    { data: any[] | null }
  ] = await Promise.all([
    supabase
      .from('VideoLibraryNode')
      .select('id, title')
      .in('id', uniqueFolderIds),
    supabase
      .from('VideoLibraryNode')
      .select('id, title, type, url, duration, parentId, sortOrder, attachments')
      .in('parentId', uniqueFolderIds)
      .order('sortOrder', { ascending: true }),
  ]);

  const folderTitleMap = new Map<string, string>();
  for (const fn of folderNodes || []) {
    folderTitleMap.set(fn.id, fn.title);
  }

  const nodesByFolder = new Map<string, any[]>();
  for (const node of mediaNodes || []) {
    const list = nodesByFolder.get(node.parentId) || [];
    list.push(node);
    nodesByFolder.set(node.parentId, list);
  }

  const populate = (items: any[]): any[] => {
    return items.map(item => {
      const updatedItem = { ...item };

      if (updatedItem.mediaVaultFolderId) {
        if (folderTitleMap.has(updatedItem.mediaVaultFolderId)) {
          updatedItem.title = folderTitleMap.get(updatedItem.mediaVaultFolderId);
        }

        if (nodesByFolder.has(updatedItem.mediaVaultFolderId)) {
          const vaultChildren = nodesByFolder.get(updatedItem.mediaVaultFolderId)!.map(vn => ({
            id: vn.type === 'quiz' ? `quiz_${vn.id}` : vn.id,
            title: vn.title,
            type: vn.type || 'self-hosted',
            url: vn.url || null,
            quizId: vn.type === 'quiz' ? (vn.url || vn.id) : undefined,
            attachments: vn.attachments || null,
            duration: vn.duration || null,
            children: [],
          }));

          const existingChildren = updatedItem.children && Array.isArray(updatedItem.children) ? updatedItem.children : [];
          updatedItem.children = [...existingChildren, ...vaultChildren];
        }
      }

      if (updatedItem.children && Array.isArray(updatedItem.children)) {
        updatedItem.children = populate(updatedItem.children);
      }

      return updatedItem;
    });
  };

  return allNodes.map(nodes => (nodes && nodes.length > 0 ? populate(nodes) : nodes));
}
