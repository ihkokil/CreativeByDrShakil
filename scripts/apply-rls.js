const { Client } = require('pg');
require('dotenv').config({ path: '.env' });

const dbUrls = [
  process.env.SUPABASE_DB_URL_1,
  process.env.SUPABASE_DB_URL_2,
  process.env.SUPABASE_DB_URL_3,
  process.env.SUPABASE_DB_URL_4,
  process.env.SUPABASE_DB_URL_5,
].filter(Boolean);

if (dbUrls.length === 0) {
  console.error("No SUPABASE_DB_URL_N found in .env");
  process.exit(1);
}

const sql = `
-- DeviceSession
ALTER TABLE "DeviceSession" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own device sessions" ON "DeviceSession";
CREATE POLICY "Users can manage their own device sessions" 
ON "DeviceSession" 
FOR ALL 
USING (
  "userId" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::text
);

-- User
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own profile" ON "User";
CREATE POLICY "Users can manage their own profile" 
ON "User" 
FOR ALL 
USING (
  "id" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::text
);

-- LessonProgress
ALTER TABLE "LessonProgress" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own lesson progress" ON "LessonProgress";
CREATE POLICY "Users can manage their own lesson progress" 
ON "LessonProgress" 
FOR ALL 
USING (
  "userId" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::text
);

-- Order
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own orders" ON "Order";
CREATE POLICY "Users can view their own orders" 
ON "Order" 
FOR SELECT 
USING (
  "userId" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::text
);

-- QuizAttempt
ALTER TABLE "QuizAttempt" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own quiz attempts" ON "QuizAttempt";
CREATE POLICY "Users can manage their own quiz attempts" 
ON "QuizAttempt" 
FOR ALL 
USING (
  "studentId" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::text
);

-- StudentModuleAvailability
ALTER TABLE "StudentModuleAvailability" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own module overrides" ON "StudentModuleAvailability";
CREATE POLICY "Users can view their own module overrides" 
ON "StudentModuleAvailability" 
FOR SELECT 
USING (
  "studentId" = NULLIF(current_setting('request.jwt.claim.sub', true), '')::text
);
`;

async function applyRls(url, index) {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log(`[${index}] Connected to DB`);
    await client.query(sql);
    console.log(`[${index}] Successfully applied RLS policies`);
  } catch (err) {
    console.error(`[${index}] Error applying RLS:`, err);
  } finally {
    await client.end();
  }
}

async function main() {
  console.log(`Found ${dbUrls.length} database URLs.`);
  for (let i = 0; i < dbUrls.length; i++) {
    await applyRls(dbUrls[i], i + 1);
  }
}

main();
