CREATE TABLE IF NOT EXISTS "CourseQuiz" (
  "id"               VARCHAR(191) NOT NULL,
  "courseId"         VARCHAR(191) NOT NULL,
  "quizId"           VARCHAR(191) NOT NULL,
  "curriculumNodeId" VARCHAR(191),
  "sortOrder"        INT NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY ("id"),
  CONSTRAINT "CourseQuiz_quizId_key" UNIQUE ("quizId")
);

CREATE INDEX IF NOT EXISTS "CourseQuiz_courseId_idx" ON "CourseQuiz" ("courseId");
CREATE INDEX IF NOT EXISTS "CourseQuiz_quizId_idx" ON "CourseQuiz" ("quizId");
CREATE INDEX IF NOT EXISTS "CourseQuiz_curriculumNodeId_idx" ON "CourseQuiz" ("curriculumNodeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CourseQuiz_courseId_fkey'
  ) THEN
    ALTER TABLE "CourseQuiz"
      ADD CONSTRAINT "CourseQuiz_courseId_fkey"
        FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CourseQuiz_quizId_fkey'
  ) THEN
    ALTER TABLE "CourseQuiz"
      ADD CONSTRAINT "CourseQuiz_quizId_fkey"
        FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE;
  END IF;
END $$;
