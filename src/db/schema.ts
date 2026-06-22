import { pgTable, index, uniqueIndex, foreignKey, text, timestamp, integer, doublePrecision, boolean, varchar, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const contactIssueType = pgEnum("ContactIssueType", ['query', 'technical_assistance', 'billing', 'course_access', 'other'])
export const contactSubmissionStatus = pgEnum("ContactSubmissionStatus", ['open', 'in_review', 'responded', 'closed'])
export const coursePublishStatus = pgEnum("CoursePublishStatus", ['draft', 'scheduled', 'published', 'archived'])
export const courseReleaseMode = pgEnum("CourseReleaseMode", ['fixed_interval', 'groups_per_week', 'day_of_week', 'explicit_dates', 'instant'])
export const deviceType = pgEnum("DeviceType", ['desktop', 'mobile'])
export const userRole = pgEnum("UserRole", ['admin', 'teacher', 'student'])


export const lessonProgress = pgTable("LessonProgress", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	courseId: text().notNull(),
	lessonNodeId: text().notNull(),
	completedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("LessonProgress_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	index("LessonProgress_userId_courseId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.courseId.asc().nullsLast().op("text_ops")),
	uniqueIndex("LessonProgress_userId_courseId_lessonNodeId_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.courseId.asc().nullsLast().op("text_ops"), table.lessonNodeId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "LessonProgress_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "LessonProgress_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const studentModuleAvailability = pgTable("StudentModuleAvailability", {
	id: text().primaryKey().notNull(),
	courseId: text().notNull(),
	userId: text().notNull(),
	lessonNodeId: text().notNull(),
	availabilityMode: text().default('available').notNull(),
	availableAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("StudentModuleAvailability_courseId_lessonNodeId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops"), table.lessonNodeId.asc().nullsLast().op("text_ops")),
	index("StudentModuleAvailability_courseId_userId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	uniqueIndex("StudentModuleAvailability_courseId_userId_lessonNodeId_key").using("btree", table.courseId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops"), table.lessonNodeId.asc().nullsLast().op("text_ops")),
	index("StudentModuleAvailability_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "StudentModuleAvailability_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "StudentModuleAvailability_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const courseInstructor = pgTable("CourseInstructor", {
	id: text().primaryKey().notNull(),
	courseId: text().notNull(),
	name: text().notNull(),
	designation: text(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	imageUrl: text(),
}, (table) => [
	index("CourseInstructor_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "CourseInstructor_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const payment = pgTable("Payment", {
	id: text().primaryKey().notNull(),
	orderId: text().notNull(),
	phoneNumber: text().notNull(),
	transactionId: text().notNull(),
	amount: doublePrecision().notNull(),
	status: text().default('pending').notNull(),
	submittedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	approvedAt: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	uniqueIndex("Payment_orderId_key").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [order.id],
			name: "Payment_orderId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const contactSubmission = pgTable("ContactSubmission", {
	id: text().primaryKey().notNull(),
	fullName: text().notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	issueType: contactIssueType().notNull(),
	subject: text().notNull(),
	message: text().notNull(),
	imageUrls: text(),
	status: contactSubmissionStatus().default('open').notNull(),
	adminReply: text(),
	adminReplySentAt: timestamp({ precision: 3, mode: 'string' }),
	repliedByAdminId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("ContactSubmission_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("ContactSubmission_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ContactSubmission_issueType_idx").using("btree", table.issueType.asc().nullsLast().op("enum_ops")),
	index("ContactSubmission_repliedByAdminId_idx").using("btree", table.repliedByAdminId.asc().nullsLast().op("text_ops")),
	index("ContactSubmission_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.repliedByAdminId],
			foreignColumns: [user.id],
			name: "ContactSubmission_repliedByAdminId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const paymentConfig = pgTable("PaymentConfig", {
	id: text().default('default').primaryKey().notNull(),
	provider: text().default('bkash').notNull(),
	sendMoneyNumber: text().notNull(),
	qrCodeUrl: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
});

export const deviceSession = pgTable("DeviceSession", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	deviceType: deviceType().notNull(),
	browserName: text().notNull(),
	userAgent: text().notNull(),
	ipAddress: text().notNull(),
	isLocked: boolean().default(false).notNull(),
	loggedOutAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lastActivityAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("DeviceSession_userId_deviceType_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.deviceType.asc().nullsLast().op("text_ops")),
	index("DeviceSession_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DeviceSession_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const user = pgTable("User", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	phone: text(),
	passwordHash: text(),
	fullName: text().notNull(),
	role: userRole().default('student').notNull(),
	bmdcNumber: text(),
	designation: text(),
	institution: text(),
	degrees: text(),
	profileImage: text(),
	emailVerified: boolean().default(true).notNull(),
	emailVerificationTokenHash: text(),
	emailVerificationExpires: timestamp({ precision: 3, mode: 'string' }),
	passwordResetTokenHash: text(),
	passwordResetExpires: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	canManagePayments: boolean().default(false).notNull(),
	telegramChatId: text(),
	image: text(),
}, (table) => [
	uniqueIndex("User_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	uniqueIndex("User_phone_key").using("btree", table.phone.asc().nullsLast().op("text_ops")),
]);

export const course = pgTable("Course", {
	id: text().primaryKey().notNull(),
	slug: text(),
	title: text().notNull(),
	description: text().notNull(),
	overview: text(),
	categoryId: text(),
	price: doublePrecision().notNull(),
	salePrice: doublePrecision(),
	instructor: text().notNull(),
	language: text(),
	imageUrl: text(),
	duration: text().notNull(),
	courseStartDate: timestamp({ precision: 3, mode: 'string' }),
	learningOutcomes: text(),
	teacherId: text(),
	status: coursePublishStatus().default('draft').notNull(),
	timezone: text().default('Asia/Dhaka').notNull(),
	releaseMode: courseReleaseMode(),
	releaseStartAt: timestamp({ precision: 3, mode: 'string' }),
	releaseIntervalDays: integer(),
	releaseGroupsPerWeek: integer(),
	releaseGroupDates: text(),
	curriculumJson: text(),
	publishedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	isFeatured: boolean().default(false).notNull(),
	releaseDaysOfWeek: text(),
}, (table) => [
	index("Course_categoryId_idx").using("btree", table.categoryId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Course_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("Course_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("Course_teacherId_idx").using("btree", table.teacherId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [category.id],
			name: "Course_categoryId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.teacherId],
			foreignColumns: [user.id],
			name: "Course_teacherId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const globalSessionLockSettings = pgTable("GlobalSessionLockSettings", {
	id: text().default('global').primaryKey().notNull(),
	autoLockFirstBrowser: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
});

export const sessionLockSettings = pgTable("SessionLockSettings", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	autoLockFirstBrowser: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	uniqueIndex("SessionLockSettings_userId_key").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SessionLockSettings_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const category = pgTable("Category", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	displayName: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	uniqueIndex("Category_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const videoLibraryNode = pgTable("VideoLibraryNode", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	type: text().notNull(),
	url: text(),
	duration: text(),
	parentId: text(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("VideoLibraryNode_parentId_idx").using("btree", table.parentId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "VideoLibraryNode_parentId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const emailOtp = pgTable("EmailOtp", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	otpHash: text().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	verified: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("EmailOtp_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const order = pgTable("Order", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	courseId: text().notNull(),
	status: text().default('pending').notNull(),
	totalAmount: doublePrecision().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	enrolledAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	expiresAt: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	index("Order_courseId_idx").using("btree", table.courseId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Order_userId_courseId_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.courseId.asc().nullsLast().op("text_ops")),
	index("Order_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "Order_courseId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Order_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const verificationToken = pgTable("VerificationToken", {
	identifier: text().notNull(),
	token: text().notNull(),
	expires: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("VerificationToken_identifier_token_key").using("btree", table.identifier.asc().nullsLast().op("text_ops"), table.token.asc().nullsLast().op("text_ops")),
	uniqueIndex("VerificationToken_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
]);

export const account = pgTable("Account", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	type: text().notNull(),
	provider: text().notNull(),
	providerAccountId: text().notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
}, (table) => [
	uniqueIndex("Account_provider_providerAccountId_key").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.providerAccountId.asc().nullsLast().op("text_ops")),
	index("Account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const session = pgTable("Session", {
	id: text().primaryKey().notNull(),
	sessionToken: text().notNull(),
	userId: text().notNull(),
	expires: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("Session_sessionToken_key").using("btree", table.sessionToken.asc().nullsLast().op("text_ops")),
	index("Session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);
