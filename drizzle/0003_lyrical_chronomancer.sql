CREATE TYPE "public"."AttemptStatus" AS ENUM('in_progress', 'submitted', 'auto_submitted', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."QuestionType" AS ENUM('mcq', 'true_false');--> statement-breakpoint
CREATE TYPE "public"."QuizPositionType" AS ENUM('best_attempt', 'last_attempt', 'first_attempt');--> statement-breakpoint
CREATE TYPE "public"."QuizStatus" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "AttemptAnswer" (
	"id" text PRIMARY KEY NOT NULL,
	"attemptId" text NOT NULL,
	"questionId" text NOT NULL,
	"selectedOption" text,
	"isCorrect" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Question" (
	"id" text PRIMARY KEY NOT NULL,
	"quizId" text NOT NULL,
	"questionText" text NOT NULL,
	"questionType" "QuestionType" NOT NULL,
	"optionA" text NOT NULL,
	"optionB" text NOT NULL,
	"optionC" text,
	"optionD" text,
	"correctOption" text NOT NULL,
	"explanation" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Quiz" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"instructions" text,
	"categoryId" text,
	"durationMinutes" integer NOT NULL,
	"numQuestionsToServe" integer NOT NULL,
	"positionType" "QuizPositionType" DEFAULT 'best_attempt' NOT NULL,
	"allowMultipleAttempts" boolean DEFAULT false NOT NULL,
	"maxAttempts" integer,
	"allowNegativeMarking" boolean DEFAULT false NOT NULL,
	"negativeValue" double precision DEFAULT 0.25 NOT NULL,
	"marksPerCorrect" double precision DEFAULT 1 NOT NULL,
	"startDatetime" timestamp(3),
	"endDatetime" timestamp(3),
	"status" "QuizStatus" DEFAULT 'draft' NOT NULL,
	"shuffleQuestions" boolean DEFAULT true NOT NULL,
	"shuffleOptions" boolean DEFAULT true NOT NULL,
	"createdBy" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"publishedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "QuizAttempt" (
	"id" text PRIMARY KEY NOT NULL,
	"quizId" text NOT NULL,
	"studentId" text NOT NULL,
	"startedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"submittedAt" timestamp(3),
	"timeTakenSeconds" integer,
	"isAutoSubmitted" boolean DEFAULT false NOT NULL,
	"totalScore" double precision DEFAULT 0 NOT NULL,
	"correctCount" integer DEFAULT 0 NOT NULL,
	"wrongCount" integer DEFAULT 0 NOT NULL,
	"skippedCount" integer DEFAULT 0 NOT NULL,
	"negativeMarks" double precision DEFAULT 0 NOT NULL,
	"netScore" double precision DEFAULT 0 NOT NULL,
	"percentageScore" double precision DEFAULT 0 NOT NULL,
	"rank" integer,
	"status" "AttemptStatus" DEFAULT 'in_progress' NOT NULL,
	"attemptNumber" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QuizCategory" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"displayName" text NOT NULL,
	"description" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "QuizQuestionMapping" (
	"id" text PRIMARY KEY NOT NULL,
	"attemptId" text NOT NULL,
	"questionId" text NOT NULL,
	"displayOrder" integer NOT NULL,
	"optionOrder" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "public"."QuizAttempt"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."Quiz"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."QuizCategory"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "public"."Quiz"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QuizQuestionMapping" ADD CONSTRAINT "QuizQuestionMapping_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "public"."QuizAttempt"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "QuizQuestionMapping" ADD CONSTRAINT "QuizQuestionMapping_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."Question"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "AttemptAnswer_attemptId_idx" ON "AttemptAnswer" USING btree ("attemptId" text_ops);--> statement-breakpoint
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer" USING btree ("questionId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer" USING btree ("attemptId" text_ops,"questionId" text_ops);--> statement-breakpoint
CREATE INDEX "Question_quizId_idx" ON "Question" USING btree ("quizId" text_ops);--> statement-breakpoint
CREATE INDEX "Quiz_categoryId_idx" ON "Quiz" USING btree ("categoryId" text_ops);--> statement-breakpoint
CREATE INDEX "Quiz_status_idx" ON "Quiz" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Quiz_createdBy_idx" ON "Quiz" USING btree ("createdBy" text_ops);--> statement-breakpoint
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt" USING btree ("quizId" text_ops);--> statement-breakpoint
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt" USING btree ("studentId" text_ops);--> statement-breakpoint
CREATE INDEX "QuizAttempt_status_idx" ON "QuizAttempt" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QuizAttempt_quizId_studentId_attemptNumber_key" ON "QuizAttempt" USING btree ("quizId" text_ops,"studentId" text_ops,"attemptNumber" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QuizCategory_name_key" ON "QuizCategory" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "QuizQuestionMapping_attemptId_idx" ON "QuizQuestionMapping" USING btree ("attemptId" text_ops);--> statement-breakpoint
CREATE INDEX "QuizQuestionMapping_questionId_idx" ON "QuizQuestionMapping" USING btree ("questionId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "QuizQuestionMapping_attemptId_questionId_key" ON "QuizQuestionMapping" USING btree ("attemptId" text_ops,"questionId" text_ops);