import { describe, expect, it } from 'vitest';
import {
	getFieldError,
	isValidationError,
	mapApiError,
	mapValidationErrors,
	type ValidationErrorDetail,
	type ValidationErrorResponse,
} from '@/lib/errorMapper';

const emailError: ValidationErrorDetail = {
	code: 'invalid_string',
	type: 'string',
	message: 'Invalid',
	path: ['email'],
};

function validationResponse(details: ValidationErrorDetail[]): ValidationErrorResponse {
	return { success: false, error: 'Validation error', details };
}

describe('mapValidationErrors', () => {
	it('prefers field-specific messages over generic and server messages', () => {
		expect(mapValidationErrors(validationResponse([emailError]))).toEqual({
			email: 'Please enter a valid email address',
		});
	});

	it('maps multiple fields independently, including nested field paths', () => {
		const response = validationResponse([
			emailError,
			{ code: 'too_small', type: 'string', message: 'Too short', path: ['password'] },
			{ code: 'too_big', type: 'number', message: 'Too large', path: ['provider', 'SSHPort'] },
		]);

		expect(mapValidationErrors(response)).toEqual({
			email: 'Please enter a valid email address',
			password: 'Password must be at least 6 characters long',
			SSHPort: 'SSH port must be at most 65535',
		});
	});

	it('uses a generic message when the field has no matching mapping', () => {
		const detail = { ...emailError, path: ['description'], code: 'too_small' };
		expect(mapValidationErrors(validationResponse([detail]))).toEqual({
			description: 'This field is too short',
		});
	});

	it('preserves the server message for an unknown error code', () => {
		const detail = { ...emailError, code: 'domain_blocked', message: 'This email domain is blocked' };
		expect(mapValidationErrors(validationResponse([detail]))).toEqual({
			email: 'This email domain is blocked',
		});
	});

	it.each(['', 'Required'])('provides a fallback for an unknown code with message %j', (message) => {
		const detail = { ...emailError, code: 'unknown_code', message };
		expect(mapValidationErrors(validationResponse([detail]))).toEqual({ email: 'Invalid email' });
	});

	it('returns no field errors for an empty details array', () => {
		expect(mapValidationErrors(validationResponse([]))).toEqual({});
	});
});

describe('mapApiError', () => {
	it.each([
		['HTTP 400: Bad Request', 'Invalid request. Please check your input and try again.'],
		['HTTP 401: Unauthorized', 'Authentication failed. Please log in again.'],
		['HTTP 403: Forbidden', "Access denied. You don't have permission to perform this action."],
		['HTTP 404: Not Found', 'Resource not found.'],
		['HTTP 500: Internal Server Error', 'Server error. Please try again later.'],
		[
			'Email already registered',
			'This email is already registered. Please use a different email or try logging in.',
		],
		['Invalid email or password', 'Invalid email or password. Please check your credentials and try again.'],
		['Network error', 'Network error. Please check your connection and try again.'],
		['Failed to fetch', 'Network error. Please check your connection and try again.'],
	])('maps %j to a user-facing message', (error, expected) => {
		expect(mapApiError(error)).toBe(expected);
	});

	it.each(['An unexpected service error', 'HTTP 429: Too Many Requests', ''])(
		'preserves unmapped error %j',
		(error) => {
			expect(mapApiError(error)).toBe(error);
		}
	);
});

describe('getFieldError', () => {
	it('returns the mapped message for the requested field', () => {
		expect(getFieldError('email', validationResponse([emailError]))).toBe('Please enter a valid email address');
	});

	it('finds a field at the end of a nested path', () => {
		const response = validationResponse([{ ...emailError, path: ['user', 'email'] }]);
		expect(getFieldError('email', response)).toBe('Please enter a valid email address');
		expect(getFieldError('user', response)).toBeNull();
	});

	it('returns null when only another field has an error', () => {
		expect(getFieldError('password', validationResponse([emailError]))).toBeNull();
	});

	it.each([{}, { details: [] }])('returns null when there are no details: %j', (response) => {
		expect(getFieldError('email', response)).toBeNull();
	});
});

describe('isValidationError', () => {
	it('recognizes a validation error response', () => {
		expect(isValidationError(validationResponse([emailError]))).toBe(true);
	});

	it('recognizes a validation error with additional context', () => {
		expect(
			isValidationError({ ...validationResponse([emailError]), error: 'Validation error: invalid input' })
		).toBe(true);
	});

	it.each([
		null,
		undefined,
		{},
		{ success: true, error: 'Validation error', details: [emailError] },
		{ success: false, error: 'Unauthorized', details: [] },
		{ success: false, error: 'Validation error' },
		{ success: false, error: 'Validation error', details: {} },
	])('rejects a non-validation response: %j', (response) => {
		expect(isValidationError(response)).toBe(false);
	});
});
