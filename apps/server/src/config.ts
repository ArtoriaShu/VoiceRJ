import { resolve } from 'node:path';

const dataDir = resolve(process.env.DATA_DIR ?? './data');
export const config = {
  port: Number(process.env.PORT ?? 3001),
  databaseFile: resolve(process.env.DATABASE_URL ?? `${dataDir}/library.sqlite`),
  accessPassword: process.env.ACCESS_PASSWORD,
  disableAuth: process.env.DISABLE_AUTH === 'true',
  sessionTtlMs: Number(process.env.SESSION_TTL_HOURS ?? 168) * 60 * 60 * 1000,
  mediaRoot: resolve(process.env.MEDIA_ROOT ?? '/media'),
  secureCookies: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === 'true'
};
