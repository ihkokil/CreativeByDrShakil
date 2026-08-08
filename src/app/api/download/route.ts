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
        headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
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
