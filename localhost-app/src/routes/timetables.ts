import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateBody, validateQuery, validateParams } from '@/utils/validation';
import {
  CreateTimetableSchema,
  UpdateTimetableSchema,
  TimetableQuerySchema,
  VenueConflictCheckSchema,
  type ApiResponse,
  type PaginatedResponse,
} from '@/types/api';
import { timePeriodsOverlap, isValidTimeRange, formatDateForDB } from '@/utils/time';
import { TimetableStatus } from '@/types/constants';
import { Timetable, Venue } from '@prisma/client';

const router = Router();

// Parameter validation schema
const TimetableParamsSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});

type TimetableWithVenue = Timetable & {
  venue: Venue | null;
};

/**
 * Get all timetables with filtering and pagination
 * GET /api/v1/timetables
 */
router.get(
  '/',
  validateQuery(TimetableQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const {
        page,
        limit,
        classRep,
        lecturer,
        date,
        venueId,
        status,
        startDate,
        endDate,
      } = req.query as any;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (classRep) where.classRep = classRep;
      if (lecturer) where.lecturer = lecturer;
      if (status) where.status = status;
      if (venueId) where.venueId = venueId;

      // Date filtering
      if (date) {
        where.date = new Date(date);
      } else if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      // Get timetables with venue information
      const [timetables, total] = await Promise.all([
        prisma.timetable.findMany({
          where,
          include: {
            venue: true,
          },
          orderBy: [
            { date: 'asc' },
            { startTime: 'asc' },
          ],
          skip,
          take: limit,
        }),
        prisma.timetable.count({ where }),
      ]);

      const response: PaginatedResponse<TimetableWithVenue> = {
        success: true,
        data: timetables,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching timetables:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetables',
      });
    }
  }
);

/**
 * Get timetable by ID
 * GET /api/v1/timetables/:id
 */
router.get(
  '/:id',
  validateParams(TimetableParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      const timetable = await prisma.timetable.findUnique({
        where: { id },
        include: {
          venue: true,
          attendanceConfirmations: true,
          notifications: true,
        },
      });

      if (!timetable) {
        return res.status(404).json({
          success: false,
          error: 'Timetable not found',
        });
      }

      const response: ApiResponse<typeof timetable> = {
        success: true,
        data: timetable,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching timetable:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetable',
      });
    }
  }
);

/**
 * Create new timetable
 * POST /api/v1/timetables
 */
router.post(
  '/',
  validateBody(CreateTimetableSchema),
  async (req: Request, res: Response) => {
    try {
      const data = req.body;

      // Validate time range
      if (!isValidTimeRange(data.startTime, data.endTime)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid time range: start time must be before end time',
        });
      }

      // Check for venue conflicts
      const existingTimetables = await prisma.timetable.findMany({
        where: {
          venueId: data.venueId,
          date: new Date(data.date),
          status: {
            not: 'cancelled',
          },
        },
      });

      const hasConflict = existingTimetables.some(existing => 
        timePeriodsOverlap(
          data.startTime,
          data.endTime,
          existing.startTime.toTimeString().slice(0, 5),
          existing.endTime.toTimeString().slice(0, 5)
        )
      );

      if (hasConflict) {
        return res.status(409).json({
          success: false,
          error: 'Venue conflict detected for the specified time slot',
        });
      }

      // Create timetable
      const timetable = await prisma.timetable.create({
        data: {
          subject: data.subject,
          lecturer: data.lecturer,
          classRep: data.classRep,
          date: new Date(data.date),
          startTime: new Date(`1970-01-01T${data.startTime}:00Z`),
          endTime: new Date(`1970-01-01T${data.endTime}:00Z`),
          venueId: data.venueId,
          notes: data.notes,
        },
        include: {
          venue: true,
        },
      });

      const response: ApiResponse<typeof timetable> = {
        success: true,
        data: timetable,
        message: 'Timetable created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating timetable:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create timetable',
      });
    }
  }
);

/**
 * Update timetable
 * PUT /api/v1/timetables/:id
 */
