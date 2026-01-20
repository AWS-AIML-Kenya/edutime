import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateBody, validateQuery, validateParams } from '@/utils/validation';
import {
  CreateVenueSchema,
  UpdateVenueSchema,
  VenueQuerySchema,
  type ApiResponse,
  type PaginatedResponse,
} from '@/types/api';
import { Venue, Timetable, TimetableStatus } from '@prisma/client';
import { getCurrentDateString, getCurrentTimeString, timeStringToDate } from '@/utils/time';

const router = Router();

// Parameter validation schema
const VenueParamsSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});

type VenueWithStats = Venue & {
  scheduledSessions?: number;
  isCurrentlyOccupied?: boolean;
  currentSession?: Timetable | null;
  upcomingSessions?: Timetable[];
};

/**
 * Get all venues with filtering and pagination
 * GET /api/v1/venues
 */
router.get(
  '/',
  validateQuery(VenueQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const {
        page,
        limit,
        availableOnly,
        minCapacity,
        search,
      } = req.query as any;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (availableOnly) {
        where.isAvailable = true;
      }

      if (minCapacity) {
        where.capacity = {
          gte: minCapacity,
        };
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
          { facilities: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get venues with current occupancy information
      const [venues, total] = await Promise.all([
        prisma.venue.findMany({
          where,
          include: {
            timetables: {
              where: {
                date: new Date(getCurrentDateString()),
                status: {
                  not: TimetableStatus.CANCELLED,
                },
              },
              orderBy: {
                startTime: 'asc',
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
          skip,
          take: limit,
        }),
        prisma.venue.count({ where }),
      ]);

      // Add occupancy information
      const currentTime = getCurrentTimeString();
      const venuesWithStats: VenueWithStats[] = venues.map(venue => {
        const currentSession = venue.timetables.find(session => {
          const startTime = session.startTime.toTimeString().slice(0, 5);
          const endTime = session.endTime.toTimeString().slice(0, 5);
          
          const current = timeStringToDate(currentTime);
          const start = timeStringToDate(startTime);
          const end = timeStringToDate(endTime);
          
          return current >= start && current <= end;
        });

        const upcomingSessions = venue.timetables.filter(session => {
          const startTime = session.startTime.toTimeString().slice(0, 5);
          const current = timeStringToDate(currentTime);
          const start = timeStringToDate(startTime);
          
          return current < start;
        });

        return {
          ...venue,
          scheduledSessions: venue.timetables.length,
          isCurrentlyOccupied: !!currentSession,
          currentSession: currentSession || null,
          upcomingSessions,
          timetables: undefined, // Remove from response
        };
      });

      const response: PaginatedResponse<VenueWithStats> = {
        success: true,
        data: venuesWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching venues:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch venues',
      });
    }
  }
);

/**
 * Get venue by ID with detailed schedule
 * GET /api/v1/venues/:id
 */
router.get(
  '/:id',
  validateParams(VenueParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      const venue = await prisma.venue.findUnique({
        where: { id },
        include: {
          timetables: {
            where: {
              date: {
                gte: new Date(getCurrentDateString()),
              },
              status: {
                not: TimetableStatus.CANCELLED,
              },
            },
            orderBy: [
              { date: 'asc' },
              { startTime: 'asc' },
            ],
            take: 50, // Limit to next 50 sessions
          },
        },
      });

      if (!venue) {
        return res.status(404).json({
          success: false,
          error: 'Venue not found',
        });
      }

      // Add current occupancy information
      const currentTime = getCurrentTimeString();
      const today = getCurrentDateString();
      
      const todaysSessions = venue.timetables.filter(session => 
        session.date.toISOString().slice(0, 10) === today
      );

      const currentSession = todaysSessions.find(session => {
        const startTime = session.startTime.toTimeString().slice(0, 5);
        const endTime = session.endTime.toTimeString().slice(0, 5);
        
        const current = timeStringToDate(currentTime);
        const start = timeStringToDate(startTime);
        const end = timeStringToDate(endTime);
        
        return current >= start && current <= end;
      });

      const venueWithStats: VenueWithStats = {
        ...venue,
        scheduledSessions: venue.timetables.length,
        isCurrentlyOccupied: !!currentSession,
        currentSession: currentSession || null,
        upcomingSessions: venue.timetables,
      };

      const response: ApiResponse<VenueWithStats> = {
        success: true,
        data: venueWithStats,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching venue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch venue',
      });
    }
  }
);

/**
 * Create new venue
 * POST /api/v1/venues
 */
router.post(
  '/',
  validateBody(CreateVenueSchema),
  async (req: Request, res: Response) => {
    try {
      const data = req.body;

      // Check if venue name already exists
      const existingVenue = await prisma.venue.findFirst({
        where: {
          name: data.name,
        },
      });

      if (existingVenue) {
        return res.status(409).json({
          success: false,
          error: 'A venue with this name already exists',
        });
      }

      // Create venue
      const venue = await prisma.venue.create({
        data,
      });

      const response: ApiResponse<Venue> = {
        success: true,
        data: venue,
        message: 'Venue created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating venue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create venue',
      });
    }
  }
);

