import { Hono } from 'hono';
import type { Context } from 'hono';
import { getDailyReports, getReportContent, getReportDates } from '../utils/data';
import { setReportContent, getReportContent as getReportFromKV, getReportDates as getReportDatesFromKV } from '../utils/kv';

type EnvBindings = {
  KV: KVNamespace;
  ENVIRONMENT: string;
  SCAN_TOKEN?: string;
};

export const reportsRouter = new Hono<{ Bindings: EnvBindings }>();

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(date);
}

/**
 * Validate scan token
 */
function validateToken(c: Context): boolean {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const expectedToken = c.env.SCAN_TOKEN;
  
  // If SCAN_TOKEN is not configured, allow for development
  if (!expectedToken) {
    console.warn('SCAN_TOKEN not configured, allowing report upload');
    return true;
  }
  
  return token === expectedToken;
}

/**
 * GET /api/reports
 * Get list of daily reports
 */
reportsRouter.get('/', async (c: Context) => {
  const kv = c.env.KV;
  
  // Try KV first, then fallback to embedded
  if (kv) {
    try {
      const kvDates = await getReportDatesFromKV(kv);
      if (kvDates.length > 0) {
        const reports = kvDates.map(date => ({
          date,
          totalProjects: 0,
          totalCommits: 0,
          projects: []
        })).sort((a, b) => b.date.localeCompare(a.date));
        
        return c.json({
          reports,
          count: reports.length,
          source: 'kv'
        });
      }
    } catch (error) {
      console.error('Failed to get KV reports:', error);
    }
  }
  
  // Fallback to embedded data
  const reports = getDailyReports();
  const sorted = reports.sort((a, b) => b.date.localeCompare(a.date));
  
  return c.json({
    reports: sorted,
    count: sorted.length,
    source: 'embedded'
  });
});

/**
 * POST /api/reports/:date
 * Upload daily report content for a specific date
 */
reportsRouter.post('/:date', async (c: Context) => {
  const kv = c.env.KV;
  
  if (!kv) {
    return c.json({
      error: 'KV not configured',
      message: 'KV namespace is required for report storage',
    }, 503);
  }
  
  // Validate token
  if (!validateToken(c)) {
    return c.json({
      error: 'Unauthorized',
      message: 'Invalid or missing authorization token',
    }, 401);
  }
  
  const date = c.req.param('date');
  
  // Validate date format
  if (!isValidDate(date)) {
    return c.json({ 
      error: 'Invalid date format', 
      message: 'Date must be in YYYY-MM-DD format' 
    }, 400);
  }
  
  try {
    const content = await c.req.text();
    
    if (!content || content.trim().length === 0) {
      return c.json({
        error: 'Invalid request',
        message: 'Report content cannot be empty',
      }, 400);
    }
    
    // Store report content
    await setReportContent(kv, date, content);
    
    console.log(`Report uploaded for ${date}: ${content.length} bytes`);
    
    return c.json({
      success: true,
      message: 'Report uploaded successfully',
      date,
      size: content.length,
    });
  } catch (error) {
    console.error('Failed to store report:', error);
    return c.json({
      error: 'Failed to store report',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/reports/:date
 * Get daily report content for a specific date
 */
reportsRouter.get('/:date', async (c: Context) => {
  const date = c.req.param('date');
  
  // Validate date format
  if (!isValidDate(date)) {
    return c.json({ 
      error: 'Invalid date format', 
      message: 'Date must be in YYYY-MM-DD format' 
    }, 400);
  }
  
  const kv = c.env.KV;
  
  // Try to get report from KV first
  if (kv) {
    const content = await getReportFromKV(kv, date);
    if (content) {
      // Return markdown content with proper content type
      return new Response(content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
  
  // Fallback to embedded data
  const content = getReportContent(date);
  
  if (!content || content.startsWith('Report not found')) {
    return c.json({ 
      error: 'Report not found', 
      message: `No report available for ${date}` 
    }, 404);
  }
  
  // Return markdown content with proper content type
  return new Response(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
});

/**
 * GET /api/reports/:date/json
 * Get daily report as JSON for a specific date
 */
reportsRouter.get('/:date/json', async (c: Context) => {
  const date = c.req.param('date');
  
  // Validate date format
  if (!isValidDate(date)) {
    return c.json({ 
      error: 'Invalid date format', 
      message: 'Date must be in YYYY-MM-DD format' 
    }, 400);
  }
  
  const kv = c.env.KV;
  
  // Try to get report from KV first
  if (kv) {
    const content = await getReportFromKV(kv, date);
    if (content) {
      // Return as JSON with markdown content
      return c.json({
        date,
        content,
        format: 'markdown',
        source: 'kv'
      });
    }
  }
  
  // Fallback to embedded data
  const content = getReportContent(date);
  
  if (!content || content.startsWith('Report not found')) {
    return c.json({ 
      error: 'Report not found', 
      message: `No report available for ${date}` 
    }, 404);
  }
  
  // Return as JSON with markdown content
  return c.json({
    date,
    content,
    format: 'markdown',
    source: 'embedded'
  });
});
