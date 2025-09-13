import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { autoSetup } from "./auto-setup";
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './telegram-bot/logger';

// Live Cloning Process Management
let liveCloningProcess: ChildProcess | null = null;
let liveCloningStatus = { 
  running: false, 
  lastActivity: null as string | null,
  logs: [] as string[]
};

// Helper function to ensure directories exist
const ensureDirectories = (): void => {
  const dirs = [
    './downloads',
    './downloads/completed', 
    './sessions',
    './logs'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }
  });
};

// Load persistent live cloning settings
const loadLiveCloningSettings = () => {
  try {
    const settingsPath = './config/live_cloning_persistent_settings.json';
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      logger.info(`✅ Loaded persistent live cloning settings: ${JSON.stringify({
        botEnabled: settings.botEnabled,
        filterWords: settings.filterWords,
        addSignature: settings.addSignature,
        signature: settings.signature,
        sessionString: settings.sessionString?.substring(0, 20) + '...[REDACTED]'
      })}`);
      return settings;
    }
  } catch (error) {
    logger.error('❌ Failed to load live cloning settings:', error);
  }
  return null;
};

// Start Live Cloning Python Process  
const startLiveCloningProcess = () => {
  const settings = loadLiveCloningSettings();
  if (!settings || !settings.botEnabled) {
    logger.info('🔄 Live cloning disabled in settings');
    return;
  }

  try {
    logger.info('🚀 Starting Live Cloning service for 24/7 always-running architecture...');
    
    // Show loaded configuration
    logger.info(`📋 Loaded persistent settings for auto-start: ${JSON.stringify({
      botEnabled: settings.botEnabled,
      filterWords: settings.filterWords,
      addSignature: settings.addSignature,
      signature: settings.signature,
      sessionString: settings.sessionString?.substring(0, 100) + '...[TRUNCATED]'
    })}`);

    // Check if Railway environment (prioritize Railway session)
    const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.RAILWAY_GIT_COMMIT_SHA;
    const sessionToUse = isRailway && process.env.RAILWAY_SESSION_STRING 
      ? process.env.RAILWAY_SESSION_STRING 
      : settings.sessionString;

    if (isRailway && process.env.RAILWAY_SESSION_STRING) {
      logger.info('🚂 Using Railway-specific session string (avoiding IP conflict)');
    } else {
      logger.info('📝 Using persistent config session string');
    }

    // Load entity links from config
    const configPath = './bot_source/live-cloning/plugins/jsons/config.json';
    let entityLinks = [];
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      entityLinks = config.entity_links || [];
      logger.info(`📎 Loaded ${entityLinks.length} entity links from Python config.json`);
    }

    logger.info(`📎 Total loaded for auto-start: ${entityLinks.length} entity links and 0 word filters`);
    logger.info('🔄 Starting Live Cloning Python process for 24/7 operation...');

    // Start Python live cloning process
    liveCloningProcess = spawn('python3', ['bot_source/live-cloning/live_cloner.py'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        TG_API_ID: process.env.VITE_TELEGRAM_API_ID || process.env.TG_API_ID,
        TG_API_HASH: process.env.VITE_TELEGRAM_API_HASH || process.env.TG_API_HASH,
        SESSION_STRING: sessionToUse
      }
    });

    liveCloningStatus.running = true;
    liveCloningStatus.lastActivity = new Date().toISOString();

    // Handle process output
    liveCloningProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      liveCloningStatus.logs.push(`[STDOUT] ${output}`);
      logger.info(`🔄 Live Cloning Output: ${output}`);
    });

    liveCloningProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();  
      liveCloningStatus.logs.push(`[STDERR] ${output}`);
      logger.error(`🔄 Live Cloning Error (24/7): ${output}`);
    });

    liveCloningProcess.on('close', (code) => {
      liveCloningStatus.running = false;
      logger.warn(`🔄 Live Cloning process exited with code ${code}`);
    });

    liveCloningProcess.on('error', (error) => {
      liveCloningStatus.running = false;
      logger.error(`🔄 Live Cloning process error: ${error.message}`);
    });

    logger.info('✅ Live Cloning 24/7 service started successfully!');
    logger.info(`📊 Running with ${entityLinks.length} entity links and bot enabled: ${settings.botEnabled}`);
    logger.info('🌟 Service will run continuously until server shutdown');

  } catch (error) {
    logger.error('❌ Failed to start Live Cloning service:', error);
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Run automatic setup first
  try {
    await autoSetup();
    
    // Ensure directories are created
    ensureDirectories();
    
    // Start Live Cloning service
    startLiveCloningProcess();
    
  } catch (error) {
    logger.error('❌ Setup failed:', error);
  }

  // Basic API routes can be added here later
  // app.get('/api/status', (req, res) => {
  //   res.json({ status: 'ok', liveCloningRunning: liveCloningStatus.running });
  // });

  const httpServer = createServer(app);
  return httpServer;
}