/**
 * Setup script to create the admin account and profiles table in Supabase.
 * Run with: node scripts/setup-admin.mjs
 * 
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read .env.local
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.trim().split('=');
    if (key && valueParts.length) env[key] = valueParts.join('=');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function setup() {
    console.log('🔧 Setting up admin account...\n');

    // 1. Create profiles table
    console.log('📋 Creating profiles table...');
    const { error: sqlError } = await supabase.rpc('exec_sql', {
        query: `
            CREATE TABLE IF NOT EXISTS profiles (
                id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
                full_name TEXT,
                role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
        `
    });

    if (sqlError) {
        console.log('⚠️  Could not create table via RPC (this is normal). Please run the SQL manually in Supabase dashboard.');
        console.log('   SQL to run:');
        console.log(`
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can insert profiles" ON profiles FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
        `);
    } else {
        console.log('✅ Profiles table created!');
    }

    // 2. Create admin user
    console.log('\n👤 Creating admin account...');
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: 'admin@creativebydrshakil.com',
        password: 'Admin@123',
        email_confirm: true,
        user_metadata: {
            full_name: 'Creative by Dr. Shakil'
        }
    });

    if (userError) {
        if (userError.message.includes('already been registered')) {
            console.log('ℹ️  Admin user already exists. Fetching user...');
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const adminUser = users?.find(u => u.email === 'admin@creativebydrshakil.com');
            if (adminUser) {
                console.log(`   User ID: ${adminUser.id}`);
                // Try to upsert profile
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: adminUser.id,
                        full_name: 'Creative by Dr. Shakil',
                        role: 'admin'
                    }, { onConflict: 'id' });
                if (profileError) {
                    console.log('⚠️  Could not upsert profile:', profileError.message);
                } else {
                    console.log('✅ Admin profile updated!');
                }
            }
        } else {
            console.error('❌ Error creating admin user:', userError.message);
        }
    } else {
        console.log(`✅ Admin user created! ID: ${userData.user.id}`);

        // 3. Insert admin profile
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userData.user.id,
                full_name: 'Creative by Dr. Shakil',
                role: 'admin'
            }, { onConflict: 'id' });

        if (profileError) {
            console.log('⚠️  Could not insert profile:', profileError.message);
            console.log('   You may need to create the profiles table first (see SQL above).');
        } else {
            console.log('✅ Admin profile inserted!');
        }
    }

    console.log('\n🎉 Setup complete!');
    console.log('   Email: admin@creativebydrshakil.com');
    console.log('   Password: Admin@123');
    console.log('   Display Name: Creative by Dr. Shakil');
}

setup().catch(console.error);
