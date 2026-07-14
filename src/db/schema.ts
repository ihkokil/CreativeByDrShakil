import { mysqlTable, index, uniqueIndex, foreignKey, text, datetime, int, double, boolean, varchar, mysqlEnum, json } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const lessonProgress = mysqlTable("LessonProgress", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar({ length: 255 }).notNull(),
	courseId: varchar({ length: 255 }).notNull(),
	lessonNodeId: varchar({ length: 255 }).notNull(),
	completedAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("LessonProgress_courseId_idx").on(table.courseId),
	index("LessonProgress_userId_courseId_idx").on(table.userId, table.courseId),
	uniqueIndex("LessonProgress_userId_courseId_lessonNodeId_key").on(table.userId, table.courseId, table.lessonNodeId),
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

export const studentModuleAvailability = mysqlTable("StudentModuleAvailability", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	courseId: varchar({ length: 255 }).notNull(),
	userId: varchar({ length: 255 }).notNull(),
	lessonNodeId: varchar({ length: 255 }).notNull(),
	availabilityMode: text().default('available').notNull(),
	availableAt: datetime({ fsp: 3, mode: 'string' }),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("StudentModuleAvailability_courseId_lessonNodeId_idx").on(table.courseId, table.lessonNodeId),
	index("StudentModuleAvailability_courseId_userId_idx").on(table.courseId, table.userId),
	uniqueIndex("StudentModuleAvailability_courseId_userId_lessonNodeId_key").on(table.courseId, table.userId, table.lessonNodeId),
	index("StudentModuleAvailability_userId_idx").on(table.userId),
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

export const courseInstructor = mysqlTable("CourseInstructor", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	courseId: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	designation: text(),
	sortOrder: int().default(0).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	imageUrl: text(),
}, (table) => [
	index("CourseInstructor_courseId_idx").on(table.courseId),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [course.id],
			name: "CourseInstructor_courseId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const payment = mysqlTable("Payment", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	orderId: varchar({ length: 255 }).notNull(),
	phoneNumber: text().notNull(),
	transactionId: text().notNull(),
	amount: double().notNull(),
	status: text().default('pending').notNull(),
	submittedAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	approvedAt: datetime({ fsp: 3, mode: 'string' }),
}, (table) => [
	uniqueIndex("Payment_orderId_key").on(table.orderId),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [order.id],
			name: "Payment_orderId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const contactSubmission = mysqlTable("ContactSubmission", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	fullName: text().notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: text().notNull(),
	issueType: mysqlEnum("issueType", ['query', 'technical_assistance', 'billing', 'course_access', 'other']).notNull(),
	subject: text().notNull(),
	message: text().notNull(),
	imageUrls: text(),
	status: mysqlEnum("status", ['open', 'in_review', 'responded', 'closed']).default('open').notNull(),
	adminReply: text(),
	adminReplySentAt: datetime({ fsp: 3, mode: 'string' }),
	repliedByAdminId: varchar({ length: 255 }),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("ContactSubmission_createdAt_idx").on(table.createdAt),
	index("ContactSubmission_email_idx").on(table.email),
	index("ContactSubmission_issueType_idx").on(table.issueType),
	index("ContactSubmission_repliedByAdminId_idx").on(table.repliedByAdminId),
	index("ContactSubmission_status_idx").on(table.status),
	foreignKey({
			columns: [table.repliedByAdminId],
			foreignColumns: [user.id],
			name: "ContactSubmission_repliedByAdminId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const paymentConfig = mysqlTable("PaymentConfig", {
	id: varchar({ length: 255 }).default('default').primaryKey().notNull(),
	provider: text().default('bkash').notNull(),
	sendMoneyNumber: text().notNull(),
	qrCodeUrl: text(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
});

export const deviceSession = mysqlTable("DeviceSession", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar({ length: 255 }).notNull(),
	deviceType: mysqlEnum("deviceType", ['desktop', 'mobile', 'tablet']).notNull(),
	browserName: text().notNull(),
	userAgent: text().notNull(),
	ipAddress: text().notNull(),
	isLocked: boolean().default(false).notNull(),
	loggedOutAt: datetime({ fsp: 3, mode: 'string' }),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lastActivityAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	deviceHash: text(),
	deviceLabel: text(),
	osInfo: text(),
	lockedByDeviceLabel: text(),
}, (table) => [
	index("DeviceSession_userId_deviceType_idx").on(table.userId, table.deviceType),
	index("DeviceSession_userId_idx").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "DeviceSession_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const user = mysqlTable("User", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	phone: varchar({ length: 255 }),
	passwordHash: text(),
	fullName: text().notNull(),
	role: mysqlEnum("role", ['admin', 'teacher', 'student']).default('student').notNull(),
	bmdcNumber: text(),
	designation: text(),
	institution: text(),
	degrees: text(),
	profileImage: text(),
	emailVerified: boolean().default(true).notNull(),
	emailVerificationTokenHash: text(),
	emailVerificationExpires: datetime({ fsp: 3, mode: 'string' }),
	passwordResetTokenHash: text(),
	passwordResetExpires: datetime({ fsp: 3, mode: 'string' }),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	canManagePayments: boolean().default(false).notNull(),
	isBanned: boolean().default(false).notNull(),
	telegramChatId: text(),
	image: text(),
	isSessionLockedExempt: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("User_email_key").on(table.email),
	uniqueIndex("User_phone_key").on(table.phone),
]);

export const course = mysqlTable("Course", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	slug: varchar({ length: 255 }),
	title: text().notNull(),
	description: text().notNull(),
	overview: text(),
	categoryId: varchar({ length: 255 }),
	price: double().notNull(),
	salePrice: double(),
	instructor: text().notNull(),
	language: text(),
	imageUrl: text(),
	duration: text().notNull(),
	courseStartDate: datetime({ fsp: 3, mode: 'string' }),
	learningOutcomes: text(),
	teacherId: varchar({ length: 255 }),
	status: mysqlEnum("status", ['draft', 'scheduled', 'published', 'archived']).default('draft').notNull(),
	timezone: text().default('Asia/Dhaka').notNull(),
	releaseMode: mysqlEnum("releaseMode", ['fixed_interval', 'groups_per_week', 'day_of_week', 'explicit_dates', 'instant']),
	releaseStartAt: datetime({ fsp: 3, mode: 'string' }),
	releaseIntervalDays: int(),
	releaseGroupsPerWeek: int(),
	releaseGroupDates: text(),
	curriculumJson: text(),
	publishedAt: datetime({ fsp: 3, mode: 'string' }),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	isFeatured: boolean().default(false).notNull(),
	releaseDaysOfWeek: text(),
}, (table) => [
	index("Course_categoryId_idx").on(table.categoryId),
	uniqueIndex("Course_slug_key").on(table.slug),
	index("Course_status_idx").on(table.status),
	index("Course_teacherId_idx").on(table.teacherId),
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

export const globalSessionLockSettings = mysqlTable("GlobalSessionLockSettings", {
	id: varchar({ length: 255 }).default('global').primaryKey().notNull(),
	autoLockFirstBrowser: boolean().default(true).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	allowDesktop: boolean().default(true).notNull(),
	allowTablet: boolean().default(true).notNull(),
	allowMobile: boolean().default(true).notNull(),
	maxConcurrentSessions: int().default(3).notNull(),
});

export const sessionLockSettings = mysqlTable("SessionLockSettings", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar({ length: 255 }).notNull(),
	autoLockFirstBrowser: boolean().default(true).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	uniqueIndex("SessionLockSettings_userId_key").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SessionLockSettings_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const category = mysqlTable("Category", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	displayName: text().notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	uniqueIndex("Category_name_key").on(table.name),
]);

export const videoLibraryNode = mysqlTable("VideoLibraryNode", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	title: text().notNull(),
	type: text().notNull(),
	url: text(),
	duration: text(),
	parentId: varchar({ length: 255 }),
	attachments: json().$type<{ name: string; url: string; type?: string; size?: number }[]>(),
	sortOrder: int().default(0).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("VideoLibraryNode_parentId_idx").on(table.parentId),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "VideoLibraryNode_parentId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const emailOtp = mysqlTable("EmailOtp", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	email: varchar({ length: 255 }).notNull(),
	otpHash: text().notNull(),
	expiresAt: datetime({ fsp: 3, mode: 'string' }).notNull(),
	verified: boolean().default(false).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("EmailOtp_email_idx").on(table.email),
]);

export const prismaMigrations = mysqlTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: datetime("finished_at", { fsp: 3, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: datetime("rolled_back_at", { fsp: 3, mode: 'string' }),
	startedAt: datetime("started_at", { fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	appliedStepsCount: int("applied_steps_count").default(0).notNull(),
});

export const order = mysqlTable("Order", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar({ length: 255 }).notNull(),
	courseId: varchar({ length: 255 }).notNull(),
	status: text().default('pending').notNull(),
	totalAmount: double().notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	enrolledAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	expiresAt: datetime({ fsp: 3, mode: 'string' }),
}, (table) => [
	index("Order_courseId_idx").on(table.courseId),
	uniqueIndex("Order_userId_courseId_key").on(table.userId, table.courseId),
	index("Order_userId_idx").on(table.userId),
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

export const verificationToken = mysqlTable("VerificationToken", {
	identifier: varchar({ length: 255 }).notNull(),
	token: varchar({ length: 255 }).notNull(),
	expires: datetime({ fsp: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("VerificationToken_identifier_token_key").on(table.identifier, table.token),
	uniqueIndex("VerificationToken_token_key").on(table.token),
]);

export const account = mysqlTable("Account", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar({ length: 255 }).notNull(),
	type: text().notNull(),
	provider: varchar({ length: 255 }).notNull(),
	providerAccountId: varchar({ length: 255 }).notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: int("expires_at"),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
}, (table) => [
	uniqueIndex("Account_provider_providerAccountId_key").on(table.provider, table.providerAccountId),
	index("Account_userId_idx").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const session = mysqlTable("Session", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	sessionToken: varchar({ length: 255 }).notNull(),
	userId: varchar({ length: 255 }).notNull(),
	expires: datetime({ fsp: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("Session_sessionToken_key").on(table.sessionToken),
	index("Session_userId_idx").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const quizCategory = mysqlTable("QuizCategory", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	displayName: text().notNull(),
	description: text(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	uniqueIndex("QuizCategory_name_key").on(table.name),
]);

export const quiz = mysqlTable("Quiz", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	instructions: text(),
	categoryId: varchar({ length: 255 }),
	durationMinutes: int().notNull(),
	numQuestionsToServe: int().notNull(),
	positionType: mysqlEnum("positionType", ['best_attempt', 'last_attempt', 'first_attempt']).default('best_attempt').notNull(),
	allowMultipleAttempts: boolean().default(false).notNull(),
	maxAttempts: int(),
	allowNegativeMarking: boolean().default(false).notNull(),
	negativeValue: double().default(0.25).notNull(),
	marksPerCorrect: double().default(1).notNull(),
	startDatetime: datetime({ fsp: 3, mode: 'string' }),
	endDatetime: datetime({ fsp: 3, mode: 'string' }),
	status: mysqlEnum("status", ['draft', 'published', 'archived']).default('draft').notNull(),
	shuffleQuestions: boolean().default(true).notNull(),
	shuffleOptions: boolean().default(true).notNull(),
	createdBy: varchar({ length: 255 }).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
	publishedAt: datetime({ fsp: 3, mode: 'string' }),
}, (table) => [
	index("Quiz_categoryId_idx").on(table.categoryId),
	index("Quiz_status_idx").on(table.status),
	index("Quiz_createdBy_idx").on(table.createdBy),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [quizCategory.id],
			name: "Quiz_categoryId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "Quiz_createdBy_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const question = mysqlTable("Question", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	quizId: varchar({ length: 255 }).notNull(),
	questionText: text().notNull(),
	questionType: mysqlEnum("questionType", ['mcq', 'true_false']).notNull(),
	optionA: text().notNull(),
	optionB: text().notNull(),
	optionC: text(),
	optionD: text(),
	correctOption: text().notNull(),
	explanation: text(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("Question_quizId_idx").on(table.quizId),
	foreignKey({
			columns: [table.quizId],
			foreignColumns: [quiz.id],
			name: "Question_quizId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const quizAttempt = mysqlTable("QuizAttempt", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	quizId: varchar({ length: 255 }).notNull(),
	studentId: varchar({ length: 255 }).notNull(),
	startedAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	submittedAt: datetime({ fsp: 3, mode: 'string' }),
	timeTakenSeconds: int(),
	isAutoSubmitted: boolean().default(false).notNull(),
	totalScore: double().default(0).notNull(),
	correctCount: int().default(0).notNull(),
	wrongCount: int().default(0).notNull(),
	skippedCount: int().default(0).notNull(),
	negativeMarks: double().default(0).notNull(),
	netScore: double().default(0).notNull(),
	percentageScore: double().default(0).notNull(),
	rank: int(),
	status: mysqlEnum("status", ['in_progress', 'submitted', 'auto_submitted', 'abandoned']).default('in_progress').notNull(),
	attemptNumber: int().default(1).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: datetime({ fsp: 3, mode: 'string' }).$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
	index("QuizAttempt_quizId_idx").on(table.quizId),
	index("QuizAttempt_studentId_idx").on(table.studentId),
	index("QuizAttempt_status_idx").on(table.status),
	uniqueIndex("QuizAttempt_quizId_studentId_attemptNumber_key").on(table.quizId, table.studentId, table.attemptNumber),
	foreignKey({
			columns: [table.quizId],
			foreignColumns: [quiz.id],
			name: "QuizAttempt_quizId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [user.id],
			name: "QuizAttempt_studentId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const attemptAnswer = mysqlTable("AttemptAnswer", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	attemptId: varchar({ length: 255 }).notNull(),
	questionId: varchar({ length: 255 }).notNull(),
	selectedOption: text(),
	isCorrect: boolean().default(false).notNull(),
	createdAt: datetime({ fsp: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("AttemptAnswer_attemptId_idx").on(table.attemptId),
	index("AttemptAnswer_questionId_idx").on(table.questionId),
	uniqueIndex("AttemptAnswer_attemptId_questionId_key").on(table.attemptId, table.questionId),
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [quizAttempt.id],
			name: "AttemptAnswer_attemptId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [question.id],
			name: "AttemptAnswer_questionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const quizQuestionMapping = mysqlTable("QuizQuestionMapping", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	attemptId: varchar({ length: 255 }).notNull(),
	questionId: varchar({ length: 255 }).notNull(),
	displayOrder: int().notNull(),
	optionOrder: json().notNull(),
}, (table) => [
	index("QuizQuestionMapping_attemptId_idx").on(table.attemptId),
	index("QuizQuestionMapping_questionId_idx").on(table.questionId),
	uniqueIndex("QuizQuestionMapping_attemptId_questionId_key").on(table.attemptId, table.questionId),
	foreignKey({
			columns: [table.attemptId],
			foreignColumns: [quizAttempt.id],
			name: "QuizQuestionMapping_attemptId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [question.id],
			name: "QuizQuestionMapping_questionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);
