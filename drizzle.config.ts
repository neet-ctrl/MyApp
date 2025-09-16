import { defineConfig } from "drizzle-kit";

// Use the same hardcoded DATABASE_URL as in server/db.ts
// Hardcoded database URL as requested
const DATABASE_URL = "postgresql://neondb_owner:npg_MQV6w8jJzWhs@ep-curly-bar-a608e8jh.us-west-2.aws.neon.tech/neondb?sslmode=require";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
