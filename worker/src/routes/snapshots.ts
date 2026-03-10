import { Hono } from 'hono';
import type { Context } from 'hono';
import { getSnapshot, getSnapshotDates } from '../utils/data';

export const snapshotsRouter = new Hono();

/**
 * GET /api/snapshots
 * Get list of available snapshot dates
 */
snapshotsRouter.get('/', (c: Context) => {
  const dates = getSnapshotDates();
  
  return c.json({
    dates,
    count: dates.length
  });
});

/**
 * GET /api/snapshots/:date
 * Get snapshot data for a specific date
 */
snapshotsRouter.get('/:date', (c: Context) => {
  const date = c.req.param('date');
  
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return c.json({ 
      error: 'Invalid date format', 
      message: 'Date must be in YYYY-MM-DD format' 
    }, 400);
  }
  
  const snapshot = getSnapshot(date);
  
  if (!snapshot) {
    return c.json({ 
      error: 'Snapshot not found', 
      message: `No snapshot available for ${date}` 
    }, 404);
  }
  
  // Transform to match frontend expected format
  const response = {
    date: snapshot.date,
    generatedAt: snapshot.generatedAt,
    projects: snapshot.projects.map(p => ({
      name: p.name,
      path: p.path,
      branch: p.branch,
      status: p.status,
      lastCommitTime: p.lastCommitTime,
      commits: p.commits,
      fileChanges: p.fileChanges
    }))
  };
  
  return c.json(response);
});
