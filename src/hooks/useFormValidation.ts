import { useState, useCallback } from 'react';
import { z } from 'zod';

interface ValidationError {
  field: string;
  message: string;
}

export const useFormValidation = <T,>(schema: z.ZodSchema<T>) => {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const validateField = useCallback(
    async (fieldName: string, value: any) => {
      try {
        setIsValidating(true);
        
        // Dynamic partial validation for a slice of the schema
        if (schema instanceof z.ZodObject) {
          const fieldSchema = schema.pick({ [fieldName]: true } as any);
          await fieldSchema.parseAsync({ [fieldName]: value });
        }

        // Remove error for this field upon success
        setErrors(prev => prev.filter(e => e.field !== fieldName));
        return true;
      } catch (err) {
        if (err instanceof z.ZodError) {
          const fieldError = err.issues[0];
          setErrors(prev => [
            ...prev.filter(e => e.field !== fieldName),
            { field: fieldName, message: fieldError?.message || 'Invalid value' }
          ]);
        }
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    [schema]
  );

  const validateForm = useCallback(
    async (formData: T) => {
      try {
        setIsValidating(true);
        await schema.parseAsync(formData);
        setErrors([]);
        return true;
      } catch (err) {
        if (err instanceof z.ZodError) {
          const newErrors = err.issues.map(error => ({
            field: String(error.path[0]),
            message: error.message
          }));
          setErrors(newErrors);
        }
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    [schema]
  );

  const getFieldError = useCallback(
    (fieldName: string) => errors.find(e => e.field === fieldName)?.message,
    [errors]
  );

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    errors,
    isValidating,
    validateField,
    validateForm,
    getFieldError,
    clearErrors,
    hasError: (fieldName: string) => !getFieldError(fieldName)
  };
};
