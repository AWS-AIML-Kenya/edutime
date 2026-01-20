import { format, parse, isValid, isBefore, isAfter, isEqual } from 'date-fns';

/**
 * Convert time string (HH:MM) to Date object for today
 */
export const timeStringToDate = (timeString: string): Date => {
  const today = new Date();
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
  return date;
};

/**
 * Convert Date object to time string (HH:MM)
 */
export const dateToTimeString = (date: Date): string => {
  return format(date, 'HH:mm');
};

/**
 * Check if two time periods overlap
 */
export const timePeriodsOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const startTime1 = timeStringToDate(start1);
  const endTime1 = timeStringToDate(end1);
  const startTime2 = timeStringToDate(start2);
  const endTime2 = timeStringToDate(end2);

  // Check if periods overlap
  return (
    (isBefore(startTime1, endTime2) || isEqual(startTime1, endTime2)) &&
    (isAfter(endTime1, startTime2) || isEqual(endTime1, startTime2))
  );
};

/**
 * Validate time string format (HH:MM)
 */
export const isValidTimeString = (timeString: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
};

/**
 * Check if start time is before end time
 */
export const isValidTimeRange = (startTime: string, endTime: string): boolean => {
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    return false;
  }

  const start = timeStringToDate(startTime);
  const end = timeStringToDate(endTime);
  
  return isBefore(start, end);
};

/**
 * Format date for database storage (YYYY-MM-DD)
 */
export const formatDateForDB = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
};

/**
 * Parse date string and validate
 */
export const parseAndValidateDate = (dateString: string): Date | null => {
  const date = new Date(dateString);
  return isValid(date) ? date : null;
};

/**
 * Get current time as HH:MM string
 */
export const getCurrentTimeString = (): string => {
  return format(new Date(), 'HH:mm');
};

/**
 * Get current date as YYYY-MM-DD string
 */
export const getCurrentDateString = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};

/**
 * Check if a class is currently happening
 */
export const isClassCurrentlyHappening = (
  classDate: string,
  startTime: string,
  endTime: string
): boolean => {
  const today = getCurrentDateString();
  const currentTime = getCurrentTimeString();
  
  if (classDate !== today) {
    return false;
  }
  
  const current = timeStringToDate(currentTime);
  const start = timeStringToDate(startTime);
  const end = timeStringToDate(endTime);
  
  return (isAfter(current, start) || isEqual(current, start)) && 
         (isBefore(current, end) || isEqual(current, end));
};

/**
 * Check if a class is upcoming today
 */
export const isClassUpcomingToday = (
  classDate: string,
  startTime: string
): boolean => {
  const today = getCurrentDateString();
  const currentTime = getCurrentTimeString();
  
  if (classDate !== today) {
    return false;
  }
  
  const current = timeStringToDate(currentTime);
  const start = timeStringToDate(startTime);
  
  return isBefore(current, start);
};