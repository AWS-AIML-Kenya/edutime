import { Router, Request, Response } from 'express';
import prisma from '@/lib/prisma';

const router = Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    res.status(200).json(healthData);
  } catch (error) {
    console.error('Health check failed:', error);
    
    const healthData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'disconnected',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    res.status(503).json(healthData);
  }
});

/**
 * Detailed health check endpoint
 * GET /health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    // Test database connection and get some stats
    const [dbTest, venueCount, timetableCount, userCount] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.venue.count(),
      prisma.timetable.count(),
      prisma.user.count(),
    ]);

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'connected',
        stats: {
          venues: venueCount,
          timetables: timetableCount,
          users: userCount,
        },
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    res.status(200).json(healthData);
  } catch (error) {
    console.error('Detailed health check failed:', error);
    
    const healthData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };

    res.status(503).json(healthData);
  }
});

export default router;