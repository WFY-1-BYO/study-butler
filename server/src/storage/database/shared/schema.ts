import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  serial,
} from "drizzle-orm/pg-core";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// ---------- 学科 ----------
export const subjects = pgTable(
  "subjects",
  {
    id: serial().primaryKey(),
    name: varchar("name", { length: 64 }).notNull(),
    color: varchar("color", { length: 32 }).notNull().default("#4F46E5"),
    current_progress: varchar("current_progress", { length: 255 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("subjects_name_idx").on(table.name)]
);

// ---------- 日程事件（考试/作业/活动） ----------
export const events = pgTable(
  "events",
  {
    id: serial().primaryKey(),
    subject_id: integer("subject_id").references(() => subjects.id, { onDelete: "set null" }),
    title: varchar("title", { length: 128 }).notNull(),
    type: varchar("type", { length: 24 }).notNull().default("test"), // test / homework / activity / recite
    start_at: timestamp("start_at", { withTimezone: true }).notNull(),
    remind_before_min: integer("remind_before_min").notNull().default(1440),
    notes: text("notes"),
    done: boolean("done").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("events_subject_id_idx").on(table.subject_id),
    index("events_start_at_idx").on(table.start_at),
  ]
);

// ---------- 倒推计划任务 ----------
export const plan_tasks = pgTable(
  "plan_tasks",
  {
    id: serial().primaryKey(),
    event_id: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    plan_date: timestamp("plan_date", { withTimezone: true }).notNull(),
    task: text("task").notNull(),
    minutes: integer("minutes").notNull().default(25),
    is_fallback: boolean("is_fallback").notNull().default(false), // 是否保底日任务
    done: boolean("done").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("plan_tasks_event_id_idx").on(table.event_id),
    index("plan_tasks_plan_date_idx").on(table.plan_date),
  ]
);

// ---------- 学习资料（AI 私教备料） ----------
export const materials = pgTable(
  "materials",
  {
    id: serial().primaryKey(),
    subject_id: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    week_no: integer("week_no").notNull(),
    topic: varchar("topic", { length: 128 }).notNull(),
    type: varchar("type", { length: 24 }).notNull().default("material"), // material / material_prep
    title: varchar("title", { length: 255 }).notNull(),
    content: jsonb("content").notNull(), // { concepts[], questions[], answers[], pitfall }
    source: varchar("source", { length: 255 }),
    ai_generated: boolean("ai_generated").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("materials_subject_id_idx").on(table.subject_id),
    index("materials_week_no_idx").on(table.week_no),
  ]
);

// ---------- 每日卡片 ----------
export const daily_cards = pgTable(
  "daily_cards",
  {
    id: serial().primaryKey(),
    card_date: timestamp("card_date", { withTimezone: true }).notNull(),
    headline: varchar("headline", { length: 128 }).notNull(),
    must_do: text("must_do").notNull(),
    fallback: text("fallback").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("daily_cards_card_date_idx").on(table.card_date)]
);

const { createInsertSchema } = createSchemaFactory({ coerce: { date: true } });

export const insertSubjectSchema = createInsertSchema(subjects).pick({ name: true, color: true, current_progress: true });
export const insertEventSchema = createInsertSchema(events).pick({
  subject_id: true,
  title: true,
  type: true,
  start_at: true,
  remind_before_min: true,
  notes: true,
});
export const insertPlanTaskSchema = createInsertSchema(plan_tasks).pick({
  event_id: true,
  plan_date: true,
  task: true,
  minutes: true,
  is_fallback: true,
});
export const insertMaterialSchema = createInsertSchema(materials).pick({
  subject_id: true,
  week_no: true,
  topic: true,
  type: true,
  title: true,
  content: true,
  source: true,
  ai_generated: true,
});
export const insertDailyCardSchema = createInsertSchema(daily_cards).pick({
  card_date: true,
  headline: true,
  must_do: true,
  fallback: true,
});

export type Subject = typeof subjects.$inferSelect;
export type Event = typeof events.$inferSelect;
export type PlanTask = typeof plan_tasks.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type DailyCard = typeof daily_cards.$inferSelect;

// 保留系统表（禁止删除）
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});