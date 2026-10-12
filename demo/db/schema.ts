import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("demo_profiles", {
  id: text("id").primaryKey(), name: text("name").notNull(), avatar: text("avatar").notNull(),
  createdAt: text("created_at").notNull(),
});
export const sessions = sqliteTable("demo_sessions", {
  id: text("id").notNull(), guestId: text("guest_id").notNull(),
  createdAt: text("created_at").notNull(), result: text("result").notNull(),
  hash: text("hash").notNull(), input: text("input"), reward: integer("reward").notNull(),
  chainStatus: text("chain_status").notNull().default("not_submitted"),
  signature: text("signature"), chainError: text("chain_error"), anchorAt: text("anchor_at"),
}, (t) => [primaryKey({columns:[t.guestId,t.id]})]);
export const redemptions = sqliteTable("demo_redemptions", {
  guestId: text("guest_id").notNull(), benefit: text("benefit").notNull(),
  cost: integer("cost").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [primaryKey({columns:[t.guestId,t.benefit]})]);

export const classPlans = sqliteTable("demo_class_plans", {
  scopeId: text("scope_id").notNull(), id: text("id").notNull(),
  createdAt: text("created_at").notNull(), input: text("input").notNull(),
  plan: text("plan").notNull(),
}, (t) => [primaryKey({columns:[t.scopeId,t.id]})]);

export const classRuns = sqliteTable("demo_class_runs", {
  scopeId: text("scope_id").notNull(), id: text("id").notNull(),
  planId: text("plan_id").notNull(), createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(), revision: integer("revision").notNull().default(0),
  input: text("input").notNull(), plan: text("plan").notNull(), timing: text("timing").notNull(),
  state: text("state").notNull(), active: integer("active").notNull().default(1),
  lastCommandId: text("last_command_id"), lastCommandJson: text("last_command_json"),
}, (t) => [primaryKey({columns: [t.scopeId, t.id]}), uniqueIndex("demo_class_runs_one_active").on(t.scopeId).where(sql`${t.active} = 1`)]);

// Immutable declared demonstration closeouts. No foreign key: the snapshot
// remains available when the owner deletes the originating run or class plan.
export const classReports = sqliteTable("demo_class_reports", {
  scopeId: text("scope_id").notNull(), id: text("id").notNull(),
  createdAt: text("created_at").notNull(), requestId: text("request_id").notNull(),
  payload: text("payload").notNull(), hash: text("hash").notNull(),
}, (t) => [primaryKey({columns: [t.scopeId, t.id]}), uniqueIndex("demo_class_reports_request").on(t.scopeId, t.requestId)]);
