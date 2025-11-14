/**
 * Drizzle Kit Configuration
 * 
 * Used ONLY for generating SQL migration files during development.
 * These SQL files are then embedded in setup.ts and run at runtime on each client.
 * 
 * Commands:
 * - npm run db:generate - Generate migration SQL files (development only)
 * - npm run db:generate-sql - Generate and extract SQL for embedding
 * - npm run db:studio - Open Drizzle Studio (database GUI, for local dev.db only)
 * 
 * Note: This config is for development tooling only. The actual database
 * is created at runtime on each client (web, iOS, Android) using setup.ts
 */

import type { Config } from 'drizzle-kit';

export default {
  schema: './storage/sports-data/schema/tables/index.ts',
  out: './storage/sports-data/migrations',
  dialect: 'sqlite',
  driver: 'better-sqlite', // For local development with Node.js only
  dbCredentials: {
    url: './storage/sports-data/dev.db', // Local dev database (Node.js only, for drizzle-kit)
  },
} satisfies Config;

