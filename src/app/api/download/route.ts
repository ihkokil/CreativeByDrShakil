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

        const blob = await response.blob();

        return new NextResponse(blob, {
            headers: {
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
            },
        });
    } catch (error) {
        console.error('[Download Proxy Error]', error);
        return new NextResponse('Download failed', { status: 500 });
    }
}
