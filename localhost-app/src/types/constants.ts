// Database enum constants (since SQLite doesn't support enums)

export const TimetableStatus = {
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  IN_PROGRESS: 'in_progress',
} as const;

export const UserType = {
  STUDENT: 'student',
  CLASS_REP: 'class_rep',
  LECTURER: 'lecturer',
} as const;

export const AttendanceConfirmationStatus = {
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  MAYBE: 'maybe',
} as const;

export const NotificationType = {
  VENUE_CHANGE: 'venue_change',
  ATTENDANCE_CONFIRMATION: 'attendance_confirmation',
  CLASS_REMINDER: 'class_reminder',
  CANCELLATION: 'cancellation',
} as const;

export const NotificationStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export const UserRole = {
  STUDENT: 'student',
  CLASS_REP: 'class_rep',
  LECTURER: 'lecturer',
  ADMIN: 'admin',
} as const;

// Type definitions
export type TimetableStatusType = typeof TimetableStatus[keyof typeof TimetableStatus];
export type UserTypeType = typeof UserType[keyof typeof UserType];
export type AttendanceConfirmationStatusType = typeof AttendanceConfirmationStatus[keyof typeof AttendanceConfirmationStatus];
export type NotificationTypeType = typeof NotificationType[keyof typeof NotificationType];
export type NotificationStatusType = typeof NotificationStatus[keyof typeof NotificationStatus];
export type UserRoleType = typeof UserRole[keyof typeof UserRole];