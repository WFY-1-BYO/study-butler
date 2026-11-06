import { pgTable, serial, timestamp, index, foreignKey, integer, varchar, text, boolean, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const events = pgTable("events", {
	id: serial().primaryKey().notNull(),
	subjectId: integer("subject_id"),
	title: varchar({ length: 128 }).notNull(),
	type: varchar({ length: 24 }).default('test').notNull(),
	startAt: timestamp("start_at", { withTimezone: true, mode: 'string' }).notNull(),
	remindBeforeMin: integer("remind_before_min").default(1440).notNull(),
	notes: text(),
	done: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	priority: varchar({ length: 16 }).default('regular').notNull(),
	needQuiz: boolean("need_quiz").default(false).notNull(),
	needMaterial: boolean("need_material").default(false).notNull(),
	materialStatus: varchar("material_status", { length: 16 }).default('none').notNull(),
}, (table) => [
	index("events_start_at_idx").using("btree", table.startAt.asc().nullsLast().op("timestamptz_ops")),
	index("events_subject_id_idx").using("btree", table.subjectId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
			name: "events_subject_id_subjects_id_fk"
		}).onDelete("set null"),
]);

export const materials = pgTable("materials", {
	id: serial().primaryKey().notNull(),
	subjectId: integer("subject_id").notNull(),
	weekNo: integer("week_no").notNull(),
	topic: varchar({ length: 128 }).notNull(),
	type: varchar({ length: 24 }).default('material').notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: jsonb().notNull(),
	source: varchar({ length: 255 }),
	aiGenerated: boolean("ai_generated").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("materials_subject_id_idx").using("btree", table.subjectId.asc().nullsLast().op("int4_ops")),
	index("materials_week_no_idx").using("btree", table.weekNo.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
			name: "materials_subject_id_subjects_id_fk"
		}).onDelete("cascade"),
]);

export const planTasks = pgTable("plan_tasks", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	planDate: timestamp("plan_date", { withTimezone: true, mode: 'string' }).notNull(),
	task: text().notNull(),
	minutes: integer().default(25).notNull(),
	isFallback: boolean("is_fallback").default(false).notNull(),
	done: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("plan_tasks_event_id_idx").using("btree", table.eventId.asc().nullsLast().op("int4_ops")),
	index("plan_tasks_plan_date_idx").using("btree", table.planDate.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "plan_tasks_event_id_events_id_fk"
		}).onDelete("cascade"),
]);

export const subjects = pgTable("subjects", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 64 }).notNull(),
	color: varchar({ length: 32 }).default('#4F46E5').notNull(),
	currentProgress: varchar("current_progress", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("subjects_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const dailyCards = pgTable("daily_cards", {
	id: serial().primaryKey().notNull(),
	cardDate: timestamp("card_date", { withTimezone: true, mode: 'string' }).notNull(),
	headline: varchar({ length: 128 }).notNull(),
	mustDo: text("must_do").notNull(),
	fallback: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("daily_cards_card_date_idx").using("btree", table.cardDate.asc().nullsLast().op("timestamptz_ops")),
]);

export const quizzes = pgTable("quizzes", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	question: text().notNull(),
	answer: text().notNull(),
	hint: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("quizzes_event_id_idx").using("btree", table.eventId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "quizzes_event_id_events_id_fk"
		}).onDelete("cascade"),
]);
