import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { projectsRouter } from './routes/projects';
import { projectsManageRouter } from './routes/projects-manage';
import { snapshotsRouter } from './routes/snapshots';
import { reportsRouter } from './routes/reports';
import { alertsRouter } from './routes/alerts';
import { scanRouter } from './routes/scan';
import { initializeData } from './utils/data';

// Type definitions for environment bindings
type EnvBindings = {
  ENVIRONMENT: string;
  ALLOWED_ORIGINS?: string;
  DATA_URL?: string;
  SCAN_TOKEN?: string;
  KV: KVNamespace;
};

// Create Hono app
const app = new Hono<{ Bindings: EnvBindings }>();

// Initialize data on first request
let dataInitialized = false;

// Middleware: Logger
app.use('*', logger());

// Middleware: CORS
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS 
    ? c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:5173',  // Vite dev server
        'http://localhost:4173',  // Vite preview
        'http://localhost:8787',  // Wrangler dev
      ];
  
  return cors({
    origin: (origin) => {
      // Allow all origins in development
      if (allowedOrigins.includes('*')) {
        return origin;
      }
      // Check if origin is allowed
      if (allowedOrigins.some(allowed => origin.includes(allowed))) {
        return origin;
      }
      // Default to first allowed origin
      return allowedOrigins[0] || '*';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Request-Id'],
    maxAge: 86400,
    credentials: true,
  })(c, next);
});

// Middleware: Pretty JSON
app.use('*', prettyJSON());

// Health check
app.get('/', (c) => {
  return c.json({
    name: 'Project Monitor API',
    version: '2.0.0',
    status: 'healthy',
    features: {
      kv: !!c.env.KV,
      scan: true,
      alerts: true,
      projectManagement: true,
    },
    timestamp: new Date().toISOString()
  });
});

// API health check
app.get('/api', (c) => {
  return c.json({
    name: 'Project Monitor API',
    version: '2.0.0',
    endpoints: [
      // Projects
      'GET    /api/projects           - Get all projects',
      'GET    /api/projects/:name     - Get project by name',
      'POST   /api/projects/:name/group       - Set project group',
      'POST   /api/projects/:name/favorite   - Set project favorite',
      'GET    /api/projects/:name/config      - Get project config',
      'PUT    /api/projects/:name/config      - Update project config',
      'GET    /api/projects/groups            - Get all project groups',
      
      // Snapshots
      'GET /api/snapshots           - Get available snapshot dates',
      'GET /api/snapshots/:date     - Get snapshot for date',
      
      // Reports
      'GET /api/reports             - Get list of reports',
      'GET /api/reports/:date       - Get report content (markdown)',
      'GET /api/reports/:date/json  - Get report as JSON',
      
      // Alerts (P0)
      'GET    /api/alerts            - Get all alerts',
      'GET    /api/alerts/active     - Get active alerts',
      'GET    /api/alerts/:id        - Get alert by ID',
      'POST   /api/alerts/:id/acknowledge - Acknowledge alert',
      'POST   /api/alerts/:id/ignore      - Ignore alert',
      'GET    /api/alerts/config     - Get alert configuration',
      'PUT    /api/alerts/config     - Update alert configuration',
      
      // Scan (P0)
      'GET    /api/scan/latest       - Get latest scan data',
      'GET    /api/scan/status       - Get scan system status',
      'POST   /api/scan              - Submit scan data (external)',
      'POST   /api/scan/trigger      - Trigger alert check',
      'POST   /api/scan              - Trigger scan (requires token)',
    ]
  });
});

// Mount routers
app.route('/api/projects', projectsRouter);
app.route('/api/projects', projectsManageRouter);
app.route('/api/snapshots', snapshotsRouter);
app.route('/api/reports', reportsRouter);
app.route('/api/alerts', alertsRouter);
app.route('/api/scan', scanRouter);

// POST /api/scan - Trigger scan (legacy endpoint, calls /api/scan/trigger)
app.post('/api/scan', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const expectedToken = c.env.SCAN_TOKEN;
  
  // If SCAN_TOKEN is not configured, deny access
  if (!expectedToken) {
    return c.json({ 
      error: 'Scan not configured', 
      message: 'SCAN_TOKEN not configured in environment' 
    }, 503);
  }
  
  // Validate token
  if (!token || token !== expectedToken) {
    return c.json({ 
      error: 'Unauthorized', 
      message: 'Invalid or missing authorization token' 
    }, 401);
  }
  
  // In production, this would trigger the scan on the local machine
  // For now, just return instructions
  return c.json({
    success: false,
    message: 'Use local scanner script to scan projects',
    instructions: {
      step1: 'Run: cd ~/Codes/project-monitor && npx tsx scripts/scan-and-push.ts',
      step2: 'Or set up a cron job on your local machine',
    },
    note: 'Cloudflare Workers cannot access local file system directly',
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: `Route ${c.req.method} ${c.req.path} not found`,
    hint: 'Check /api for available endpoints'
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message
  }, 500);
});

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: EnvBindings, ctx: ExecutionContext) {
    // Initialize data on first request
    if (!dataInitialized) {
      await initializeData(env);
      dataInitialized = true;
    }
    
    return app.fetch(request, env, ctx);
  }
};

// Cron trigger handler (for scheduled scans)
export const scheduled = async (event: ScheduledEvent, env: EnvBindings, ctx: ExecutionContext) => {
  console.log('Cron triggered at:', new Date().toISOString());
  
  // Initialize data
  if (!dataInitialized) {
    await initializeData(env);
    dataInitialized = true;
  }
  
  // This would typically trigger an external scan
  // Since Workers can't access local file system, we log the event
  // In production, you would call an external webhook or API
  
  console.log('Cron scan event processed');
};
