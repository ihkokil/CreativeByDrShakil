import {
  mysqlTable,
  varchar,
  text,
  boolean,
  timestamp,
  mysqlEnum,
  float,
  int,
  json,
  primaryKey,
  datetime
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

export const users = mysqlTable('User', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  email: varchar('email', { length: 255 }).unique().notNull(),
  phone: varchar('phone', { length: 255 }).unique(),
  passwordHash: varchar('passwordHash', { length: 255 }),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['admin', 'teacher', 'student']).default('student').notNull(),
  bmdcNumber: varchar('bmdcNumber', { length: 255 }),
  designation: varchar('designation', { length: 255 }),
  institution: varchar('institution', { length: 255 }),
  degrees: varchar('degrees', { length: 255 }),
  profileImage: varchar('profileImage', { length: 1024 }),
  emailVerified: boolean('emailVerified').default(true).notNull(),
  emailVerificationTokenHash: varchar('emailVerificationTokenHash', { length: 255 }),
  emailVerificationExpires: datetime('emailVerificationExpires'),
  passwordResetTokenHash: varchar('passwordResetTokenHash', { length: 255 }),
  passwordResetExpires: datetime('passwordResetExpires'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  canManagePayments: boolean('canManagePayments').default(false).notNull(),
  isBanned: boolean('isBanned').default(false).notNull(),
  telegramChatId: varchar('telegramChatId', { length: 255 }),
  image: varchar('image', { length: 1024 }),
  isSessionLockedExempt: boolean('isSessionLockedExempt').default(false).notNull(),
});

