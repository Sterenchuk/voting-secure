// prisma/prisma.config.ts

// This package is necessary to load your .env file
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Optionally, specify your schema path if it's not in the root
  schema: 'prisma/schema.prisma',

  // This is the correct structure for the Prisma CLI/Migrate
  datasource: {
    // The 'url' property belongs HERE, inside the datasource block
    url: env('DATABASE_URL'),
  },

  // You can also configure the migrations path here
  migrations: {
    path: 'prisma/migrations',
  },
});
