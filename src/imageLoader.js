export default function hostingerImageLoader({ src, width, quality }) {
  // Return data and blob URIs directly without query parameters to prevent corruption
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
    return src || '';
  }

  // Check if the image is a local absolute path (starts with /)
  // If so, append it to the Hostinger URL
  if (src.startsWith('/')) {
    const baseUrl = (process.env.NEXT_PUBLIC_FILE_URL || '').replace(/\/$/, '');
    // Avoid query params on SVGs since they are vector
    if (src.endsWith('.svg')) {
      return `${baseUrl}${src}`;
    }
    const params = `w=${width}&q=${quality || 75}`;
    return `${baseUrl}${src}?${params}`;
  }
  
  // If it's an SVG file already on a full URL, don't append resize params
  if (src.split('?')[0].endsWith('.svg')) {
    return src;
  }

  // If it's already an absolute URL (like https://...)
  const params = `w=${width}&q=${quality || 75}`;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}${params}`;
}
