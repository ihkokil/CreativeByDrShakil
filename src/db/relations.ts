import { relations } from "drizzle-orm/relations";
import { course, lessonProgress, user, studentModuleAvailability, courseInstructor, order, payment, contactSubmission, deviceSession, category, sessionLockSettings, videoLibraryNode, account, session, quizCategory, quiz, question, quizAttempt, attemptAnswer, quizQuestionMapping } from "./schema";

export const lessonProgressRelations = relations(lessonProgress, ({one}) => ({
	course: one(course, {
		fields: [lessonProgress.courseId],
		references: [course.id]
	}),
	user: one(user, {
		fields: [lessonProgress.userId],
		references: [user.id]
	}),
}));

export const courseRelations = relations(course, ({one, many}) => ({
	lessonProgresses: many(lessonProgress),
	studentModuleAvailabilities: many(studentModuleAvailability),
	instructors: many(courseInstructor),
	category: one(category, {
		fields: [course.categoryId],
		references: [category.id]
	}),
	teacher: one(user, {
		fields: [course.teacherId],
		references: [user.id]
	}),
	orders: many(order),
}));

export const userRelations = relations(user, ({many, one}) => ({
	lessonProgresses: many(lessonProgress),
	studentModuleAvailabilities: many(studentModuleAvailability),
	contactSubmissions: many(contactSubmission),
	deviceSessions: many(deviceSession),
	courses: many(course),
	sessionLockSettings: many(sessionLockSettings),
	orders: many(order),
	accounts: many(account),
	sessions: many(session),
	quizzesCreated: many(quiz),
	quizAttempts: many(quizAttempt),
}));

export const studentModuleAvailabilityRelations = relations(studentModuleAvailability, ({one}) => ({
	course: one(course, {
		fields: [studentModuleAvailability.courseId],
		references: [course.id]
	}),
	user: one(user, {
		fields: [studentModuleAvailability.userId],
		references: [user.id]
	}),
}));

export const courseInstructorRelations = relations(courseInstructor, ({one}) => ({
	course: one(course, {
		fields: [courseInstructor.courseId],
		references: [course.id]
	}),
}));

export const paymentRelations = relations(payment, ({one}) => ({
	order: one(order, {
		fields: [payment.orderId],
		references: [order.id]
	}),
}));

export const orderRelations = relations(order, ({one, many}) => ({
	payments: many(payment),
	course: one(course, {
		fields: [order.courseId],
		references: [course.id]
	}),
	user: one(user, {
		fields: [order.userId],
		references: [user.id]
	}),
}));

export const contactSubmissionRelations = relations(contactSubmission, ({one}) => ({
	repliedByAdmin: one(user, {
		fields: [contactSubmission.repliedByAdminId],
		references: [user.id]
	}),
}));

export const deviceSessionRelations = relations(deviceSession, ({one}) => ({
	user: one(user, {
		fields: [deviceSession.userId],
		references: [user.id]
	}),
}));

export const categoryRelations = relations(category, ({many}) => ({
	courses: many(course),
}));

export const sessionLockSettingsRelations = relations(sessionLockSettings, ({one}) => ({
	user: one(user, {
		fields: [sessionLockSettings.userId],
		references: [user.id]
	}),
}));

export const videoLibraryNodeRelations = relations(videoLibraryNode, ({one, many}) => ({
	videoLibraryNode: one(videoLibraryNode, {
		fields: [videoLibraryNode.parentId],
		references: [videoLibraryNode.id],
		relationName: "videoLibraryNode_parentId_videoLibraryNode_id"
	}),
	videoLibraryNodes: many(videoLibraryNode, {
		relationName: "videoLibraryNode_parentId_videoLibraryNode_id"
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const quizCategoryRelations = relations(quizCategory, ({many}) => ({
	quizzes: many(quiz),
}));

export const quizRelations = relations(quiz, ({one, many}) => ({
	category: one(quizCategory, {
		fields: [quiz.categoryId],
		references: [quizCategory.id]
	}),
	creator: one(user, {
		fields: [quiz.createdBy],
		references: [user.id]
	}),
	questions: many(question),
	attempts: many(quizAttempt),
}));

export const questionRelations = relations(question, ({one, many}) => ({
	quiz: one(quiz, {
		fields: [question.quizId],
		references: [quiz.id]
	}),
	attemptAnswers: many(attemptAnswer),
	quizQuestionMappings: many(quizQuestionMapping),
}));

export const quizAttemptRelations = relations(quizAttempt, ({one, many}) => ({
	quiz: one(quiz, {
		fields: [quizAttempt.quizId],
		references: [quiz.id]
	}),
	student: one(user, {
		fields: [quizAttempt.studentId],
		references: [user.id]
	}),
	answers: many(attemptAnswer),
	questionMappings: many(quizQuestionMapping),
}));

export const attemptAnswerRelations = relations(attemptAnswer, ({one}) => ({
	attempt: one(quizAttempt, {
		fields: [attemptAnswer.attemptId],
		references: [quizAttempt.id]
	}),
	question: one(question, {
		fields: [attemptAnswer.questionId],
		references: [question.id]
	}),
}));

export const quizQuestionMappingRelations = relations(quizQuestionMapping, ({one}) => ({
	attempt: one(quizAttempt, {
		fields: [quizQuestionMapping.attemptId],
		references: [quizAttempt.id]
	}),
	question: one(question, {
		fields: [quizQuestionMapping.questionId],
		references: [question.id]
	}),
}));