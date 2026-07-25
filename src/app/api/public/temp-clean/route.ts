import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const basePath = process.cwd();
        const filesToDel = [
            'src/app/api/public/temp-migrate/route.ts',
            'src/app/api/public/temp-inspect/route.ts',
            'scripts/migrate-media-vault.mjs'
        ];
        
        for (const f of filesToDel) {
            const p = path.join(basePath, f);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }
        
        // Also remove directories if possible
        const dirsToDel = [
            'src/app/api/public/temp-migrate',
            'src/app/api/public/temp-inspect'
        ];
        
        for (const d of dirsToDel) {
            const dp = path.join(basePath, d);
            if (fs.existsSync(dp)) fs.rmdirSync(dp);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
