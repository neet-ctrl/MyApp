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
  // Run automatic setup first
  await autoSetup();
  
  // Serve FinalCropper build folder before Vite catch-all
  app.use('/FinalCropper/build', express.static(path.resolve('FinalCropper/build')));
  
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

  // Serve MolView static files
  app.use('/FinalCropper/public/molview', express.static('public/FinalCropper/public/molview'));

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Serve static files from public directory in development mode
    app.use(express.static('public'));
    await setupVite(app, server);
  } else {
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
})();
