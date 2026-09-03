import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');
    const fileName = searchParams.get('name') || 'download';

    if (!fileUrl) {
        return new NextResponse('Missing URL', { status: 400 });
    }

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            return new NextResponse('Failed to fetch file', { status: response.status });
        }

        const headers = new Headers();

        // HTTP header values only support ByteString (ASCII <= 255).
        // Non-ASCII characters (e.g. em dash "—", unicode symbols) throw TypeError if used directly in filename="...".
        // Use RFC 6266 / RFC 5987 standard format: ASCII fallback in `filename` and percent-encoded UTF-8 in `filename*`.
        const asciiFileName = fileName
            .replace(/[^\x20-\x7E]/g, '_')
            .replace(/["\\]/g, '');
        const encodedFileName = encodeURIComponent(fileName);

        headers.set(
            'Content-Disposition',
            `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`
        );
        headers.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
        
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            headers.set('Content-Length', contentLength);
        }

        return new NextResponse(response.body, {
            headers,
        });
    } catch (error) {
        console.error('[Download Proxy Error]', error);
        return new NextResponse('Download failed', { status: 500 });
    }
}
