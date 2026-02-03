CREATE TABLE `ContactSubmission` (
  `id` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `issueType` ENUM('query', 'technical_assistance', 'billing', 'course_access', 'other') NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `message` LONGTEXT NOT NULL,
  `imageUrls` JSON NULL,
  `status` ENUM('open', 'in_review', 'responded', 'closed') NOT NULL DEFAULT 'open',
  `adminReply` LONGTEXT NULL,
  `adminReplySentAt` DATETIME(3) NULL,
  `repliedByAdminId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `ContactSubmission_status_idx`(`status`),
  INDEX `ContactSubmission_issueType_idx`(`issueType`),
  INDEX `ContactSubmission_createdAt_idx`(`createdAt`),
  INDEX `ContactSubmission_email_idx`(`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ContactSubmission`
  ADD CONSTRAINT `ContactSubmission_repliedByAdminId_fkey`
  FOREIGN KEY (`repliedByAdminId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
