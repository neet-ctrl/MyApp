import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Hardcoded database URL as requested
const DATABASE_URL = "postgresql://neondb_owner:npg_MQV6w8jJzWhs@ep-curly-bar-a608e8jh.us-west-2.aws.neon.tech/neondb?sslmode=require";

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle({ client: pool, schema });
