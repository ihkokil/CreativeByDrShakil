export default function hostingerImageLoader({ src, width, quality }) {
  // Check if the image is a local absolute path (starts with /)
  // If so, append it to the Hostinger URL
  if (src.startsWith('/')) {
    // If NEXT_PUBLIC_FILE_URL has a trailing slash, remove it first
    const baseUrl = (process.env.NEXT_PUBLIC_FILE_URL || '').replace(/\/$/, '');
    return `${baseUrl}${src}`;
  }
  
  // If it's already an absolute URL (like https://...), return it as is
  return src;
}
