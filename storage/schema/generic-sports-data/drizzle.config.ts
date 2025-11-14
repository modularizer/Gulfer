/**
 * Drizzle Kit Configuration for generic-sports-data
 * 
 * Used ONLY for generating SQL migration files for generic-sports-data tables.
 */

import type { Config } from 'drizzle-kit';
import * as path from 'path';

export default {
  schema: [path.resolve(__dirname, './tables/index.ts')],
  out: path.resolve(__dirname, './migrations'),
  dialect: 'sqlite',
  dbCredentials: {
    url: path.resolve(__dirname, './dev.db'), // Local dev database (Node.js only, for drizzle-kit)
  },
} satisfies Config;

