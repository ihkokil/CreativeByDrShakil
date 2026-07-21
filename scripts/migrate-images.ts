import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const HOSTINGER_URL = 'https://files.creativebydrshakil.com';
const UPLOAD_TOKEN = process.env.HOSTINGER_UPLOAD_TOKEN;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadToHostinger(localPath: string): Promise<string | null> {
    const cleanPath = localPath.replace(/^\//, '').split('?')[0]; // Remove leading slash and query params
    const fullPath = path.join(publicDir, cleanPath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`[WARN] File not found: ${fullPath}`);
        return null;
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const fileName = path.basename(fullPath);
    const contentType = getContentType(fileName);
    const folderPath = path.dirname(cleanPath);

    const blob = new Blob([new Uint8Array(fileBuffer)], { type: contentType });
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('folderPath', folderPath);
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
            console.error(`Upload failed for ${localPath}: Status ${response.status}`);
            return null;
        }

        const result = await response.json();
        if (result.success) {
            return `${HOSTINGER_URL}/${folderPath}/${fileName}`.replace(/(?<!:)\/\//g, '/');
        } else {
            console.error(`Upload error for ${localPath}: ${result.error}`);
            return null;
        }
    } catch (error) {
        console.error(`Fetch error for ${localPath}:`, error);
        return null;
    }
}

function getContentType(fileName: string) {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.avif': return 'image/avif';
        default: return 'application/octet-stream';
    }
}

async function migrate() {
    console.log('Starting Hostinger Image Migration using Supabase...');

    // 1. Users
    const { data: users, error: userError } = await supabase
        .from('User')
        .select('id, profileImage, image')
        .or('profileImage.ilike./%,image.ilike./%');
        
    if (userError) console.error(userError);
    else if (users) {
        console.log(`Found ${users.length} users with local images.`);
        for (const user of users) {
            let updated = false;
            const dataToUpdate: any = {};
            
            if (user.profileImage?.startsWith('/')) {
                console.log(`Uploading profileImage for user ${user.id}...`);
                const newUrl = await uploadToHostinger(user.profileImage);
                if (newUrl) { dataToUpdate.profileImage = newUrl; updated = true; }
            }
            if (user.image?.startsWith('/')) {
                console.log(`Uploading image for user ${user.id}...`);
                const newUrl = await uploadToHostinger(user.image);
                if (newUrl) { dataToUpdate.image = newUrl; updated = true; }
            }

            if (updated) {
                await supabase.from('User').update(dataToUpdate).eq('id', user.id);
                console.log(`Updated user ${user.id}`);
            }
        }
    }

    // 2. Courses
    const { data: courses, error: courseError } = await supabase
        .from('Course')
        .select('id, slug, imageUrl')
        .ilike('imageUrl', '/%');
        
    if (courseError) console.error(courseError);
    else if (courses) {
        console.log(`Found ${courses.length} courses with local images.`);
        for (const course of courses) {
            if (course.imageUrl?.startsWith('/')) {
                console.log(`Uploading imageUrl for course ${course.slug}...`);
                const newUrl = await uploadToHostinger(course.imageUrl);
                if (newUrl) {
                    await supabase.from('Course').update({ imageUrl: newUrl }).eq('id', course.id);
                    console.log(`Updated course ${course.slug}`);
                }
            }
        }
    }

    // 3. CourseInstructors
    const { data: instructors, error: instError } = await supabase
        .from('CourseInstructor')
        .select('id, name, imageUrl')
        .ilike('imageUrl', '/%');

    if (instError) console.error(instError);
    else if (instructors) {
        console.log(`Found ${instructors.length} instructors with local images.`);
        for (const inst of instructors) {
            if (inst.imageUrl?.startsWith('/')) {
                console.log(`Uploading imageUrl for instructor ${inst.name}...`);
                const newUrl = await uploadToHostinger(inst.imageUrl);
                if (newUrl) {
                    await supabase.from('CourseInstructor').update({ imageUrl: newUrl }).eq('id', inst.id);
                    console.log(`Updated instructor ${inst.name}`);
                }
            }
        }
    }

    console.log('Migration Complete!');
}

migrate().catch(console.error);
