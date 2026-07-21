import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const HOSTINGER_URL = 'https://files.creativebydrshakil.com';
const UPLOAD_TOKEN = process.env.HOSTINGER_UPLOAD_TOKEN;

const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif']);

async function uploadFile(localPath: string, relativePath: string): Promise<boolean> {
    const fileBuffer = fs.readFileSync(localPath);
    const fileName = path.basename(localPath);
    const contentType = getContentType(fileName);
    
    // Replace backslashes with forward slashes for the remote folder path
    const folderPath = path.dirname(relativePath).replace(/\\/g, '/');
    const finalFolderPath = folderPath === '.' ? '' : folderPath;

    const blob = new Blob([new Uint8Array(fileBuffer)], { type: contentType });
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('folderPath', finalFolderPath);
    formData.append('fileName', fileName);

    try {
        const response = await fetch(`${HOSTINGER_URL}/upload.php`, {
            method: 'POST',
            headers: {
                'X-Upload-Token': UPLOAD_TOKEN?.replace(/"/g, '') || '',
            },
            body: formData,
        });

        if (!response.ok) {
            console.error(`Upload failed for ${relativePath}: Status ${response.status}`);
            return false;
        }

        const result = await response.json();
        if (result.success) {
            console.log(`✅ Uploaded: ${relativePath} -> ${HOSTINGER_URL}/${finalFolderPath}/${fileName}`.replace(/(?<!:)\/\//g, '/'));
            return true;
        } else {
            console.error(`Upload error for ${relativePath}: ${result.error}`);
            return false;
        }
    } catch (error) {
        console.error(`Fetch error for ${relativePath}:`, error);
        return false;
    }
}

function getContentType(fileName: string) {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        case '.svg': return 'image/svg+xml';
        case '.gif': return 'image/gif';
        case '.avif': return 'image/avif';
        default: return 'application/octet-stream';
    }
}

async function processDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(publicDir, fullPath);
        
        if (fs.statSync(fullPath).isDirectory()) {
            await processDirectory(fullPath);
            // Delete if empty
            if (fs.readdirSync(fullPath).length === 0) {
                fs.rmdirSync(fullPath);
                console.log(`🗑️ Deleted empty directory: ${relativePath}`);
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            
            // Skip favicon.ico as requested
            if (file === 'favicon.ico' && relativePath === 'favicon.ico') {
                console.log(`⏭️ Skipping favicon.ico`);
                continue;
            }

            if (ALLOWED_EXTS.has(ext)) {
                console.log(`⏳ Uploading ${relativePath}...`);
                const success = await uploadFile(fullPath, relativePath);
                if (success) {
                    fs.unlinkSync(fullPath);
                    console.log(`🗑️ Deleted local file: ${relativePath}`);
                }
            }
        }
    }
}

async function run() {
    console.log('Starting Public Assets Migration to Hostinger...');
    await processDirectory(publicDir);
    console.log('Migration Complete!');
}

run().catch(console.error);
