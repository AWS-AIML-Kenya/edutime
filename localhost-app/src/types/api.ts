import { z } from 'zod';
import { 
  TimetableStatus, 
  UserType, 
  AttendanceConfirmationStatus, 
  NotificationType, 
  NotificationStatus, 
  UserRole,
  type TimetableStatusType,
  type UserTypeType,
  type AttendanceConfirmationStatusType,
  type NotificationTypeType,
  type NotificationStatusType,
  type UserRoleType
} from './constants';

// Base response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Validation schemas
export const CreateTimetableSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  lecturer: z.string().min(1, 'Lecturer is required').max(255),
  classRep: z.string().min(1, 'Class representative is required').max(255),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  venueId: z.number().int().positive('Venue ID must be a positive integer'),
  notes: z.string().optional(),
});

export const UpdateTimetableSchema = CreateTimetableSchema.partial().extend({
  status: z.enum([TimetableStatus.SCHEDULED, TimetableStatus.CANCELLED, TimetableStatus.COMPLETED, TimetableStatus.IN_PROGRESS]).optional(),
});

export const CreateVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required').max(255),
  location: z.string().min(1, 'Location is required').max(255),
  capacity: z.number().int().positive('Capacity must be a positive integer'),
  facilities: z.string().optional(),
  isAvailable: z.boolean().optional().default(true),
});

export const UpdateVenueSchema = CreateVenueSchema.partial();

export const CreateUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required').max(255),
  email: z.string().email('Invalid email format').max(255),
  fullName: z.string().min(1, 'Full name is required').max(255),
  role: z.enum([UserRole.STUDENT, UserRole.CLASS_REP, UserRole.LECTURER, UserRole.ADMIN]),
  phoneNumber: z.string().max(20).optional(),
  notificationPreferences: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(true),
  }).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const CreateAttendanceConfirmationSchema = z.object({
  timetableId: z.number().int().positive(),
  userId: z.string().min(1).max(255),
  userType: z.enum([UserType.STUDENT, UserType.CLASS_REP, UserType.LECTURER]),
  status: z.enum([AttendanceConfirmationStatus.CONFIRMED, AttendanceConfirmationStatus.DECLINED, AttendanceConfirmationStatus.MAYBE]),
});

export const CreateNotificationSchema = z.object({
  timetableId: z.number().int().positive(),
  type: z.enum([NotificationType.VENUE_CHANGE, NotificationType.ATTENDANCE_CONFIRMATION, NotificationType.CLASS_REMINDER, NotificationType.CANCELLATION]),
  message: z.string().min(1, 'Message is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
});

export const VenueConflictCheckSchema = z.object({
  venueId: z.number().int().positive(),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  excludeTimetableId: z.number().int().positive().optional(),
});

// Query parameter schemas
export const TimetableQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
  classRep: z.string().optional(),
  lecturer: z.string().optional(),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date format').optional(),
  venueId: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  status: z.enum([TimetableStatus.SCHEDULED, TimetableStatus.CANCELLED, TimetableStatus.COMPLETED, TimetableStatus.IN_PROGRESS]).optional(),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid start date format').optional(),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid end date format').optional(),
});

export const VenueQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default('1'),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default('20'),
  availableOnly: z.string().transform((val) => val === 'true').optional(),
  minCapacity: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  search: z.string().optional(),
});

// Type exports
export type CreateTimetableInput = z.infer<typeof CreateTimetableSchema>;
export type UpdateTimetableInput = z.infer<typeof UpdateTimetableSchema>;
export type CreateVenueInput = z.infer<typeof CreateVenueSchema>;
export type UpdateVenueInput = z.infer<typeof UpdateVenueSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type CreateAttendanceConfirmationInput = z.infer<typeof CreateAttendanceConfirmationSchema>;
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
export type VenueConflictCheckInput = z.infer<typeof VenueConflictCheckSchema>;
export type TimetableQueryInput = z.infer<typeof TimetableQuerySchema>;
export type VenueQueryInput = z.infer<typeof VenueQuerySchema>;