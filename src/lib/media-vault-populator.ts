import { getSupabase } from '@/lib/db';

export async function populateMediaVaultNodes(nodes: any[]): Promise<any[]> {
  if (!nodes || nodes.length === 0) return nodes;

  const supabase = getSupabase();
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

  // Fetch all media vault nodes for these folders
  const { data: mediaNodes = [] }: { data: any[] | null } = await supabase
    .from('MediaVaultNode')
    .select('id, title, type, url, storagePath, duration, folderId, sortOrder')
    .in('folderId', uniqueFolderIds)
    .order('sortOrder', { ascending: true });

  // Group by folderId
  const nodesByFolder = new Map<string, any[]>();
  for (const node of (mediaNodes || [])) {
    const list = nodesByFolder.get(node.folderId) || [];
    list.push(node);
    nodesByFolder.set(node.folderId, list);
  }

  // Recursively inject children from media vault
  const populate = (items: any[]): any[] => {
    return items.map(item => {
      if (item.mediaVaultFolderId && nodesByFolder.has(item.mediaVaultFolderId)) {
        const vaultChildren = nodesByFolder.get(item.mediaVaultFolderId)!.map(vn => ({
          id: vn.id,
          title: vn.title,
          type: vn.type || 'self-hosted',
          url: vn.url || null,
          storagePath: vn.storagePath || null,
          duration: vn.duration || null,
          children: [],
        }));

        // Merge vault children with any existing children
        const existingChildren = item.children && Array.isArray(item.children) ? item.children : [];
        return {
          ...item,
          children: [...existingChildren, ...vaultChildren],
        };
      }

      if (item.children && Array.isArray(item.children)) {
        return { ...item, children: populate(item.children) };
      }

      return item;
    });
  };

  return populate(nodes);
}

export async function populateMediaVaultNodesBatch(allNodes: any[][]): Promise<any[][]> {
  return Promise.all(allNodes.map(nodes => populateMediaVaultNodes(nodes)));
}
