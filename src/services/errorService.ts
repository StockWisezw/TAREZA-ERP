export enum ErrorCategory {
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN'
}

export interface AppError {
  category: ErrorCategory;
  message: string;
  code?: string;
  originalError?: Error;
}

export const classifyError = (error: any): AppError => {
  if (!error) {
    return {
      category: ErrorCategory.UNKNOWN,
      message: 'An unexpected error occurred'
    };
  }

  // Handle standard Firebase/Supabase auth codes
  if (
    error.code === 'auth/user-not-found' || 
    error.code === 'PGRST301' || 
    error.code === 'INVALID_SESSION' ||
    error.message?.includes('session')
  ) {
    return {
      category: ErrorCategory.AUTH,
      message: 'Your session has expired. Please log in again.',
      code: error.code || 'AUTH_EXPIRED',
      originalError: error
    };
  }

  // Handle database Permission Denied
  if (
    error.code === 'PERMISSION_DENIED' || 
    error.code === '42501' ||
    error.message?.toLowerCase().includes('permission') ||
    error.message?.toLowerCase().includes('insufficient')
  ) {
    return {
      category: ErrorCategory.PERMISSION,
      message: 'You do not have permission to perform this action.',
      code: error.code || 'PERMISSION_DENIED',
      originalError: error
    };
  }

  // Handle common Network Failures
  if (
    error.message?.includes('NETWORK') || 
    error.code === 'NETWORK_ERROR' ||
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('failed to fetch') ||
    error.message?.toLowerCase().includes('network')
  ) {
    return {
      category: ErrorCategory.NETWORK,
      message: 'Check your internet connection and try again.',
      code: error.code || 'NETWORK_FAILURE',
      originalError: error
    };
  }

  // Handle database Not Found errors
  if (
    error.code === 'NOT_FOUND' || 
    error.code === 'PGRST116' ||
    error.message?.toLowerCase().includes('not found')
  ) {
    return {
      category: ErrorCategory.NOT_FOUND,
      message: 'The requested resource was not found.',
      code: error.code || 'NOT_FOUND',
      originalError: error
    };
  }

  // Handle Validation errors
  if (
    error.name === 'ValidationError' ||
    error.code === 'VALIDATION_ERROR' ||
    error.message?.toLowerCase().includes('invalid')
  ) {
    return {
      category: ErrorCategory.VALIDATION,
      message: error.message || 'One or more fields have invalid values.',
      code: error.code || 'VALIDATION_FAILED',
      originalError: error
    };
  }

  return {
    category: ErrorCategory.SERVER,
    message: error.message || 'Something went wrong on the server. Please try again.',
    code: error.code || 'SERVER_ERROR',
    originalError: error
  };
};

export const getErrorAction = (error: AppError): string => {
  switch (error.category) {
    case ErrorCategory.NETWORK:
      return 'Check your internet and retry';
    case ErrorCategory.AUTH:
      return 'Log in again';
    case ErrorCategory.PERMISSION:
      return 'Contact your system administrator';
    case ErrorCategory.NOT_FOUND:
      return 'Check input details and retry';
    case ErrorCategory.VALIDATION:
      return 'Ensure input formats are correct';
    default:
      return 'Try again';
  }
};