export const categories = mysqlTable('Category', {
  id: varchar('id', { length: 30 }).primaryKey(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  displayName: varchar('displayName', { length: 255 }).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const courses = mysqlTable('Course', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  slug: varchar('slug', { length: 255 }).unique(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  overview: text('overview'),
  categoryId: varchar('categoryId', { length: 30 }),
  price: float('price').notNull(),
  salePrice: float('salePrice'),
  instructor: varchar('instructor', { length: 255 }).notNull(),
  language: varchar('language', { length: 255 }),
  imageUrl: varchar('imageUrl', { length: 1024 }),
  duration: varchar('duration', { length: 255 }).notNull(),
  courseStartDate: datetime('courseStartDate'),
  learningOutcomes: text('learningOutcomes'),
  teacherId: varchar('teacherId', { length: 30 }),
  status: mysqlEnum('status', ['draft', 'scheduled', 'published', 'archived']).default('draft').notNull(),
  timezone: varchar('timezone', { length: 255 }).default('Asia/Dhaka').notNull(),
  releaseMode: mysqlEnum('releaseMode', ['fixed_interval', 'groups_per_week', 'day_of_week', 'explicit_dates', 'instant']),
  releaseStartAt: datetime('releaseStartAt'),
  releaseIntervalDays: int('releaseIntervalDays'),
  releaseGroupsPerWeek: int('releaseGroupsPerWeek'),
  releaseGroupDates: text('releaseGroupDates'),
  curriculumJson: json('curriculumJson'),
  publishedAt: datetime('publishedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  isFeatured: boolean('isFeatured').default(false).notNull(),
  releaseDaysOfWeek: varchar('releaseDaysOfWeek', { length: 255 }),
});

export const lessonProgress = mysqlTable('LessonProgress', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('userId', { length: 30 }).notNull(),
  courseId: varchar('courseId', { length: 30 }).notNull(),
  lessonNodeId: varchar('lessonNodeId', { length: 255 }).notNull(),
  completedAt: timestamp('completedAt').defaultNow().notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const studentModuleAvailability = mysqlTable('StudentModuleAvailability', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  courseId: varchar('courseId', { length: 30 }).notNull(),
  userId: varchar('userId', { length: 30 }).notNull(),
  lessonNodeId: varchar('lessonNodeId', { length: 255 }).notNull(),
  availabilityMode: varchar('availabilityMode', { length: 255 }).default('available').notNull(),
  availableAt: datetime('availableAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const courseInstructors = mysqlTable('CourseInstructor', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  courseId: varchar('courseId', { length: 30 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  designation: varchar('designation', { length: 255 }),
  sortOrder: int('sortOrder').default(0).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  imageUrl: varchar('imageUrl', { length: 1024 }),
});

export const orders = mysqlTable('Order', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('userId', { length: 30 }).notNull(),
  courseId: varchar('courseId', { length: 30 }).notNull(),
  status: varchar('status', { length: 255 }).default('pending').notNull(),
  totalAmount: float('totalAmount').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  enrolledAt: timestamp('enrolledAt').defaultNow(),
  expiresAt: datetime('expiresAt'),
});

export const payments = mysqlTable('Payment', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  orderId: varchar('orderId', { length: 30 }).unique().notNull(),
  phoneNumber: varchar('phoneNumber', { length: 255 }).notNull(),
  transactionId: varchar('transactionId', { length: 255 }).notNull(),
  amount: float('amount').notNull(),
  status: varchar('status', { length: 255 }).default('pending').notNull(),
  submittedAt: timestamp('submittedAt').defaultNow().notNull(),
  approvedAt: datetime('approvedAt'),
});

export const paymentConfigs = mysqlTable('PaymentConfig', {
  id: varchar('id', { length: 30 }).primaryKey().default('default'),
  provider: varchar('provider', { length: 255 }).default('bkash').notNull(),
  sendMoneyNumber: varchar('sendMoneyNumber', { length: 255 }).notNull(),
  qrCodeUrl: varchar('qrCodeUrl', { length: 1024 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const contactSubmissions = mysqlTable('ContactSubmission', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  fullName: varchar('fullName', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 255 }).notNull(),
  issueType: mysqlEnum('issueType', ['query', 'technical_assistance', 'billing', 'course_access', 'other']).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  message: text('message').notNull(),
  imageUrls: text('imageUrls'),
  status: mysqlEnum('status', ['open', 'in_review', 'responded', 'closed']).default('open').notNull(),
  adminReply: text('adminReply'),
  adminReplySentAt: datetime('adminReplySentAt'),
  repliedByAdminId: varchar('repliedByAdminId', { length: 30 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const deviceSessions = mysqlTable('DeviceSession', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('userId', { length: 30 }).notNull(),
  deviceType: mysqlEnum('deviceType', ['desktop', 'mobile', 'tablet']).notNull(),
  browserName: varchar('browserName', { length: 255 }).notNull(),
  userAgent: text('userAgent').notNull(),
  ipAddress: varchar('ipAddress', { length: 255 }).notNull(),
  isLocked: boolean('isLocked').default(false).notNull(),
  loggedOutAt: datetime('loggedOutAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  lastActivityAt: timestamp('lastActivityAt').defaultNow().notNull(),
  deviceHash: varchar('deviceHash', { length: 255 }),
  deviceLabel: varchar('deviceLabel', { length: 255 }),
  osInfo: varchar('osInfo', { length: 255 }),
  lockedByDeviceLabel: varchar('lockedByDeviceLabel', { length: 255 }),
});

export const sessionLockSettings = mysqlTable('SessionLockSettings', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('userId', { length: 30 }).unique().notNull(),
  autoLockFirstBrowser: boolean('autoLockFirstBrowser').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const globalSessionLockSettings = mysqlTable('GlobalSessionLockSettings', {
  id: varchar('id', { length: 30 }).primaryKey().default('global'),
  autoLockFirstBrowser: boolean('autoLockFirstBrowser').default(true).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
  allowDesktop: boolean('allowDesktop').default(true).notNull(),
  allowTablet: boolean('allowTablet').default(true).notNull(),
  allowMobile: boolean('allowMobile').default(true).notNull(),
  maxConcurrentSessions: int('maxConcurrentSessions').default(3).notNull(),
});

export const videoLibraryNodes = mysqlTable('VideoLibraryNode', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  title: varchar('title', { length: 255 }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  url: varchar('url', { length: 1024 }),
  duration: varchar('duration', { length: 255 }),
  parentId: varchar('parentId', { length: 30 }),
  attachments: json('attachments'),
  sortOrder: int('sortOrder').default(0).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});

export const emailOtps = mysqlTable('EmailOtp', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  email: varchar('email', { length: 255 }).notNull(),
  otpHash: varchar('otpHash', { length: 255 }).notNull(),
  expiresAt: datetime('expiresAt').notNull(),
  verified: boolean('verified').default(false).notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const accounts = mysqlTable('Account', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('userId', { length: 30 }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('providerAccountId', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: int('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
});

export const sessions = mysqlTable('Session', {
  id: varchar('id', { length: 30 }).primaryKey().$defaultFn(() => createId()),
  sessionToken: varchar('sessionToken', { length: 255 }).unique().notNull(),
  userId: varchar('userId', { length: 30 }).notNull(),
  expires: datetime('expires').notNull(),
});

export const verificationTokens = mysqlTable('VerificationToken', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: datetime('expires').notNull(),
}, (table) => {
  return [
    primaryKey({ columns: [table.identifier, table.token] })
  ]
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  contactReplies: many(contactSubmissions),
  teacherCourses: many(courses),
  deviceSessions: many(deviceSessions),
  lessonProgress: many(lessonProgress),
  orders: many(orders),
  sessions: many(sessions),
  sessionSettings: one(sessionLockSettings),
  moduleAvailabilityOverrides: many(studentModuleAvailability),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  teacher: one(users, {
    fields: [courses.teacherId],
    references: [users.id],
  }),
  instructors: many(courseInstructors),
  lessonProgress: many(lessonProgress),
  orders: many(orders),
  moduleAvailabilityOverrides: many(studentModuleAvailability),
}));

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  course: one(courses, {
    fields: [lessonProgress.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [lessonProgress.userId],
    references: [users.id],
  }),
}));

export const studentModuleAvailabilityRelations = relations(studentModuleAvailability, ({ one }) => ({
  course: one(courses, {
    fields: [studentModuleAvailability.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [studentModuleAvailability.userId],
    references: [users.id],
  }),
}));

export const courseInstructorsRelations = relations(courseInstructors, ({ one }) => ({
  course: one(courses, {
    fields: [courseInstructors.courseId],
    references: [courses.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  course: one(courses, {
    fields: [orders.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  payment: one(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const contactSubmissionsRelations = relations(contactSubmissions, ({ one }) => ({
  repliedByAdmin: one(users, {
    fields: [contactSubmissions.repliedByAdminId],
    references: [users.id],
  }),
}));

export const deviceSessionsRelations = relations(deviceSessions, ({ one }) => ({
  user: one(users, {
    fields: [deviceSessions.userId],
    references: [users.id],
  }),
}));

export const sessionLockSettingsRelations = relations(sessionLockSettings, ({ one }) => ({
  user: one(users, {
    fields: [sessionLockSettings.userId],
    references: [users.id],
  }),
}));

export const videoLibraryNodesRelations = relations(videoLibraryNodes, ({ one, many }) => ({
  parent: one(videoLibraryNodes, {
    fields: [videoLibraryNodes.parentId],
    references: [videoLibraryNodes.id],
  }),
  children: many(videoLibraryNodes),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
