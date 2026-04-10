CREATE TABLE StudentModuleAvailability (
  id VARCHAR(191) NOT NULL,
  courseId VARCHAR(191) NOT NULL,
  userId VARCHAR(191) NOT NULL,
  lessonNodeId VARCHAR(191) NOT NULL,
  availabilityMode VARCHAR(191) NOT NULL DEFAULT 'available',
  availableAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX StudentModuleAvailability_courseId_userId_lessonNodeId_key (courseId, userId, lessonNodeId),
  INDEX StudentModuleAvailability_courseId_userId_idx (courseId, userId),
  INDEX StudentModuleAvailability_courseId_lessonNodeId_idx (courseId, lessonNodeId),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE StudentModuleAvailability
  ADD CONSTRAINT StudentModuleAvailability_courseId_fkey
    FOREIGN KEY (courseId) REFERENCES Course(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT StudentModuleAvailability_userId_fkey
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE;
