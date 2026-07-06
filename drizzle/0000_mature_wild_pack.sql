CREATE TABLE `Account` (
	`id` varchar(30) NOT NULL,
	`userId` varchar(30) NOT NULL,
	`type` varchar(255) NOT NULL,
	`provider` varchar(255) NOT NULL,
	`providerAccountId` varchar(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` int,
	`token_type` varchar(255),
	`scope` varchar(255),
	`id_token` text,
	`session_state` varchar(255),
	CONSTRAINT `Account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Category` (
	`id` varchar(30) NOT NULL,
	`name` varchar(255) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Category_id` PRIMARY KEY(`id`),
	CONSTRAINT `Category_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `ContactSubmission` (
	`id` varchar(30) NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(255) NOT NULL,
	`issueType` enum('query','technical_assistance','billing','course_access','other') NOT NULL,
	`subject` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`imageUrls` text,
	`status` enum('open','in_review','responded','closed') NOT NULL DEFAULT 'open',
	`adminReply` text,
	`adminReplySentAt` datetime,
	`repliedByAdminId` varchar(30),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ContactSubmission_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `CourseInstructor` (
	`id` varchar(30) NOT NULL,
	`courseId` varchar(30) NOT NULL,
	`name` varchar(255) NOT NULL,
	`designation` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`imageUrl` varchar(1024),
	CONSTRAINT `CourseInstructor_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Course` (
	`id` varchar(30) NOT NULL,
	`slug` varchar(255),
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`overview` text,
	`categoryId` varchar(30),
	`price` float NOT NULL,
	`salePrice` float,
	`instructor` varchar(255) NOT NULL,
	`language` varchar(255),
	`imageUrl` varchar(1024),
	`duration` varchar(255) NOT NULL,
	`courseStartDate` datetime,
	`learningOutcomes` text,
	`teacherId` varchar(30),
	`status` enum('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
	`timezone` varchar(255) NOT NULL DEFAULT 'Asia/Dhaka',
	`releaseMode` enum('fixed_interval','groups_per_week','day_of_week','explicit_dates','instant'),
	`releaseStartAt` datetime,
	`releaseIntervalDays` int,
	`releaseGroupsPerWeek` int,
	`releaseGroupDates` text,
	`curriculumJson` json,
	`publishedAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`isFeatured` boolean NOT NULL DEFAULT false,
	`releaseDaysOfWeek` varchar(255),
	CONSTRAINT `Course_id` PRIMARY KEY(`id`),
	CONSTRAINT `Course_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `DeviceSession` (
	`id` varchar(30) NOT NULL,
	`userId` varchar(30) NOT NULL,
	`deviceType` enum('desktop','mobile','tablet') NOT NULL,
	`browserName` varchar(255) NOT NULL,
	`userAgent` text NOT NULL,
	`ipAddress` varchar(255) NOT NULL,
	`isLocked` boolean NOT NULL DEFAULT false,
	`loggedOutAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`deviceHash` varchar(255),
	`deviceLabel` varchar(255),
	`osInfo` varchar(255),
	`lockedByDeviceLabel` varchar(255),
	CONSTRAINT `DeviceSession_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `EmailOtp` (
	`id` varchar(30) NOT NULL,
	`email` varchar(255) NOT NULL,
	`otpHash` varchar(255) NOT NULL,
	`expiresAt` datetime NOT NULL,
	`verified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `EmailOtp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `GlobalSessionLockSettings` (
	`id` varchar(30) NOT NULL DEFAULT 'global',
	`autoLockFirstBrowser` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`allowDesktop` boolean NOT NULL DEFAULT true,
	`allowTablet` boolean NOT NULL DEFAULT true,
	`allowMobile` boolean NOT NULL DEFAULT true,
	`maxConcurrentSessions` int NOT NULL DEFAULT 3,
	CONSTRAINT `GlobalSessionLockSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `LessonProgress` (
	`id` varchar(30) NOT NULL,
	`userId` varchar(30) NOT NULL,
	`courseId` varchar(30) NOT NULL,
	`lessonNodeId` varchar(255) NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `LessonProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Order` (
	`id` varchar(30) NOT NULL,
	`userId` varchar(30) NOT NULL,
	`courseId` varchar(30) NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`totalAmount` float NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`enrolledAt` timestamp DEFAULT (now()),
	`expiresAt` datetime,
	CONSTRAINT `Order_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `PaymentConfig` (
	`id` varchar(30) NOT NULL DEFAULT 'default',
	`provider` varchar(255) NOT NULL DEFAULT 'bkash',
	`sendMoneyNumber` varchar(255) NOT NULL,
	`qrCodeUrl` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `PaymentConfig_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Payment` (
	`id` varchar(30) NOT NULL,
	`orderId` varchar(30) NOT NULL,
	`phoneNumber` varchar(255) NOT NULL,
	`transactionId` varchar(255) NOT NULL,
	`amount` float NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT 'pending',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedAt` datetime,
	CONSTRAINT `Payment_id` PRIMARY KEY(`id`),
	CONSTRAINT `Payment_orderId_unique` UNIQUE(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `SessionLockSettings` (
	`id` varchar(30) NOT NULL,
	`userId` varchar(30) NOT NULL,
	`autoLockFirstBrowser` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `SessionLockSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `SessionLockSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `Session` (
	`id` varchar(30) NOT NULL,
	`sessionToken` varchar(255) NOT NULL,
	`userId` varchar(30) NOT NULL,
	`expires` datetime NOT NULL,
	CONSTRAINT `Session_id` PRIMARY KEY(`id`),
	CONSTRAINT `Session_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `StudentModuleAvailability` (
	`id` varchar(30) NOT NULL,
	`courseId` varchar(30) NOT NULL,
	`userId` varchar(30) NOT NULL,
	`lessonNodeId` varchar(255) NOT NULL,
	`availabilityMode` varchar(255) NOT NULL DEFAULT 'available',
	`availableAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `StudentModuleAvailability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` varchar(30) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(255),
	`passwordHash` varchar(255),
	`fullName` varchar(255) NOT NULL,
	`role` enum('admin','teacher','student') NOT NULL DEFAULT 'student',
	`bmdcNumber` varchar(255),
	`designation` varchar(255),
	`institution` varchar(255),
	`degrees` varchar(255),
	`profileImage` varchar(1024),
	`emailVerified` boolean NOT NULL DEFAULT true,
	`emailVerificationTokenHash` varchar(255),
	`emailVerificationExpires` datetime,
	`passwordResetTokenHash` varchar(255),
	`passwordResetExpires` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`canManagePayments` boolean NOT NULL DEFAULT false,
	`isBanned` boolean NOT NULL DEFAULT false,
	`telegramChatId` varchar(255),
	`image` varchar(1024),
	`isSessionLockedExempt` boolean NOT NULL DEFAULT false,
	CONSTRAINT `User_id` PRIMARY KEY(`id`),
	CONSTRAINT `User_email_unique` UNIQUE(`email`),
	CONSTRAINT `User_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `VerificationToken` (
	`identifier` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`expires` datetime NOT NULL,
	CONSTRAINT `VerificationToken_identifier_token_pk` PRIMARY KEY(`identifier`,`token`)
);
--> statement-breakpoint
CREATE TABLE `VideoLibraryNode` (
	`id` varchar(30) NOT NULL,
	`title` varchar(255) NOT NULL,
	`type` varchar(255) NOT NULL,
	`url` varchar(1024),
	`duration` varchar(255),
	`parentId` varchar(30),
	`attachments` json,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `VideoLibraryNode_id` PRIMARY KEY(`id`)
);
