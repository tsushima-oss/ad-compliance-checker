import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const overallRiskEnum = pgEnum("overall_risk", ["high", "medium", "low", "safe"]);
export const riskLevelEnum = pgEnum("risk_level", ["high", "medium", "low"]);
export const categoryEnum = pgEnum("category", [
  "yakujiho",
  "keihyo",
  "iryokokoku",
  "gyoseishoshi",
  "other",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 広告チェック履歴テーブル
 */
export const checks = pgTable("checks", {
  id: serial("id").primaryKey(),
  userId: integer("userId"),
  imageUrl: text("imageUrl").notNull(),
  imageKey: varchar("imageKey", { length: 512 }).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  imageBase64: text("imageBase64"),
  imageMimeType: varchar("imageMimeType", { length: 64 }),
  extractedText: text("extractedText"),
  overallRisk: overallRiskEnum("overallRisk").default("safe").notNull(),
  totalViolations: integer("totalViolations").default(0).notNull(),
  summary: text("summary"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Check = typeof checks.$inferSelect;
export type InsertCheck = typeof checks.$inferInsert;

/**
 * 個別違反項目テーブル
 */
export const checkItems = pgTable("check_items", {
  id: serial("id").primaryKey(),
  checkId: integer("checkId").notNull(),
  category: categoryEnum("category").notNull(),
  riskLevel: riskLevelEnum("riskLevel").notNull(),
  violationText: text("violationText"),
  reason: text("reason").notNull(),
  suggestion: text("suggestion"),
  legalBasis: text("legalBasis"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
});

export type CheckItem = typeof checkItems.$inferSelect;
export type InsertCheckItem = typeof checkItems.$inferInsert;
