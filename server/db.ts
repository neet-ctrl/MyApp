import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Hardcoded database URL as requested
const DATABASE_URL = "postgresql://neondb_owner:npg_MQV6w8jJzWhs@ep-curly-bar-a608e8jh.us-west-2.aws.neon.tech/neondb?sslmode=require";

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Initialize database tables if they don't exist
async function initializeDatabase() {
  try {
    // Create consoleLogs table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS console_logs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(10) NOT NULL,
        message TEXT NOT NULL,
        source VARCHAR(50) DEFAULT 'application',
        metadata TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create logCollections table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS log_collections (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        total_entries INTEGER NOT NULL,
        saved_at VARCHAR(255) NOT NULL,
        logs_data TEXT NOT NULL
      );
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.warn('⚠️ Database initialization failed (tables may already exist):', error);
  }
}

// Initialize on startup
initializeDatabase();
