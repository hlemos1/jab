import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

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
