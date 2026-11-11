import { createHash, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";

// Temporary shared manager key: only its bcrypt hash is stored server-side.
const passwordHash =
  "$2a$12$zBKdyC5RNugrmQOe5kxP1eI0k9CClfmzysOV/3yApx16CFBpG89T.";
const duration = 30 * 60_000;
const lockout = 15 * 60_000;
const fingerprint = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class AnalyticsAccessError extends Error {
  constructor(
    message: string,
    public statusCode = 403,
    public code = "ANALYTICS_LOCKED",
  ) {
    super(message);
  }
}
type Session = { userId: string; login: string; expiresAt: number };
export class AnalyticsAccess {
  private sessions = new Map<string, Session>();
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(private now = Date.now) {}
  private prune() {
    const now = this.now();
    for (const [key, value] of this.sessions)
      if (value.expiresAt <= now) this.sessions.delete(key);
    for (const [key, value] of this.attempts)
      if (value.until <= now) this.attempts.delete(key);
  }
  require(userId: string, login: string, token: unknown) {
    this.prune();
    const session =
      typeof token === "string" && token.length === 64
        ? this.sessions.get(fingerprint(token))
        : undefined;
    if (
      !session ||
      session.userId !== userId ||
      session.login !== fingerprint(login)
    )
      throw new AnalyticsAccessError(
        "Acesso exclusivo aos gestores. Informe a senha de liberação do Analytics.",
      );
    return { expiresAt: new Date(session.expiresAt).toISOString() };
  }
  async unlock(userId: string, login: string, password: string) {
    this.prune();
    const attempt = this.attempts.get(userId);
    if (attempt && attempt.count >= 5)
      throw new AnalyticsAccessError(
        "Muitas tentativas. Aguarde 15 minutos para tentar novamente.",
        429,
        "ANALYTICS_RATE_LIMIT",
      );
    if (!attempt && this.attempts.size >= 10000)
      throw new AnalyticsAccessError(
        "Tente novamente em alguns minutos.",
        429,
        "ANALYTICS_RATE_LIMIT",
      );
    // Count before asynchronous verification to cover concurrent attempts too.
    const current = attempt || { count: 0, until: this.now() + lockout };
    current.count++;
    this.attempts.set(userId, current);
    if (!(await compare(password, passwordHash)))
      throw new AnalyticsAccessError(
        "Senha de liberação incorreta. Tente novamente.",
        403,
        "ANALYTICS_BAD_PASSWORD",
      );
    this.attempts.delete(userId);
    if (this.sessions.size >= 5000)
      throw new AnalyticsAccessError(
        "Tente novamente em alguns minutos.",
        429,
        "ANALYTICS_RATE_LIMIT",
      );
    const token = randomBytes(32).toString("hex");
    const expiresAt = this.now() + duration;
    this.sessions.set(fingerprint(token), {
      userId,
      login: fingerprint(login),
      expiresAt,
    });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }
  lock(userId: string, login: string, token: unknown) {
    if (typeof token === "string") {
      const key = fingerprint(token);
      const session = this.sessions.get(key);
      if (session?.userId === userId && session.login === fingerprint(login))
        this.sessions.delete(key);
    }
    return { locked: true };
  }
}
