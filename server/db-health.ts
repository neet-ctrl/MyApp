
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const { db } = await import('./db');
    // Simple health check query
    await db.execute('SELECT 1');
    return { healthy: true };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown database error';
    
    // Check for common Neon issues
    if (errorMessage.includes('endpoint has been disabled')) {
      return { 
        healthy: false, 
        error: 'Database endpoint is disabled. Visit your Neon console to re-enable it.' 
      };
    }
    
    if (errorMessage.includes('connection refused') || errorMessage.includes('timeout')) {
      return { 
        healthy: false, 
        error: 'Database connection timeout. The database may be sleeping.' 
      };
    }
    
    return { 
      healthy: false, 
      error: `Database error: ${errorMessage}` 
    };
  }
}

export async function warmupDatabase(): Promise<boolean> {
  try {
    const { db } = await import('./db');
    // Perform a simple query to wake up the database
    await db.execute('SELECT 1');
    console.log('✅ Database warmed up successfully');
    return true;
  } catch (error: any) {
    console.log('❌ Database warmup failed:', error.message);
    return false;
  }
}
