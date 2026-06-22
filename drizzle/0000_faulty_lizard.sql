-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."ContactIssueType" AS ENUM('query', 'technical_assistance', 'billing', 'course_access', 'other');--> statement-breakpoint
CREATE TYPE "public"."ContactSubmissionStatus" AS ENUM('open', 'in_review', 'responded', 'closed');--> statement-breakpoint
CREATE TYPE "public"."CoursePublishStatus" AS ENUM('draft', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."CourseReleaseMode" AS ENUM('fixed_interval', 'groups_per_week', 'day_of_week', 'explicit_dates', 'instant');--> statement-breakpoint
CREATE TYPE "public"."DeviceType" AS ENUM('desktop', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."UserRole" AS ENUM('admin', 'teacher', 'student');--> statement-breakpoint
CREATE TABLE "LessonProgress" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"courseId" text NOT NULL,
	"lessonNodeId" text NOT NULL,
	"completedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "StudentModuleAvailability" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"userId" text NOT NULL,
	"lessonNodeId" text NOT NULL,
	"availabilityMode" text DEFAULT 'available' NOT NULL,
	"availableAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "CourseInstructor" (
	"id" text PRIMARY KEY NOT NULL,
	"courseId" text NOT NULL,
	"name" text NOT NULL,
	"designation" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"imageUrl" text
);
--> statement-breakpoint
CREATE TABLE "Payment" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"phoneNumber" text NOT NULL,
	"transactionId" text NOT NULL,
	"amount" double precision NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"submittedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"approvedAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "ContactSubmission" (
	"id" text PRIMARY KEY NOT NULL,
	"fullName" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"issueType" "ContactIssueType" NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"imageUrls" text,
	"status" "ContactSubmissionStatus" DEFAULT 'open' NOT NULL,
	"adminReply" text,
	"adminReplySentAt" timestamp(3),
	"repliedByAdminId" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "PaymentConfig" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider" text DEFAULT 'bkash' NOT NULL,
	"sendMoneyNumber" text NOT NULL,
	"qrCodeUrl" text,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DeviceSession" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"deviceType" "DeviceType" NOT NULL,
	"browserName" text NOT NULL,
	"userAgent" text NOT NULL,
	"ipAddress" text NOT NULL,
	"isLocked" boolean DEFAULT false NOT NULL,
	"loggedOutAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"lastActivityAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"passwordHash" text,
	"fullName" text NOT NULL,
	"role" "UserRole" DEFAULT 'student' NOT NULL,
	"bmdcNumber" text,
	"designation" text,
	"institution" text,
	"degrees" text,
	"profileImage" text,
	"emailVerified" boolean DEFAULT true NOT NULL,
	"emailVerificationTokenHash" text,
	"emailVerificationExpires" timestamp(3),
	"passwordResetTokenHash" text,
	"passwordResetExpires" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"canManagePayments" boolean DEFAULT false NOT NULL,
	"telegramChatId" text,
	"image" text
);
--> statement-breakpoint
CREATE TABLE "Course" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"overview" text,
	"categoryId" text,
	"price" double precision NOT NULL,
	"salePrice" double precision,
	"instructor" text NOT NULL,
	"language" text,
	"imageUrl" text,
	"duration" text NOT NULL,
	"courseStartDate" timestamp(3),
	"learningOutcomes" text,
	"teacherId" text,
	"status" "CoursePublishStatus" DEFAULT 'draft' NOT NULL,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	"releaseMode" "CourseReleaseMode",
	"releaseStartAt" timestamp(3),
	"releaseIntervalDays" integer,
	"releaseGroupsPerWeek" integer,
	"releaseGroupDates" text,
	"curriculumJson" text,
	"publishedAt" timestamp(3),
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"isFeatured" boolean DEFAULT false NOT NULL,
	"releaseDaysOfWeek" text
);
--> statement-breakpoint
CREATE TABLE "GlobalSessionLockSettings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"autoLockFirstBrowser" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "SessionLockSettings" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"autoLockFirstBrowser" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"displayName" text NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "VideoLibraryNode" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"url" text,
	"duration" text,
	"parentId" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "EmailOtp" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"otpHash" text NOT NULL,
	"expiresAt" timestamp(3) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Order" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"courseId" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"totalAmount" double precision NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) NOT NULL,
	"enrolledAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP,
	"expiresAt" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp(3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "StudentModuleAvailability" ADD CONSTRAINT "StudentModuleAvailability_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "StudentModuleAvailability" ADD CONSTRAINT "StudentModuleAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "CourseInstructor" ADD CONSTRAINT "CourseInstructor_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ContactSubmission" ADD CONSTRAINT "ContactSubmission_repliedByAdminId_fkey" FOREIGN KEY ("repliedByAdminId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Course" ADD CONSTRAINT "Course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "SessionLockSettings" ADD CONSTRAINT "SessionLockSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "VideoLibraryNode" ADD CONSTRAINT "VideoLibraryNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."VideoLibraryNode"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "LessonProgress_courseId_idx" ON "LessonProgress" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE INDEX "LessonProgress_userId_courseId_idx" ON "LessonProgress" USING btree ("userId" text_ops,"courseId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "LessonProgress_userId_courseId_lessonNodeId_key" ON "LessonProgress" USING btree ("userId" text_ops,"courseId" text_ops,"lessonNodeId" text_ops);--> statement-breakpoint
CREATE INDEX "StudentModuleAvailability_courseId_lessonNodeId_idx" ON "StudentModuleAvailability" USING btree ("courseId" text_ops,"lessonNodeId" text_ops);--> statement-breakpoint
CREATE INDEX "StudentModuleAvailability_courseId_userId_idx" ON "StudentModuleAvailability" USING btree ("courseId" text_ops,"userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "StudentModuleAvailability_courseId_userId_lessonNodeId_key" ON "StudentModuleAvailability" USING btree ("courseId" text_ops,"userId" text_ops,"lessonNodeId" text_ops);--> statement-breakpoint
CREATE INDEX "StudentModuleAvailability_userId_idx" ON "StudentModuleAvailability" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE INDEX "CourseInstructor_courseId_idx" ON "CourseInstructor" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment" USING btree ("orderId" text_ops);--> statement-breakpoint
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission" USING btree ("createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ContactSubmission_email_idx" ON "ContactSubmission" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "ContactSubmission_issueType_idx" ON "ContactSubmission" USING btree ("issueType" enum_ops);--> statement-breakpoint
CREATE INDEX "ContactSubmission_repliedByAdminId_idx" ON "ContactSubmission" USING btree ("repliedByAdminId" text_ops);--> statement-breakpoint
CREATE INDEX "ContactSubmission_status_idx" ON "ContactSubmission" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "DeviceSession_userId_deviceType_idx" ON "DeviceSession" USING btree ("userId" text_ops,"deviceType" text_ops);--> statement-breakpoint
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "User_phone_key" ON "User" USING btree ("phone" text_ops);--> statement-breakpoint
CREATE INDEX "Course_categoryId_idx" ON "Course" USING btree ("categoryId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Course_slug_key" ON "Course" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "Course_status_idx" ON "Course" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "Course_teacherId_idx" ON "Course" USING btree ("teacherId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "SessionLockSettings_userId_key" ON "SessionLockSettings" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Category_name_key" ON "Category" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "VideoLibraryNode_parentId_idx" ON "VideoLibraryNode" USING btree ("parentId" text_ops);--> statement-breakpoint
CREATE INDEX "EmailOtp_email_idx" ON "EmailOtp" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "Order_courseId_idx" ON "Order" USING btree ("courseId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Order_userId_courseId_key" ON "Order" USING btree ("userId" text_ops,"courseId" text_ops);--> statement-breakpoint
CREATE INDEX "Order_userId_idx" ON "Order" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken" USING btree ("identifier" text_ops,"token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken" USING btree ("token" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account" USING btree ("provider" text_ops,"providerAccountId" text_ops);--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session" USING btree ("sessionToken" text_ops);--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId" text_ops);
*/