-- Run this on each of the 5 replica databases in the Supabase SQL Editor
-- This adds the missing optionE column to the Question table to allow sync-databases.js to work.

ALTER TABLE "Question" 
ADD COLUMN IF NOT EXISTS "optionE" text;
