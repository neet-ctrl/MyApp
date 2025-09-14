import { defineConfig } from "drizzle-kit";

// Use the same hardcoded DATABASE_URL as in server/db.ts
const DATABASE_URL = "postgresql://neondb_owner:npg_yG8JFioduCL1@ep-proud-darkness-agtw4exm.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
});
