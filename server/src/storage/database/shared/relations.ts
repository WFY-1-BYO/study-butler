import { relations } from "drizzle-orm/relations";
import { subjects, events, materials, planTasks, quizzes } from "./schema";

export const eventsRelations = relations(events, ({one, many}) => ({
	subject: one(subjects, {
		fields: [events.subjectId],
		references: [subjects.id]
	}),
	planTasks: many(planTasks),
	quizzes: many(quizzes),
}));

export const subjectsRelations = relations(subjects, ({many}) => ({
	events: many(events),
	materials: many(materials),
}));

export const materialsRelations = relations(materials, ({one}) => ({
	subject: one(subjects, {
		fields: [materials.subjectId],
		references: [subjects.id]
	}),
}));

export const planTasksRelations = relations(planTasks, ({one}) => ({
	event: one(events, {
		fields: [planTasks.eventId],
		references: [events.id]
	}),
}));

export const quizzesRelations = relations(quizzes, ({one}) => ({
	event: one(events, {
		fields: [quizzes.eventId],
		references: [events.id]
	}),
}));