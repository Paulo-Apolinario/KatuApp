import * as SQLite from "expo-sqlite";
import { DB_NAME } from "./schema";

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase() {
  if (database) {
    return database;
  }

  database = await SQLite.openDatabaseAsync(DB_NAME);

  await database.execAsync(`PRAGMA journal_mode = WAL;`);
  await database.execAsync(`PRAGMA foreign_keys = ON;`);

  return database;
}

export async function execute(sql: string) {
  const db = await getDatabase();
  return db.execAsync(sql);
}

export async function runQuery(sql: string, params: any[] = []) {
  const db = await getDatabase();
  return db.getAllAsync(sql, params);
}

export async function runSingle(sql: string, params: any[] = []) {
  const db = await getDatabase();
  return db.getFirstAsync(sql, params);
}