export async function uploadFileToStorage(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folderPath: string
): Promise<string> {
  const publicPrefix = process.env.NEXT_PUBLIC_FILE_URL;
  const uploadToken = process.env.HOSTINGER_UPLOAD_TOKEN;

  if (!publicPrefix || !uploadToken) {
    throw new Error('Missing NEXT_PUBLIC_FILE_URL or HOSTINGER_UPLOAD_TOKEN in environment variables');
  }

  const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
  
  // Create a Blob from the Buffer since fetch expects Blob/File for FormData
  const blob = new Blob([fileBuffer], { type: contentType });

  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('folderPath', cleanFolder);
  formData.append('fileName', fileName);

  const uploadEndpoint = `${publicPrefix.replace(/\/$/, '')}/upload.php`;

  const response = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      'X-Upload-Token': uploadToken,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`Upload failed: ${result.error || 'Unknown error'}`);
  }

  const key = `${cleanFolder}/${fileName}`;
  return `${publicPrefix.replace(/\/$/, '')}/${key}`;
}
