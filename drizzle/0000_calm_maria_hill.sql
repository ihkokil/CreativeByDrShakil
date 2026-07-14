CREATE TABLE `Account` (
	`id` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`type` text NOT NULL,
	`provider` varchar(255) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` int,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	CONSTRAINT `Account_id` PRIMARY KEY(`id`),
	CONSTRAINT `Account_provider_providerAccountId_key` UNIQUE(`provider`,`providerAccountId`)
);
--> statement-breakpoint
CREATE TABLE `AttemptAnswer` (
	`id` varchar(255) NOT NULL,
	`attemptId` varchar(255) NOT NULL,
	`questionId` varchar(255) NOT NULL,
	`selectedOption` text,
	`isCorrect` boolean NOT NULL DEFAULT false,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `AttemptAnswer_id` PRIMARY KEY(`id`),
	CONSTRAINT `AttemptAnswer_attemptId_questionId_key` UNIQUE(`attemptId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `Category` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`displayName` text NOT NULL,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `Category_id` PRIMARY KEY(`id`),
	CONSTRAINT `Category_name_key` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `ContactSubmission` (
	`id` varchar(255) NOT NULL,
	`fullName` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` text NOT NULL,
	`issueType` enum('query','technical_assistance','billing','course_access','other') NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`imageUrls` text,
	`status` enum('open','in_review','responded','closed') NOT NULL DEFAULT 'open',
	`adminReply` text,
	`adminReplySentAt` datetime(3),
	`repliedByAdminId` varchar(255),
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `ContactSubmission_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Course` (
	`id` varchar(255) NOT NULL,
	`slug` varchar(255),
	`title` text NOT NULL,
	`description` text NOT NULL,
	`overview` text,
	`categoryId` varchar(255),
	`price` double NOT NULL,
	`salePrice` double,
	`instructor` text NOT NULL,
	`language` text,
	`imageUrl` text,
	`duration` text NOT NULL,
	`courseStartDate` datetime(3),
	`learningOutcomes` text,
	`teacherId` varchar(255),
	`status` enum('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
	`timezone` text NOT NULL DEFAULT ('Asia/Dhaka'),
	`releaseMode` enum('fixed_interval','groups_per_week','day_of_week','explicit_dates','instant'),
	`releaseStartAt` datetime(3),
	`releaseIntervalDays` int,
	`releaseGroupsPerWeek` int,
	`releaseGroupDates` text,
	`curriculumJson` text,
	`publishedAt` datetime(3),
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	`isFeatured` boolean NOT NULL DEFAULT false,
	`releaseDaysOfWeek` text,
	CONSTRAINT `Course_id` PRIMARY KEY(`id`),
	CONSTRAINT `Course_slug_key` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `CourseInstructor` (
	`id` varchar(255) NOT NULL,
	`courseId` varchar(255) NOT NULL,
	`name` text NOT NULL,
	`designation` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	`imageUrl` text,
	CONSTRAINT `CourseInstructor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `DeviceSession` (
	`id` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`deviceType` enum('desktop','mobile','tablet') NOT NULL,
	`browserName` text NOT NULL,
	`userAgent` text NOT NULL,
	`ipAddress` text NOT NULL,
	`isLocked` boolean NOT NULL DEFAULT false,
	`loggedOutAt` datetime(3),
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`lastActivityAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deviceHash` text,
	`deviceLabel` text,
	`osInfo` text,
	`lockedByDeviceLabel` text,
	CONSTRAINT `DeviceSession_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `EmailOtp` (
	`id` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`otpHash` text NOT NULL,
	`expiresAt` datetime(3) NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `EmailOtp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `GlobalSessionLockSettings` (
	`id` varchar(255) NOT NULL DEFAULT 'global',
	`autoLockFirstBrowser` boolean NOT NULL DEFAULT true,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	`allowDesktop` boolean NOT NULL DEFAULT true,
	`allowTablet` boolean NOT NULL DEFAULT true,
	`allowMobile` boolean NOT NULL DEFAULT true,
	`maxConcurrentSessions` int NOT NULL DEFAULT 3,
	CONSTRAINT `GlobalSessionLockSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `LessonProgress` (
	`id` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`courseId` varchar(255) NOT NULL,
	`lessonNodeId` varchar(255) NOT NULL,
	`completedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `LessonProgress_id` PRIMARY KEY(`id`),
	CONSTRAINT `LessonProgress_userId_courseId_lessonNodeId_key` UNIQUE(`userId`,`courseId`,`lessonNodeId`)
);
--> statement-breakpoint
CREATE TABLE `Order` (
	`id` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`courseId` varchar(255) NOT NULL,
	`status` text NOT NULL DEFAULT ('pending'),
	`totalAmount` double NOT NULL,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	`enrolledAt` datetime(3) DEFAULT CURRENT_TIMESTAMP,
	`expiresAt` datetime(3),
	CONSTRAINT `Order_id` PRIMARY KEY(`id`),
	CONSTRAINT `Order_userId_courseId_key` UNIQUE(`userId`,`courseId`)
);
--> statement-breakpoint
CREATE TABLE `Payment` (
	`id` varchar(255) NOT NULL,
	`orderId` varchar(255) NOT NULL,
	`phoneNumber` text NOT NULL,
	`transactionId` text NOT NULL,
	`amount` double NOT NULL,
	`status` text NOT NULL DEFAULT ('pending'),
	`submittedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`approvedAt` datetime(3),
	CONSTRAINT `Payment_id` PRIMARY KEY(`id`),
	CONSTRAINT `Payment_orderId_key` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `PaymentConfig` (
	`id` varchar(255) NOT NULL DEFAULT 'default',
	`provider` text NOT NULL DEFAULT ('bkash'),
	`sendMoneyNumber` text NOT NULL,
	`qrCodeUrl` text,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `PaymentConfig_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `_prisma_migrations` (
	`id` varchar(36) NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`finished_at` datetime(3),
	`migration_name` varchar(255) NOT NULL,
	`logs` text,
	`rolled_back_at` datetime(3),
	`started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`applied_steps_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `_prisma_migrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Question` (
	`id` varchar(255) NOT NULL,
	`quizId` varchar(255) NOT NULL,
	`questionText` text NOT NULL,
	`questionType` enum('mcq','true_false') NOT NULL,
	`optionA` text NOT NULL,
	`optionB` text NOT NULL,
	`optionC` text,
	`optionD` text,
	`correctOption` text NOT NULL,
	`explanation` text,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `Question_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Quiz` (
	`id` varchar(255) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`instructions` text,
	`categoryId` varchar(255),
	`durationMinutes` int NOT NULL,
	`numQuestionsToServe` int NOT NULL,
	`positionType` enum('best_attempt','last_attempt','first_attempt') NOT NULL DEFAULT 'best_attempt',
	`allowMultipleAttempts` boolean NOT NULL DEFAULT false,
	`maxAttempts` int,
	`allowNegativeMarking` boolean NOT NULL DEFAULT false,
	`negativeValue` double NOT NULL DEFAULT 0.25,
	`marksPerCorrect` double NOT NULL DEFAULT 1,
	`startDatetime` datetime(3),
	`endDatetime` datetime(3),
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`shuffleQuestions` boolean NOT NULL DEFAULT true,
	`shuffleOptions` boolean NOT NULL DEFAULT true,
	`createdBy` varchar(255) NOT NULL,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	`publishedAt` datetime(3),
	CONSTRAINT `Quiz_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `QuizAttempt` (
	`id` varchar(255) NOT NULL,
	`quizId` varchar(255) NOT NULL,
	`studentId` varchar(255) NOT NULL,
	`startedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`submittedAt` datetime(3),
	`timeTakenSeconds` int,
	`isAutoSubmitted` boolean NOT NULL DEFAULT false,
	`totalScore` double NOT NULL DEFAULT 0,
	`correctCount` int NOT NULL DEFAULT 0,
	`wrongCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`negativeMarks` double NOT NULL DEFAULT 0,
	`netScore` double NOT NULL DEFAULT 0,
	`percentageScore` double NOT NULL DEFAULT 0,
	`rank` int,
	`status` enum('in_progress','submitted','auto_submitted','abandoned') NOT NULL DEFAULT 'in_progress',
	`attemptNumber` int NOT NULL DEFAULT 1,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `QuizAttempt_id` PRIMARY KEY(`id`),
	CONSTRAINT `QuizAttempt_quizId_studentId_attemptNumber_key` UNIQUE(`quizId`,`studentId`,`attemptNumber`)
);
--> statement-breakpoint
CREATE TABLE `QuizCategory` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`displayName` text NOT NULL,
	`description` text,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `QuizCategory_id` PRIMARY KEY(`id`),
	CONSTRAINT `QuizCategory_name_key` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `QuizQuestionMapping` (
	`id` varchar(255) NOT NULL,
	`attemptId` varchar(255) NOT NULL,
	`questionId` varchar(255) NOT NULL,
	`displayOrder` int NOT NULL,
	`optionOrder` json NOT NULL,
	CONSTRAINT `QuizQuestionMapping_id` PRIMARY KEY(`id`),
	CONSTRAINT `QuizQuestionMapping_attemptId_questionId_key` UNIQUE(`attemptId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `Session` (
	`id` varchar(255) NOT NULL,
	`sessionToken` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`expires` datetime(3) NOT NULL,
	CONSTRAINT `Session_id` PRIMARY KEY(`id`),
	CONSTRAINT `Session_sessionToken_key` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `SessionLockSettings` (
	`id` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`autoLockFirstBrowser` boolean NOT NULL DEFAULT true,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `SessionLockSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `SessionLockSettings_userId_key` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `StudentModuleAvailability` (
	`id` varchar(255) NOT NULL,
	`courseId` varchar(255) NOT NULL,
	`userId` varchar(255) NOT NULL,
	`lessonNodeId` varchar(255) NOT NULL,
	`availabilityMode` text NOT NULL DEFAULT ('available'),
	`availableAt` datetime(3),
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `StudentModuleAvailability_id` PRIMARY KEY(`id`),
	CONSTRAINT `StudentModuleAvailability_courseId_userId_lessonNodeId_key` UNIQUE(`courseId`,`userId`,`lessonNodeId`)
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(255),
	`passwordHash` text,
	`fullName` text NOT NULL,
	`role` enum('admin','teacher','student') NOT NULL DEFAULT 'student',
	`bmdcNumber` text,
	`designation` text,
	`institution` text,
	`degrees` text,
	`profileImage` text,
	`emailVerified` boolean NOT NULL DEFAULT true,
	`emailVerificationTokenHash` text,
	`emailVerificationExpires` datetime(3),
	`passwordResetTokenHash` text,
	`passwordResetExpires` datetime(3),
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	`canManagePayments` boolean NOT NULL DEFAULT false,
	`isBanned` boolean NOT NULL DEFAULT false,
	`telegramChatId` text,
	`image` text,
	`isSessionLockedExempt` boolean NOT NULL DEFAULT false,
	CONSTRAINT `User_id` PRIMARY KEY(`id`),
	CONSTRAINT `User_email_key` UNIQUE(`email`),
	CONSTRAINT `User_phone_key` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `VerificationToken` (
	`identifier` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires` datetime(3) NOT NULL,
	CONSTRAINT `VerificationToken_identifier_token_key` UNIQUE(`identifier`,`token`),
	CONSTRAINT `VerificationToken_token_key` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `VideoLibraryNode` (
	`id` varchar(255) NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`duration` text,
	`parentId` varchar(255),
	`attachments` json,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `VideoLibraryNode_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `AttemptAnswer` ADD CONSTRAINT `AttemptAnswer_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `QuizAttempt`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `AttemptAnswer` ADD CONSTRAINT `AttemptAnswer_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `ContactSubmission` ADD CONSTRAINT `ContactSubmission_repliedByAdminId_fkey` FOREIGN KEY (`repliedByAdminId`) REFERENCES `User`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Course` ADD CONSTRAINT `Course_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Course` ADD CONSTRAINT `Course_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `CourseInstructor` ADD CONSTRAINT `CourseInstructor_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `DeviceSession` ADD CONSTRAINT `DeviceSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `LessonProgress` ADD CONSTRAINT `LessonProgress_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `LessonProgress` ADD CONSTRAINT `LessonProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Order` ADD CONSTRAINT `Order_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Question` ADD CONSTRAINT `Question_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Quiz` ADD CONSTRAINT `Quiz_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `QuizCategory`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Quiz` ADD CONSTRAINT `Quiz_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `QuizAttempt` ADD CONSTRAINT `QuizAttempt_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `QuizAttempt` ADD CONSTRAINT `QuizAttempt_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `QuizQuestionMapping` ADD CONSTRAINT `QuizQuestionMapping_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `QuizAttempt`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `QuizQuestionMapping` ADD CONSTRAINT `QuizQuestionMapping_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `SessionLockSettings` ADD CONSTRAINT `SessionLockSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `StudentModuleAvailability` ADD CONSTRAINT `StudentModuleAvailability_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `StudentModuleAvailability` ADD CONSTRAINT `StudentModuleAvailability_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `VideoLibraryNode` ADD CONSTRAINT `VideoLibraryNode_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `VideoLibraryNode`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `Account_userId_idx` ON `Account` (`userId`);--> statement-breakpoint
CREATE INDEX `AttemptAnswer_attemptId_idx` ON `AttemptAnswer` (`attemptId`);--> statement-breakpoint
CREATE INDEX `AttemptAnswer_questionId_idx` ON `AttemptAnswer` (`questionId`);--> statement-breakpoint
CREATE INDEX `ContactSubmission_createdAt_idx` ON `ContactSubmission` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ContactSubmission_email_idx` ON `ContactSubmission` (`email`);--> statement-breakpoint
CREATE INDEX `ContactSubmission_issueType_idx` ON `ContactSubmission` (`issueType`);--> statement-breakpoint
CREATE INDEX `ContactSubmission_repliedByAdminId_idx` ON `ContactSubmission` (`repliedByAdminId`);--> statement-breakpoint
CREATE INDEX `ContactSubmission_status_idx` ON `ContactSubmission` (`status`);--> statement-breakpoint
CREATE INDEX `Course_categoryId_idx` ON `Course` (`categoryId`);--> statement-breakpoint
CREATE INDEX `Course_status_idx` ON `Course` (`status`);--> statement-breakpoint
CREATE INDEX `Course_teacherId_idx` ON `Course` (`teacherId`);--> statement-breakpoint
CREATE INDEX `CourseInstructor_courseId_idx` ON `CourseInstructor` (`courseId`);--> statement-breakpoint
CREATE INDEX `DeviceSession_userId_deviceType_idx` ON `DeviceSession` (`userId`,`deviceType`);--> statement-breakpoint
CREATE INDEX `DeviceSession_userId_idx` ON `DeviceSession` (`userId`);--> statement-breakpoint
CREATE INDEX `EmailOtp_email_idx` ON `EmailOtp` (`email`);--> statement-breakpoint
CREATE INDEX `LessonProgress_courseId_idx` ON `LessonProgress` (`courseId`);--> statement-breakpoint
CREATE INDEX `LessonProgress_userId_courseId_idx` ON `LessonProgress` (`userId`,`courseId`);--> statement-breakpoint
CREATE INDEX `Order_courseId_idx` ON `Order` (`courseId`);--> statement-breakpoint
CREATE INDEX `Order_userId_idx` ON `Order` (`userId`);--> statement-breakpoint
CREATE INDEX `Question_quizId_idx` ON `Question` (`quizId`);--> statement-breakpoint
CREATE INDEX `Quiz_categoryId_idx` ON `Quiz` (`categoryId`);--> statement-breakpoint
CREATE INDEX `Quiz_status_idx` ON `Quiz` (`status`);--> statement-breakpoint
CREATE INDEX `Quiz_createdBy_idx` ON `Quiz` (`createdBy`);--> statement-breakpoint
CREATE INDEX `QuizAttempt_quizId_idx` ON `QuizAttempt` (`quizId`);--> statement-breakpoint
CREATE INDEX `QuizAttempt_studentId_idx` ON `QuizAttempt` (`studentId`);--> statement-breakpoint
CREATE INDEX `QuizAttempt_status_idx` ON `QuizAttempt` (`status`);--> statement-breakpoint
CREATE INDEX `QuizQuestionMapping_attemptId_idx` ON `QuizQuestionMapping` (`attemptId`);--> statement-breakpoint
CREATE INDEX `QuizQuestionMapping_questionId_idx` ON `QuizQuestionMapping` (`questionId`);--> statement-breakpoint
CREATE INDEX `Session_userId_idx` ON `Session` (`userId`);--> statement-breakpoint
CREATE INDEX `StudentModuleAvailability_courseId_lessonNodeId_idx` ON `StudentModuleAvailability` (`courseId`,`lessonNodeId`);--> statement-breakpoint
CREATE INDEX `StudentModuleAvailability_courseId_userId_idx` ON `StudentModuleAvailability` (`courseId`,`userId`);--> statement-breakpoint
CREATE INDEX `StudentModuleAvailability_userId_idx` ON `StudentModuleAvailability` (`userId`);--> statement-breakpoint
CREATE INDEX `VideoLibraryNode_parentId_idx` ON `VideoLibraryNode` (`parentId`);