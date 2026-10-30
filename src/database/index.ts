import { Platform } from "react-native";

type DatabaseModule = {
  getDatabase: () => Promise<any>;
  execute: (sql: string) => Promise<any>;
  runQuery: (sql: string, params?: any[]) => Promise<any>;
  runSingle: (sql: string, params?: any[]) => Promise<any>;
};

const databaseModulePromise: Promise<DatabaseModule> =
  Platform.OS === "web"
    ? import("./index.web")
    : import("./index.native");

export const getDatabase = async () => {
  const databaseModule = await databaseModulePromise;
  return databaseModule.getDatabase();
};

export const execute = async (sql: string) => {
  const databaseModule = await databaseModulePromise;
  return databaseModule.execute(sql);
};

export const runQuery = async (sql: string, params?: any[]) => {
  const databaseModule = await databaseModulePromise;
  return databaseModule.runQuery(sql, params);
};

export const runSingle = async (sql: string, params?: any[]) => {
  const databaseModule = await databaseModulePromise;
  return databaseModule.runSingle(sql, params);
};