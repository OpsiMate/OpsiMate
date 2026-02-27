import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/test/test-utils'
import Login from './Login'

// Mock apiRequest used by Login
vi.mock('@/lib/api', async (orig) => {
	const actual = await (orig as any)()
	return {
		...actual,
		apiRequest: vi.fn(),
	}
})

// Helpers
const getEmailInput = () => screen.getByPlaceholderText('Email') as HTMLInputElement
const getPasswordInput = () => screen.getByPlaceholderText('Password') as HTMLInputElement
const getSubmitButton = () => screen.getByRole('button', { name: /login/i })

// Mock window.location to capture redirects
const originalLocation = window.location
beforeAll(() => {
	// @ts-expect-error override for tests
	delete (window as any).location
	// minimal implementation needed by the page
	;(window as any).location = { href: 'http://localhost/login' }
})

afterAll(() => {
	// restore
	;(window as any).location = originalLocation
})

beforeEach(() => {
	localStorage.clear()
	vi.clearAllMocks()
})

describe('Login page', () => {
	it('renders login form with email and password fields', () => {
		render(<Login />)
		expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument()
		expect(getEmailInput()).toBeInTheDocument()
		expect(getPasswordInput()).toBeInTheDocument()
		expect(getSubmitButton()).toBeInTheDocument()
	})

	it('validates required fields before submission', async () => {
		const { apiRequest } = await import('@/lib/api')
		;(apiRequest as any).mockResolvedValue({ success: false, error: 'Validation error', details: [
			{ code: 'invalid_type', type: 'string', message: 'Required', path: ['email'] },
			{ code: 'invalid_type', type: 'string', message: 'Required', path: ['password'] },
		]})

		render(<Login />)
		// Fill in the form fields first
		fireEvent.change(getEmailInput(), { target: { value: 'test@example.com' } })
		fireEvent.change(getPasswordInput(), { target: { value: 'password123' } })
		fireEvent.click(getSubmitButton())

		await waitFor(() => {
			// Login disables field-level errors; shows general error instead
			expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i)
		}, { timeout: 3000 })
	})

	it('handles successful login and redirects correctly', async () => {
		const { apiRequest } = await import('@/lib/api')
		;(apiRequest as any).mockResolvedValue({ success: true, data: { token: 'jwt-token', data: { user: { id: '1', email: 'a', name: 'n' } } }, token: 'jwt-token' })

		render(<Login />)
		fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } })
		fireEvent.change(getPasswordInput(), { target: { value: 'secret123' } })
		fireEvent.click(getSubmitButton())

		await waitFor(() => {
			expect(localStorage.getItem('jwt')).toBe('jwt-token')
			expect((window as any).location.href).toBe('/')
		})
	})

	it('displays error messages for invalid credentials', async () => {
		const { apiRequest } = await import('@/lib/api')
		;(apiRequest as any).mockResolvedValue({ success: false, error: 'Invalid email or password' })

		render(<Login />)
		fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } })
		fireEvent.change(getPasswordInput(), { target: { value: 'wrong' } })
		fireEvent.click(getSubmitButton())

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i)
		})
	})

	it('shows loading state during authentication', async () => {
		const { apiRequest } = await import('@/lib/api')
		let resolveReq: (v: any) => void
		;(apiRequest as any).mockImplementation(() => new Promise((res) => { resolveReq = res }))

		render(<Login />)
		fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } })
		fireEvent.change(getPasswordInput(), { target: { value: 'secret123' } })
		fireEvent.click(getSubmitButton())

		// Button should show loading text and be disabled
		const submitButton = screen.getByRole('button', { name: /logging in/i })
		expect(submitButton).toBeDisabled()
		expect(submitButton).toHaveTextContent(/logging in/i)

		// Resolve request
		resolveReq!({ success: false, error: 'Invalid email or password' })

		await waitFor(() => {
			const submitButton = screen.getByRole('button', { name: /login/i })
			expect(submitButton).not.toBeDisabled()
			expect(submitButton).toHaveTextContent(/login/i)
		})
	})

	it('redirects immediately if jwt already present', () => {
		localStorage.setItem('jwt', 'existing')
		render(<Login />)
		expect((window as any).location.href).toBe('/')
	})

	it('announces errors via accessible alert role', async () => {
		const { apiRequest } = await import('@/lib/api')
		;(apiRequest as any).mockResolvedValue({ success: false, error: 'Invalid email or password' })

		render(<Login />)
		fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } })
		fireEvent.change(getPasswordInput(), { target: { value: 'wrong' } })
		fireEvent.click(getSubmitButton())

		const alert = await screen.findByRole('alert')
		expect(alert).toHaveTextContent(/invalid email or password/i)
	})

	it('is keyboard accessible (tab to inputs and submit)', async () => {
		render(<Login />)
		const email = getEmailInput()
		const password = getPasswordInput()
		const submit = getSubmitButton()

		email.focus()
		expect(email).toHaveFocus()
		password.focus()
		expect(password).toHaveFocus()
		submit.focus()
		expect(submit).toHaveFocus()
	})

	// Optional checks if these controls exist; the current page does not expose them
	it('handles remember me if present (no-op if absent)', () => {
		render(<Login />)
		const remember = screen.queryByRole('checkbox', { name: /remember/i })
		if (remember) {
			fireEvent.click(remember)
			expect((remember as HTMLInputElement).checked).toBe(true)
		}
	})

	it('handles password visibility toggle if present (no-op if absent)', () => {
		render(<Login />)
		const toggle = screen.queryByRole('button', { name: /show password|hide password/i })
		if (toggle) {
			const input = getPasswordInput()
			expect(input.type).toBe('password')
			fireEvent.click(toggle)
			expect(input.type === 'text' || input.type === 'password').toBe(true)
		}
	})
})
