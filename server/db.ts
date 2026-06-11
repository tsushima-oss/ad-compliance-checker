import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import {
  InsertUser,
  users,
  checks,
  checkItems,
  InsertCheck,
  InsertCheckItem,
  Check,
  CheckItem,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      _db = drizzle(sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

// ─── Checks ───────────────────────────────────────────────────────────────────

export async function createCheck(data: InsertCheck): Promise<number> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(checks).values(data).returning({ id: checks.id });
  return result[0].id;
}

export async function updateCheck(id: number, data: Partial<InsertCheck>): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db.update(checks).set(data).where(eq(checks.id, id));
}

export async function getCheckById(id: number): Promise<Check | undefined> {
  const db = getDb();
  if (!db) return undefined;
  const result = await db.select().from(checks).where(eq(checks.id, id)).limit(1);
  return result[0] ?? undefined;
}

export async function getChecksByUserId(userId: number | null, limit = 20): Promise<Check[]> {
  const db = getDb();
  if (!db) return [];
  if (userId === null) {
    return db.select().from(checks).orderBy(desc(checks.createdAt)).limit(limit);
  }
  return db
    .select()
    .from(checks)
    .where(eq(checks.userId, userId))
    .orderBy(desc(checks.createdAt))
    .limit(limit);
}

export async function deleteCheck(id: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(checkItems).where(eq(checkItems.checkId, id));
  await db.delete(checks).where(eq(checks.id, id));
}

// ─── Check Items ──────────────────────────────────────────────────────────────

export async function createCheckItems(items: InsertCheckItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(checkItems).values(items);
}

export async function getCheckItemsByCheckId(checkId: number): Promise<CheckItem[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(checkItems).where(eq(checkItems.checkId, checkId));
}
