import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const file = process.env.DATABASE_URL ?? './data/library.sqlite';
mkdirSync(dirname(file), { recursive: true });
const sqlite = new Database(file);
migrate(drizzle(sqlite), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
sqlite.close();
