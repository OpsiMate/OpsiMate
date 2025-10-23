import { Logger } from '@OpsiMate/shared';
import { useState } from 'react';
import { isValidationError, mapApiError, mapValidationErrors } from '../lib/errorMapper';

const logger = new Logger('useFormErrors');

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
		logger.debug('handleApiResponse called with:', response);

		if (response.success) {
			clearErrors();
			return;
		}

		// Handle validation errors
		if (isValidationError(response)) {
			logger.debug('Detected validation error, mapping fields...');
			if (showFieldErrors) {
				const fieldErrors = mapValidationErrors(response);
				logger.debug('Mapped field errors:', fieldErrors);
				setErrors(fieldErrors);
				setGeneralError(null);
			} else {
				// For login, show a general error instead of field-specific ones
				logger.debug('Field errors disabled, showing general error...');
				setErrors({});
				setGeneralError('Invalid email or password. Please check your credentials and try again.');
			}
		} else {
			// Handle general errors
			logger.debug('Detected general error, mapping message...');
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