router.put(
  '/:id',
  validateParams(TimetableParamsSchema),
  validateBody(UpdateTimetableSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const data = req.body;

      // Check if timetable exists
      const existingTimetable = await prisma.timetable.findUnique({
        where: { id },
      });

      if (!existingTimetable) {
        return res.status(404).json({
          success: false,
          error: 'Timetable not found',
        });
      }

      // Validate time range if both times are provided
      if (data.startTime && data.endTime && !isValidTimeRange(data.startTime, data.endTime)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid time range: start time must be before end time',
        });
      }

      // Check for conflicts if venue, date, or time is being updated
      if (data.venueId || data.date || data.startTime || data.endTime) {
        const checkVenueId = data.venueId ?? existingTimetable.venueId;
        const checkDate = data.date ? new Date(data.date) : existingTimetable.date;
        const checkStartTime = data.startTime ?? existingTimetable.startTime.toTimeString().slice(0, 5);
        const checkEndTime = data.endTime ?? existingTimetable.endTime.toTimeString().slice(0, 5);

        const conflictingTimetables = await prisma.timetable.findMany({
          where: {
            venueId: checkVenueId,
            date: checkDate,
            status: {
              not: 'cancelled',
            },
            id: {
              not: id,
            },
          },
        });

        const hasConflict = conflictingTimetables.some(existing => 
          timePeriodsOverlap(
            checkStartTime,
            checkEndTime,
            existing.startTime.toTimeString().slice(0, 5),
            existing.endTime.toTimeString().slice(0, 5)
          )
        );

        if (hasConflict) {
          return res.status(409).json({
            success: false,
            error: 'Venue conflict detected for the specified time slot',
          });
        }
      }

      // Prepare update data
      const updateData: any = {};
      
      if (data.subject !== undefined) updateData.subject = data.subject;
      if (data.lecturer !== undefined) updateData.lecturer = data.lecturer;
      if (data.classRep !== undefined) updateData.classRep = data.classRep;
      if (data.date !== undefined) updateData.date = new Date(data.date);
      if (data.startTime !== undefined) updateData.startTime = new Date(`1970-01-01T${data.startTime}:00Z`);
      if (data.endTime !== undefined) updateData.endTime = new Date(`1970-01-01T${data.endTime}:00Z`);
      if (data.venueId !== undefined) updateData.venueId = data.venueId;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.status !== undefined) updateData.status = data.status;

      // Update timetable
      const timetable = await prisma.timetable.update({
        where: { id },
        data: updateData,
        include: {
          venue: true,
        },
      });

      const response: ApiResponse<typeof timetable> = {
        success: true,
        data: timetable,
        message: 'Timetable updated successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating timetable:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update timetable',
      });
    }
  }
);

/**
 * Delete timetable
 * DELETE /api/v1/timetables/:id
 */
router.delete(
  '/:id',
  validateParams(TimetableParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      // Check if timetable exists
      const existingTimetable = await prisma.timetable.findUnique({
        where: { id },
      });

      if (!existingTimetable) {
        return res.status(404).json({
          success: false,
          error: 'Timetable not found',
        });
      }

      // Delete timetable (this will cascade delete related records)
      await prisma.timetable.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Timetable deleted successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error deleting timetable:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete timetable',
      });
    }
  }
);

/**
 * Check venue conflicts
 * POST /api/v1/timetables/check-conflicts
 */
router.post(
  '/check-conflicts',
  validateBody(VenueConflictCheckSchema),
  async (req: Request, res: Response) => {
    try {
      const { venueId, date, startTime, endTime, excludeTimetableId } = req.body;

      // Validate time range
      if (!isValidTimeRange(startTime, endTime)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid time range: start time must be before end time',
        });
      }

      // Find conflicting timetables
      const where: any = {
        venueId,
        date: new Date(date),
        status: {
          not: TimetableStatus.CANCELLED,
        },
      };

      if (excludeTimetableId) {
        where.id = {
          not: excludeTimetableId,
        };
      }

      const existingTimetables = await prisma.timetable.findMany({
        where,
        include: {
          venue: true,
        },
      });

      const conflicts = existingTimetables.filter(existing => 
        timePeriodsOverlap(
          startTime,
          endTime,
          existing.startTime.toTimeString().slice(0, 5),
          existing.endTime.toTimeString().slice(0, 5)
        )
      );

      const response: ApiResponse<{
        hasConflicts: boolean;
        conflicts: typeof conflicts;
      }> = {
        success: true,
        data: {
          hasConflicts: conflicts.length > 0,
          conflicts,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error checking venue conflicts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check venue conflicts',
      });
    }
  }
);

export default router;