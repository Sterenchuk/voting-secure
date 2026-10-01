import { defineConfig } from 'prisma/config';
import 'dotenv/config';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://dummy:dummy@localhost:5432/dummy?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    url: databaseUrl,
  },
});
