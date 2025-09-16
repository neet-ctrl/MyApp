import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import session from "express-session";
import multer from "multer";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { registerRoutes, startLiveCloningService } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { autoSetup } from "./auto-setup";

// Global WebSocket server for console logs
declare global {
  var consoleWebSocketServer: WebSocketServer | undefined;
}

const app = express();

// Session middleware for GitHub OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'telegram-manager-github-sync-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: false, limit: '500mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
  // Enhanced Environment Detection and Logging
  const isWorkspace = process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN;
  const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
  const deploymentEnv = isWorkspace ? 'REPLIT_WORKSPACE' : isRailway ? 'RAILWAY_PRODUCTION' : 'UNKNOWN';
  
  console.log('\n🌟 ===== DEPLOYMENT ENVIRONMENT DETECTION =====');
  console.log(`🔍 Environment: ${deploymentEnv}`);
  console.log(`🔍 NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔍 Workspace Indicators: REPL_ID=${!!process.env.REPL_ID}, REPLIT_DEV_DOMAIN=${!!process.env.REPLIT_DEV_DOMAIN}`);
  console.log(`🔍 Railway Indicators: RAILWAY_ENVIRONMENT=${!!process.env.RAILWAY_ENVIRONMENT}, RAILWAY_PROJECT_ID=${!!process.env.RAILWAY_PROJECT_ID}`);
  console.log(`🔍 Working Directory: ${process.cwd()}`);
  console.log(`🔍 Module Directory: ${path.dirname(import.meta.dirname)}`);
  console.log('🌟 =============================================\n');

  // Run automatic setup first
  await autoSetup();
  
  // Enhanced static file serving with multiple fallback paths
  const finalCropperBuildPath = path.resolve('FinalCropper/build');
  const publicFinalCropperPath = path.resolve('public/FinalCropper/public');
  
  console.log(`📁 [${deploymentEnv}] Setting up FinalCropper/build static serving:`);
  console.log(`   📂 Primary path: ${finalCropperBuildPath}`);
  console.log(`   📂 Fallback path: ${publicFinalCropperPath}`);
  console.log(`   ✅ Primary exists: ${fs.existsSync(finalCropperBuildPath)}`);
  console.log(`   ✅ Fallback exists: ${fs.existsSync(publicFinalCropperPath)}`);
  
  app.use('/FinalCropper/build', (req, res, next) => {
    console.log(`📥 [${deploymentEnv}] Static request: /FinalCropper/build${req.path}`);
    
    const primaryPath = path.join(finalCropperBuildPath, req.path);
    const fallbackPath = path.join(publicFinalCropperPath, req.path);
    
    console.log(`   🎯 Trying primary: ${primaryPath}`);
    console.log(`   ✅ Primary exists: ${fs.existsSync(primaryPath)}`);
    
    // Try primary path first
    if (fs.existsSync(primaryPath)) {
      console.log(`   ✅ Serving from primary path`);
      return res.sendFile(path.resolve(primaryPath));
    }
    
    // Try fallback path
    console.log(`   🔄 Trying fallback: ${fallbackPath}`);
    console.log(`   ✅ Fallback exists: ${fs.existsSync(fallbackPath)}`);
    
    if (fs.existsSync(fallbackPath)) {
      console.log(`   ✅ Serving from fallback path`);
      return res.sendFile(path.resolve(fallbackPath));
    }
    
    console.log(`   ❌ File not found in any location`);
    next();
  });
  
  // Also serve static files from both directories
  app.use('/FinalCropper/build', express.static(finalCropperBuildPath));
  app.use('/FinalCropper/build', express.static(publicFinalCropperPath));
  
  await registerRoutes(app);
  const server = createServer(app);
  
  // Setup WebSocket server for real-time console logs
  const wss = new WebSocketServer({ server, path: '/ws/console' });
  global.consoleWebSocketServer = wss;
  
  wss.on('connection', (ws) => {
    console.log('Console WebSocket client connected');
    
    ws.on('close', () => {
      console.log('Console WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('Console WebSocket error:', error);
    });
  });
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // MolView PHP endpoints replacement
  const molviewUpload = multer({ dest: 'public/FinalCropper/public/molview/php/uploads/structures/' });
  const dbUpload = multer({ dest: 'public/FinalCropper/public/molview/php/uploads/' });

  // COMPREHENSIVE MOLVIEW FILE SERVING WITH 100% FALLBACK COVERAGE
  const molviewPaths = [
    { name: 'Primary', path: path.resolve('public/FinalCropper/public/molview') },
    { name: 'Build_V1', path: path.resolve('FinalCropper/build/molview') },
    { name: 'Build_V2', path: path.resolve('FinalCropper/public/molview') },
    { name: 'Public_Alt', path: path.resolve('public/molview') },
    { name: 'Root_Alt', path: path.resolve('molview') }
  ];
  
  console.log(`📁 [${deploymentEnv}] Setting up COMPREHENSIVE MolView static serving:`);
  molviewPaths.forEach(({ name, path: dirPath }) => {
    console.log(`   📂 ${name}: ${dirPath} -> Exists: ${fs.existsSync(dirPath)}`);
  });
  
  // CRITICAL FIX: Create multiple route handlers with precise fallback order
  app.use('/FinalCropper/public/molview', (req, res, next) => {
    console.log(`📥 [${deploymentEnv}] MolView request: /FinalCropper/public/molview${req.path}`);
    
    // Try each location in order of priority
    for (const { name, path: dirPath } of molviewPaths) {
      const filePath = path.join(dirPath, req.path);
      console.log(`   🔍 Checking ${name}: ${filePath}`);
      
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          console.log(`   ✅ FOUND in ${name}: ${filePath}`);
          return res.sendFile(path.resolve(filePath));
        }
      }
    }
    
    console.log(`   ❌ FILE NOT FOUND: ${req.path}`);
    console.log(`   🔍 Available files in primary directory:`);
    
    try {
      const primaryDir = molviewPaths[0].path;
      if (fs.existsSync(primaryDir)) {
        const buildDir = path.join(primaryDir, 'build');
        if (fs.existsSync(buildDir)) {
          const files = fs.readdirSync(buildDir);
          console.log(`   📁 Build directory contents: ${files.join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`   ❌ Error listing directory: ${e}`);
    }
    
    next();
  });
  
  // Add express.static middleware for each path as fallback
  molviewPaths.forEach(({ name, path: dirPath }) => {
    if (fs.existsSync(dirPath)) {
      app.use('/FinalCropper/public/molview', express.static(dirPath));
      console.log(`   ✅ Added static middleware for ${name}`);
    }
  });
  
  // CRITICAL FIX: Add specific routes for MolView files that exist in workspace
  app.use('/FinalCropper/public/molview/build', express.static(path.resolve('public/FinalCropper/public/molview/build')));
  app.use('/FinalCropper/public/molview/build', express.static(path.resolve('FinalCropper/build/molview/build')));
  app.use('/FinalCropper/public/molview/build', express.static(path.resolve('FinalCropper/public/molview/build')));
  console.log(`   ✅ Added dedicated build directory routes`);

  // MolView PHP endpoint replacements
  app.get('/FinalCropper/public/molview/php/download_db.php', (req, res) => {
    const dbPath = 'public/FinalCropper/public/molview/php/data/molview_library.db';
    if (fs.existsSync(dbPath)) {
      res.download(dbPath, 'molview_library.db');
    } else {
      res.status(404).send('Database not found');
    }
  });

  app.post('/FinalCropper/public/molview/php/upload_db.php', dbUpload.single('database'), (req, res) => {
    if (req.file) {
      const targetPath = 'public/FinalCropper/public/molview/php/data/molview_library.db';
      fs.copyFileSync(req.file.path, targetPath);
      fs.unlinkSync(req.file.path);
      res.json({ success: true, message: 'Database uploaded successfully' });
    } else {
      res.json({ success: false, message: 'No file uploaded' });
    }
  });

  app.post('/FinalCropper/public/molview/php/upload.php', molviewUpload.single('structure'), (req, res) => {
    if (req.file) {
      const fileName = req.file.filename + '.mol';
      const targetPath = path.join('public/FinalCropper/public/molview/php/uploads/structures/', fileName);
      fs.renameSync(req.file.path, targetPath);
      res.json({ 
        success: true, 
        filename: fileName,
        path: '/FinalCropper/public/molview/php/uploads/structures/' + fileName
      });
    } else {
      res.json({ success: false, message: 'No structure uploaded' });
    }
  });

  app.get('/FinalCropper/public/molview/php/download.php', (req, res) => {
    const files = req.query.files as string;
    if (!files) {
      return res.status(400).send('No files specified');
    }
    
    const fileList = files.split(',');
    const archive = archiver('zip');
    
    res.attachment('structures.zip');
    archive.pipe(res);
    
    fileList.forEach(file => {
      const filePath = path.join('public/FinalCropper/public/molview/php/uploads/structures/', file);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file });
      }
    });
    
    archive.finalize();
  });

  // External data proxies to avoid CORS
  app.get('/FinalCropper/public/molview/php/cod.php', async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).send('Missing ID');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`http://www.crystallography.net/cod/${id}.cif`);
      const data = await response.text();
      res.set('Content-Type', 'text/plain');
      res.send(data);
    } catch (error) {
      res.status(500).send('Error fetching COD data');
    }
  });

  app.get('/FinalCropper/public/molview/php/cif.php', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send('Missing URL');
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url);
      const data = await response.text();
      res.set('Content-Type', 'text/plain');
      res.send(data);
    } catch (error) {
      res.status(500).send('Error fetching CIF data');
    }
  });

  // Enhanced static file serving configuration with environment-specific logging
  console.log(`\n📂 [${deploymentEnv}] Static File Serving Configuration:`);
  console.log(`   🔧 app.get("env"): ${app.get("env")}`);
  console.log(`   🔧 NODE_ENV: ${process.env.NODE_ENV}`);
  
  const publicPath = path.resolve('public');
  console.log(`   📁 Public directory path: ${publicPath}`);
  console.log(`   ✅ Public directory exists: ${fs.existsSync(publicPath)}`);
  
  // CRITICAL FIX: Serve public directory in ALL environments
  app.use('/public', (req, res, next) => {
    console.log(`📥 [${deploymentEnv}] Public static request: /public${req.path}`);
    const filePath = path.join(publicPath, req.path);
    console.log(`   🎯 Resolving to: ${filePath}`);
    console.log(`   ✅ File exists: ${fs.existsSync(filePath)}`);
    next();
  }, express.static(publicPath));
  
  // Serve root public files (for compatibility)
  app.use(express.static(publicPath));
  
  // ADDITIONAL FIX: Serve FinalCropper files directly from public
  app.use('/FinalCropper', express.static(path.join(publicPath, 'FinalCropper')));
  
  console.log(`   ✅ [${deploymentEnv}] Public directory static serving enabled`);
  
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    console.log(`   🔧 [${deploymentEnv}] Setting up Vite development server`);
    await setupVite(app, server);
  } else {
    console.log(`   🔧 [${deploymentEnv}] Setting up production static server`);
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Auto-start Live Cloning service AFTER server is running
    try {
      await startLiveCloningService();
    } catch (error) {
      console.error('Failed to start Live Cloning service:', error);
    }
  });
  
  } catch (error) {
    console.error('🚨 CRITICAL STARTUP ERROR:', error);
    console.error('🚨 Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    process.exit(1);
  }
})().catch(err => {
  console.error('🚨 UNHANDLED STARTUP ERROR:', err);
  process.exit(1);
});
