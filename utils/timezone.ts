// Utility functions for timezone handling

export const SYSTEM_TIMEZONE = 'America/Sao_Paulo';

/**
 * Converts a Date object to a date string in the system timezone
 * This prevents timezone shifting when storing dates
 */
export function formatDateForDatabase(date: Date): string {
  // Use local date components to avoid timezone conversion issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates a Date object from a date string, treating it as local time
 * instead of UTC to prevent timezone shifts
 */
export function parseLocalDate(dateString: string): Date {
  // Handle ISO timestamp format (e.g., "2026-03-02T00:00:00.000Z")
  const cleanDate = dateString.split('T')[0];
  const [year, month, day] = cleanDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a date string for display in the local timezone
 */
export function formatDateForDisplay(dateString: string | null | undefined): string {
  if (!dateString || dateString === 'null' || dateString === 'undefined') {
    return '-';
  }
  
  // Handle different date formats that might come from database
  const cleanDateString = dateString.toString().trim();
  
  if (!cleanDateString || cleanDateString === 'null' || cleanDateString === 'undefined') {
    return '-';
  }
  
  try {
    // Handle YYYY-MM-DD format (PostgreSQL date format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateString)) {
      const [year, month, day] = cleanDateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Validate the created date
      if (isNaN(date.getTime()) || 
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day) {
        return '-';
      }
      
      return date.toLocaleDateString('pt-BR');
    }
    
    // Handle ISO timestamp format (YYYY-MM-DDTHH:mm:ss.sssZ)
    if (/^\d{4}-\d{2}-\d{2}T/.test(cleanDateString)) {
      const date = new Date(cleanDateString);
      if (isNaN(date.getTime())) {
        return '-';
      }
      return date.toLocaleDateString('pt-BR');
    }
    
    // Last resort: try direct parsing
    const date = new Date(cleanDateString);
    if (isNaN(date.getTime())) {
      return '-';
    }
    
    return date.toLocaleDateString('pt-BR');
  } catch (error) {
    console.error('Error formatting date:', dateString, error);
    return '-';
  }
}

/**
 * Gets current date in system timezone as YYYY-MM-DD format
 */
export function getCurrentDateForDatabase(): string {
  const now = new Date();
  return formatDateForDatabase(now);
}
