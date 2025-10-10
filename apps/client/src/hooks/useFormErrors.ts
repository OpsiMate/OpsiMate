import { useState } from 'react';
import { mapValidationErrors, mapApiError, isValidationError } from '../lib/errorMapper';

export interface FormErrorState {
  errors: Record<string, string>;
  generalError: string | null;
  setErrors: (errors: Record<string, string>) => void;
  setGeneralError: (error: string | null) => void;
  clearErrors: () => void;
  handleApiResponse: (response: { success: boolean; error?: string; errors?: Record<string, string> }) => void;
  getFieldError: (fieldName: string) => string | null;
}

export interface FormErrorOptions {
  showFieldErrors?: boolean;
}

/**
 * Custom hook for handling form errors with validation and API error mapping
 */
export function useFormErrors(options: FormErrorOptions = {}): FormErrorState {
  const { showFieldErrors = true } = options;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const clearErrors = () => {
    setErrors({});
    setGeneralError(null);
  };

  const handleApiResponse = (response: { success: boolean; error?: string; errors?: Record<string, string> }) => {
    console.log('handleApiResponse called with:', response);
    
    if (response.success) {
      clearErrors();
      return;
    }

    // Handle validation errors
    if (isValidationError(response)) {
      console.log('Detected validation error, mapping fields...');
      if (showFieldErrors) {
        const fieldErrors = mapValidationErrors(response);
        console.log('Mapped field errors:', fieldErrors);
        setErrors(fieldErrors);
        setGeneralError(null);
      } else {
        // For login, show a general error instead of field-specific ones
        console.log('Field errors disabled, showing general error...');
        setErrors({});
        setGeneralError('Invalid email or password. Please check your credentials and try again.');
      }
    } else {
      // Handle general errors
      console.log('Detected general error, mapping message...');
      setErrors({});
      setGeneralError(mapApiError(response.error || 'An error occurred'));
    }
  };

  const getFieldError = (fieldName: string): string | null => {
    return errors[fieldName] || null;
  };

  return {
    errors,
    generalError,
    setErrors,
    setGeneralError,
    clearErrors,
    handleApiResponse,
    getFieldError,
  };
} 