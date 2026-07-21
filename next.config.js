/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['@prisma/client', '.prisma/client'],
    experimental: {
        optimizePackageImports: ['lucide-react', 'framer-motion', '@vidstack/react', 'vidstack', 'zod', 'bcryptjs'],
    },
    turbopack: {},
    images: {
        loader: 'custom',
        loaderFile: './src/imageLoader.js',
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'files.creativebydrshakil.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
        ],
    },
    async headers() {
        const cspHeader = `
            default-src 'self';
            script-src 'self' 'unsafe-eval' 'unsafe-inline';
            style-src 'self' 'unsafe-inline';
            img-src 'self' blob: data: https://files.creativebydrshakil.com https://lh3.googleusercontent.com;
            font-src 'self' data:;
            connect-src 'self' https://*.supabase.co wss://*.supabase.co;
            media-src 'self' blob: data: https://files.creativebydrshakil.com;
            object-src 'none';
            base-uri 'self';
            form-action 'self';
            frame-ancestors 'none';
            upgrade-insecure-requests;
        `.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();

        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Content-Security-Policy', value: cspHeader },
                ],
            },
        ];
    },
};

export default nextConfig;
