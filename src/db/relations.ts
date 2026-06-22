import { relations } from "drizzle-orm/relations";
import { course, lessonProgress, user, studentModuleAvailability, courseInstructor, order, payment, contactSubmission, deviceSession, category, sessionLockSettings, videoLibraryNode, account, session } from "./schema";

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

export const userRelations = relations(user, ({many}) => ({
	lessonProgresses: many(lessonProgress),
	studentModuleAvailabilities: many(studentModuleAvailability),
	contactSubmissions: many(contactSubmission),
	deviceSessions: many(deviceSession),
	courses: many(course),
	sessionLockSettings: many(sessionLockSettings),
	orders: many(order),
	accounts: many(account),
	sessions: many(session),
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