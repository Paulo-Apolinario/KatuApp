type WebSessionRow = {
  id: number;
  token: string | null;
  user_id: string | null;
  payload_json: string | null;
  updated_at: string | null;
};

const memory = {
  session: [] as WebSessionRow[],
};

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().toUpperCase();
}

export async function getDatabase() {
  return null;
}

export async function execute(_sql: string) {
  return;
}

export async function runQuery(sql: string, params: any[] = []) {
  const normalized = normalizeSql(sql);

  if (normalized.startsWith("DELETE FROM SESSION_LOCAL")) {
    memory.session = [];
    return [];
  }

  if (normalized.startsWith("INSERT INTO SESSION_LOCAL")) {
    const nextId =
      memory.session.length > 0
        ? memory.session[memory.session.length - 1].id + 1
        : 1;

    memory.session.push({
      id: nextId,
      token: (params[0] as string) ?? null,
      user_id: (params[1] as string) ?? null,
      payload_json: (params[2] as string) ?? null,
      updated_at: (params[3] as string) ?? null,
    });

    return [];
  }

  if (normalized.startsWith("SELECT * FROM SESSION_LOCAL")) {
    return [...memory.session]
      .sort((a, b) => b.id - a.id)
      .slice(0, 1);
  }

  return [];
}

export async function runSingle(sql: string, params: any[] = []) {
  const rows = await runQuery(sql, params);
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}