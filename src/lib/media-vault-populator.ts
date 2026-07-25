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

  // Fetch the folders themselves to update their titles
  const { data: folderNodes = [] }: { data: any[] | null } = await supabase
    .from('VideoLibraryNode')
    .select('id, title')
    .in('id', uniqueFolderIds);

  const folderTitleMap = new Map<string, string>();
  for (const fn of folderNodes || []) {
    folderTitleMap.set(fn.id, fn.title);
  }

  // Fetch all media vault nodes for these folders (children)
  const { data: mediaNodes = [] }: { data: any[] | null } = await supabase
    .from('VideoLibraryNode')
    .select('id, title, type, url, duration, parentId, sortOrder, attachments')
    .in('parentId', uniqueFolderIds)
    .order('sortOrder', { ascending: true });

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
      let updatedItem = { ...item };

      if (updatedItem.mediaVaultFolderId) {
        // Sync the folder title if it was found
        if (folderTitleMap.has(updatedItem.mediaVaultFolderId)) {
          updatedItem.title = folderTitleMap.get(updatedItem.mediaVaultFolderId);
        }

        if (nodesByFolder.has(updatedItem.mediaVaultFolderId)) {
          const vaultChildren = nodesByFolder.get(updatedItem.mediaVaultFolderId)!.map(vn => ({
            id: vn.id,
            title: vn.title,
            type: vn.type || 'self-hosted',
            url: vn.url || null,
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

export async function populateMediaVaultNodesBatch(allNodes: any[][]): Promise<any[][]> {
  return Promise.all(allNodes.map(nodes => populateMediaVaultNodes(nodes)));
}
