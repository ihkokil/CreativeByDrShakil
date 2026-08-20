-- Run this on each of the 5 replica databases in the Supabase SQL Editor
-- This adds the missing 'sba' value to the QuestionType enum.

ALTER TYPE "QuestionType" ADD VALUE IF NOT EXISTS 'sba';
