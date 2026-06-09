import { toast } from 'sonner';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  CREDIT_LIMIT_EXCEEDED = 'CREDIT_LIMIT_EXCEEDED',
  INVALID_BUSINESS_RELATIONSHIP = 'INVALID_BUSINESS_RELATIONSHIP',
}

const ERROR_MESSAGES: Record<string, string> = {
  [ErrorCode.UNAUTHORIZED]: 'Please log in to continue.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.NOT_FOUND]: "The item you're looking for doesn't exist.",
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.DUPLICATE_ENTRY]: 'An entry with this name or unique key already exists.',
  [ErrorCode.NETWORK_ERROR]: 'Network connection lost. Please check your internet and try again.',
  [ErrorCode.INSUFFICIENT_STOCK]: 'Not enough stock available for this item.',
  [ErrorCode.CREDIT_LIMIT_EXCEEDED]: 'This customer has reached their credit limit.',
  [ErrorCode.INVALID_BUSINESS_RELATIONSHIP]: 'Validation mismatch: the resources belong to different units.',
};

export function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] || 'Something went wrong. Please try again.';
}

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Check Firestore / Firebase Auth specific error patterns
  if (message.includes('permission-denied') || message.includes('Missing or insufficient permissions')) {
    return new AppError(ErrorCode.FORBIDDEN, ERROR_MESSAGES[ErrorCode.FORBIDDEN], 403, { originalError: message });
  }

  if (message.includes('auth/unauthorized') || message.includes('auth/invalid-credential')) {
    return new AppError(ErrorCode.UNAUTHORIZED, ERROR_MESSAGES[ErrorCode.UNAUTHORIZED], 401, { originalError: message });
  }

  if (message.includes('network') || message.includes('offline')) {
    return new AppError(ErrorCode.NETWORK_ERROR, ERROR_MESSAGES[ErrorCode.NETWORK_ERROR], 0, { originalError: message });
  }

  if (message.includes('already exists') || message.includes('duplicate')) {
    return new AppError(ErrorCode.DUPLICATE_ENTRY, ERROR_MESSAGES[ErrorCode.DUPLICATE_ENTRY], 409, { originalError: message });
  }

  return new AppError('UNKNOWN_ERROR', message || 'An unexpected error occurred.', 500, { originalError: message });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const isRetryable = (err: any) => {
        const msg = err instanceof Error ? err.message : String(err);
        return msg.includes('network') || msg.includes('offline') || msg.includes('timeout') || msg.includes('429') || msg.includes('unavailable');
      };

      if (isRetryable(error)) {
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

export class ErrorLogger {
  static log(error: AppError, context?: Record<string, any>) {
    const payload = {
      timestamp: new Date().toISOString(),
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      context: { ...error.context, ...context },
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    console.error('[AppError Captured]', payload);

    // CENTRAL LOGGING BACKEND PROXY (Frictionless mock fallback)
    fetch('/api/logs/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail if endpoint is not running
    });
  }
}

// Global UI toast reporter helper
export function reportErrorToUser(error: unknown, fallbackMessage?: string) {
  const appError = handleError(error);
  ErrorLogger.log(appError);
  toast.error(getErrorMessage(appError.code) || appError.message || fallbackMessage || 'An unexpected error occurred.');
}