/**
 * Update venue
 * PUT /api/v1/venues/:id
 */
router.put(
  '/:id',
  validateParams(VenueParamsSchema),
  validateBody(UpdateVenueSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const data = req.body;

      // Check if venue exists
      const existingVenue = await prisma.venue.findUnique({
        where: { id },
      });

      if (!existingVenue) {
        return res.status(404).json({
          success: false,
          error: 'Venue not found',
        });
      }

      // Check if new name conflicts with existing venue
      if (data.name && data.name !== existingVenue.name) {
        const nameConflict = await prisma.venue.findFirst({
          where: {
            name: data.name,
            id: {
              not: id,
            },
          },
        });

        if (nameConflict) {
          return res.status(409).json({
            success: false,
            error: 'A venue with this name already exists',
          });
        }
      }

      // Update venue
      const venue = await prisma.venue.update({
        where: { id },
        data,
      });

      const response: ApiResponse<Venue> = {
        success: true,
        data: venue,
        message: 'Venue updated successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating venue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update venue',
      });
    }
  }
);

/**
 * Delete venue
 * DELETE /api/v1/venues/:id
 */
router.delete(
  '/:id',
  validateParams(VenueParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      // Check if venue exists
      const existingVenue = await prisma.venue.findUnique({
        where: { id },
        include: {
          timetables: {
            where: {
              status: {
                not: TimetableStatus.CANCELLED,
              },
              date: {
                gte: new Date(),
              },
            },
          },
        },
      });

      if (!existingVenue) {
        return res.status(404).json({
          success: false,
          error: 'Venue not found',
        });
      }

      // Check if venue has future scheduled sessions
      if (existingVenue.timetables.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Cannot delete venue with scheduled future sessions',
          data: {
            scheduledSessions: existingVenue.timetables.length,
          },
        });
      }

      // Delete venue
      await prisma.venue.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Venue deleted successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error deleting venue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete venue',
      });
    }
  }
);

/**
 * Get venue availability for a specific date
 * GET /api/v1/venues/:id/availability/:date
 */
router.get(
  '/:id/availability/:date',
  validateParams(z.object({
    id: z.string().transform(Number).pipe(z.number().int().positive()),
    date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
  })),
  async (req: Request, res: Response) => {
    try {
      const { id, date } = req.params as any;

      // Check if venue exists
      const venue = await prisma.venue.findUnique({
        where: { id },
      });

      if (!venue) {
        return res.status(404).json({
          success: false,
          error: 'Venue not found',
        });
      }

      // Get scheduled sessions for the date
      const scheduledSessions = await prisma.timetable.findMany({
        where: {
          venueId: id,
          date: new Date(date),
          status: {
            not: TimetableStatus.CANCELLED,
          },
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      // Calculate available time slots (assuming 8 AM to 8 PM operation)
      const operatingHours = {
        start: '08:00',
        end: '20:00',
      };

      const busySlots = scheduledSessions.map(session => ({
        start: session.startTime.toTimeString().slice(0, 5),
        end: session.endTime.toTimeString().slice(0, 5),
        subject: session.subject,
        lecturer: session.lecturer,
      }));

      const response: ApiResponse<{
        venue: Venue;
        date: string;
        operatingHours: typeof operatingHours;
        scheduledSessions: typeof scheduledSessions;
        busySlots: typeof busySlots;
        isAvailable: boolean;
      }> = {
        success: true,
        data: {
          venue,
          date,
          operatingHours,
          scheduledSessions,
          busySlots,
          isAvailable: venue.isAvailable,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching venue availability:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch venue availability',
      });
    }
  }
);

export default router;