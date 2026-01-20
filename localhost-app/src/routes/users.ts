import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateBody, validateQuery, validateParams } from '@/utils/validation';
import {
  CreateUserSchema,
  UpdateUserSchema,
  type ApiResponse,
  type PaginatedResponse,
} from '@/types/api';
import { User, UserRole } from '@prisma/client';

const router = Router();

// Parameter validation schema
const UserParamsSchema = z.object({
  id: z.string().transform(Number).pipe(z.number().int().positive()),
});

const UserQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
  role: z.nativeEnum(UserRole).optional(),
  search: z.string().optional(),
  isActive: z.string().transform((val) => val === 'true').optional(),
});

/**
 * Get all users with filtering and pagination
 * GET /api/v1/users
 */
router.get(
  '/',
  validateQuery(UserQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const {
        page,
        limit,
        role,
        search,
        isActive,
      } = req.query as any;

      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive;

      if (search) {
        where.OR = [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { userId: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Get users
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: {
            fullName: 'asc',
          },
          skip,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      const response: PaginatedResponse<User> = {
        success: true,
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
      });
    }
  }
);

/**
 * Get user by ID
 * GET /api/v1/users/:id
 */
router.get(
  '/:id',
  validateParams(UserParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const response: ApiResponse<User> = {
        success: true,
        data: user,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }
);

/**
 * Get user by userId (external ID)
 * GET /api/v1/users/by-user-id/:userId
 */
router.get(
  '/by-user-id/:userId',
  validateParams(z.object({
    userId: z.string().min(1),
  })),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const response: ApiResponse<User> = {
        success: true,
        data: user,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching user by userId:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      });
    }
  }
);

/**
 * Create new user
 * POST /api/v1/users
 */
router.post(
  '/',
  validateBody(CreateUserSchema),
  async (req: Request, res: Response) => {
    try {
      const data = req.body;

      // Check if userId or email already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { userId: data.userId },
            { email: data.email },
          ],
        },
      });

      if (existingUser) {
        const conflictField = existingUser.userId === data.userId ? 'userId' : 'email';
        return res.status(409).json({
          success: false,
          error: `A user with this ${conflictField} already exists`,
        });
      }

      // Create user
      const user = await prisma.user.create({
        data,
      });

      const response: ApiResponse<User> = {
        success: true,
        data: user,
        message: 'User created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create user',
      });
    }
  }
);

/**
 * Update user
 * PUT /api/v1/users/:id
 */
router.put(
  '/:id',
  validateParams(UserParamsSchema),
  validateBody(UpdateUserSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;
      const data = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Check for conflicts if userId or email is being updated
      if (data.userId || data.email) {
        const conflicts = [];
        
        if (data.userId && data.userId !== existingUser.userId) {
          const userIdConflict = await prisma.user.findFirst({
            where: {
              userId: data.userId,
              id: { not: id },
            },
          });
          if (userIdConflict) conflicts.push('userId');
        }

        if (data.email && data.email !== existingUser.email) {
          const emailConflict = await prisma.user.findFirst({
            where: {
              email: data.email,
              id: { not: id },
            },
          });
          if (emailConflict) conflicts.push('email');
        }

        if (conflicts.length > 0) {
          return res.status(409).json({
            success: false,
            error: `A user with this ${conflicts.join(' and ')} already exists`,
          });
        }
      }

      // Update user
      const user = await prisma.user.update({
        where: { id },
        data,
      });

      const response: ApiResponse<User> = {
        success: true,
        data: user,
        message: 'User updated successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user',
      });
    }
  }
);

/**
 * Delete user
 * DELETE /api/v1/users/:id
 */
router.delete(
  '/:id',
  validateParams(UserParamsSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params as any;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Delete user
      await prisma.user.delete({
        where: { id },
      });

      const response: ApiResponse = {
        success: true,
        message: 'User deleted successfully',
      };

      res.json(response);
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete user',
      });
    }
  }
);

/**
 * Get users by role
 * GET /api/v1/users/by-role/:role
 */
router.get(
  '/by-role/:role',
  validateParams(z.object({
    role: z.nativeEnum(UserRole),
  })),
  async (req: Request, res: Response) => {
    try {
      const { role } = req.params as any;

      const users = await prisma.user.findMany({
        where: {
          role,
          isActive: true,
        },
        orderBy: {
          fullName: 'asc',
        },
      });

      const response: ApiResponse<User[]> = {
        success: true,
        data: users,
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching users by role:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users by role',
      });
    }
  }
);

export default router;