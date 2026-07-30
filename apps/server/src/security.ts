import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from './db.js';
import { config } from './config.js';
import { sessions, settings } from './schema.js';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const sessionCookie = 'newvoice_session';

export async function ensurePassword() {
  const existing = await db.select().from(settings).where(eq(settings.key, 'password_hash')).get();
  if (existing) return;
  if (!config.accessPassword) throw new Error('ACCESS_PASSWORD must be set before first start.');
  await db.insert(settings).values({ key: 'password_hash', value: await argon2.hash(config.accessPassword, { type: argon2.argon2id }) });
}

export async function verifyPassword(password: string) {
  const record = await db.select().from(settings).where(eq(settings.key, 'password_hash')).get();
  return Boolean(record && await argon2.verify(record.value, password));
}

export async function createSession() {
  const id = randomBytes(18).toString('base64url');
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const now = Date.now();
  await db.insert(sessions).values({ id, tokenHash: hashToken(token), csrfToken, expiresAt: now + config.sessionTtlMs, createdAt: now });
  return { value: `${id}.${token}`, csrfToken, expiresAt: now + config.sessionTtlMs };
}

export async function getSession(value?: string) {
  const [id, token] = value?.split('.') ?? [];
  if (!id || !token) return undefined;
  return db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, Date.now()))).get();
}

export async function removeSession(value?: string) {
  const id = value?.split('.')[0];
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
}

export const cookieOptions = { path: '/', httpOnly: true, secure: config.secureCookies, sameSite: 'lax' as const, maxAge: Math.floor(config.sessionTtlMs / 1000) };
