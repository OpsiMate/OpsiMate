import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useFormErrors } from '@/hooks/useFormErrors';

const validationResponse = {
	success: false as const,
	error: 'Validation error',
	details: [
		{
			code: 'invalid_email',
			type: 'string',
			message: 'Invalid email',
			path: ['email'],
		},
	],
};

describe('useFormErrors', () => {
	test('clears field and general errors after a successful response', () => {
		const { result } = renderHook(() => useFormErrors());
		act(() => {
			result.current.setErrors({ email: 'Bad email' });
			result.current.setGeneralError('Request failed');
		});
		act(() => result.current.handleApiResponse({ success: true }));
		expect(result.current.errors).toEqual({});
		expect(result.current.generalError).toBeNull();
	});

	test('maps validation failures to field errors', () => {
		const { result } = renderHook(() => useFormErrors());
		act(() => result.current.handleApiResponse(validationResponse));
		expect(result.current.errors).toEqual({ email: 'Please enter a valid email address' });
		expect(result.current.generalError).toBeNull();
		expect(result.current.getFieldError('email')).toBe('Please enter a valid email address');
	});

	test('uses a general login error when field errors are disabled', () => {
		const { result } = renderHook(() => useFormErrors({ showFieldErrors: false }));
		act(() => result.current.handleApiResponse(validationResponse));
		expect(result.current.errors).toEqual({});
		expect(result.current.generalError).toBe(
			'Invalid email or password. Please check your credentials and try again.'
		);
	});

	test('maps non-validation failures to the general error', () => {
		const { result } = renderHook(() => useFormErrors());
		act(() => result.current.handleApiResponse({ success: false, error: 'HTTP 401: Unauthorized' }));
		expect(result.current.errors).toEqual({});
		expect(result.current.generalError).toBe('Authentication failed. Please log in again.');
	});

	test('clearErrors resets both error stores', () => {
		const { result } = renderHook(() => useFormErrors());
		act(() => {
			result.current.setErrors({ email: 'Bad email' });
			result.current.setGeneralError('Request failed');
		});
		act(() => result.current.clearErrors());
		expect(result.current.errors).toEqual({});
		expect(result.current.generalError).toBeNull();
	});
});
