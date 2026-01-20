import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateBody, validateQuery, validateParams } from '@/utils/validation';
import {
  CreateNotificationSchema,
  type ApiResponse,
  type PaginatedResponse,
} from '@/types/api';
import { Notification, NotificationType, NotificationStatus } from '@prisma/client';

const router = Router();

// Parameter validation schema
const NotificationParamsSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});

const NotificationQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
  type: z.nativeEnum(NotificationType).optional(),
  status: z.nativeEnum(NotificationStatus).optional(),
  timetableId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
});

/**
 * Get all notifications with filtering and pagination
 * GET /api/v1/notifications
 */
router.get(
  '/',
  validateQuery(NotificationQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const {
        page,
        limit,
        type,
        status,
        timetableId,
      } = req.query as any;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (type) where.type = type;
      if (status) where.status = status;
      if (timetableId) where.timetableId = timetableId;

      // Get notifications with timetable information
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            timetable: {
              include: {
                venue: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      const response: PaginatedResponse<typeof notifications[0]> = {
        success: true,
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications',
      });
    }
  }
);

/**
 * Get notification by ID
 * GET /api/v1/notifications/:id
 */
router.get(
  '/:id',
  validateParams(NotificationParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      const notification = await prisma.notification.findUnique({
        where: { id },
        include: {
          timetable: {
            include: {
              venue: true,
            },
          },
        },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      const response: ApiResponse<typeof notification> = {
        success: true,
        data: notification,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification',
      });
    }
  }
);

/**
 * Create new notification
 * POST /api/v1/notifications
 */
router.post(
  '/',
  validateBody(CreateNotificationSchema),
  async (req: Request, res: Response) => {
    try {
      const data = req.body;

      // Check if timetable exists
      const timetable = await prisma.timetable.findUnique({
        where: { id: data.timetableId },
      });

      if (!timetable) {
        return res.status(404).json({
          success: false,
          error: 'Timetable not found',
        });
      }

      // Create notification
      const notification = await prisma.notification.create({
        data: {
          timetableId: data.timetableId,
          type: data.type,
          message: data.message,
          recipients: data.recipients,
        },
        include: {
          timetable: {
            include: {
              venue: true,
            },
          },
        },
      });

      const response: ApiResponse<typeof notification> = {
        success: true,
        data: notification,
        message: 'Notification created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create notification',
      });
    }
  }
);

/**
 * Update notification status
 * PATCH /api/v1/notifications/:id/status
 */
router.patch(
  '/:id/status',
  validateParams(NotificationParamsSchema),
  validateBody(z.object({
    status: z.nativeEnum(NotificationStatus),
    sentAt: z.string().optional().refine((date) => !date || !isNaN(Date.parse(date)), 'Invalid date format'),
  })),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const { status, sentAt } = req.body;

      // Check if notification exists
      const existingNotification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!existingNotification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      // Update notification status
      const updateData: any = { status };
      
      if (sentAt) {
        updateData.sentAt = new Date(sentAt);
      } else if (status === NotificationStatus.SENT && !existingNotification.sentAt) {
        updateData.sentAt = new Date();
      }

      const notification = await prisma.notification.update({
        where: { id },
        data: updateData,
        include: {
          timetable: {
            include: {
              venue: true,
            },
          },
        },
      });

      const response: ApiResponse<typeof notification> = {
        success: true,
        data: notification,
        message: 'Notification status updated successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating notification status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notification status',
      });
    }
  }
);

/**
 * Delete notification
 * DELETE /api/v1/notifications/:id
 */
router.delete(
  '/:id',
  validateParams(NotificationParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      // Check if notification exists
      const existingNotification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!existingNotification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
      }

      // Delete notification
      await prisma.notification.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Notification deleted successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification',
      });
    }
  }
);

/**
 * Get notifications for a specific timetable
 * GET /api/v1/notifications/timetable/:timetableId
 */
router.get(
  '/timetable/:timetableId',
  validateParams(z.object({
    timetableId: z.string().transform(Number).pipe(z.number().int().positive()),
  })),
  async (req: Request, res: Response) => {
    try {
      const { timetableId } = req.params as any;

      // Check if timetable exists
      const timetable = await prisma.timetable.findUnique({
        where: { id: timetableId },
      });

      if (!timetable) {
        return res.status(404).json({
          success: false,
          error: 'Timetable not found',
        });
      }

      const notifications = await prisma.notification.findMany({
        where: { timetableId },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const response: ApiResponse<Notification[]> = {
        success: true,
        data: notifications,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching timetable notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetable notifications',
      });
    }
  }
);

/**
 * Mark multiple notifications as sent
 * PATCH /api/v1/notifications/bulk-update-status
 */
router.patch(
  '/bulk-update-status',
  validateBody(z.object({
    notificationIds: z.array(z.number().int().positive()).min(1),
    status: z.nativeEnum(NotificationStatus),
  })),
  async (req: Request, res: Response) => {
    try {
      const { notificationIds, status } = req.body;

      const updateData: any = { status };
      
      if (status === NotificationStatus.SENT) {
        updateData.sentAt = new Date();
      }

      // Update multiple notifications
      const result = await prisma.notification.updateMany({
        where: {
          id: {
            in: notificationIds,
          },
        },
        data: updateData,
      });

      const response: ApiResponse<{ updatedCount: number }> = {
        success: true,
        data: { updatedCount: result.count },
        message: `${result.count} notifications updated successfully`,
      };

      res.json(response);
    } catch (error) {
      console.error('Error bulk updating notification status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk update notification status',
      });
    }
  }
);

export default router;