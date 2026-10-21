import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Login from '@/pages/Login';
import { render, screen, waitFor } from './test-utils';

// When the server completes a bare name with a default domain, the login field accepts a
// username and says what it will sign in as; without the setting it is the email field it
// always was.

const statusResponse = (loginDefaultEmailDomain: string | null) =>
	new Response(JSON.stringify({ success: true, data: { isEmailEnabled: false, loginDefaultEmailDomain } }), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Login with a default email domain', () => {
	test('takes a username and shows the address it will sign in as', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse('acme.test')));
		const user = userEvent.setup();
		render(<Login />);

		const field = await screen.findByLabelText('Email or username');
		expect(field).toHaveAttribute('type', 'text');
		await user.type(field, 'idan');
		expect(screen.getByText('Signs in as idan@acme.test')).toBeInTheDocument();

		await user.clear(field);
		await user.type(field, 'idan@other.test');
		expect(screen.queryByText(/Signs in as/)).not.toBeInTheDocument();
	});

	test('without the setting the field is the email field, as before', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse(null)));
		render(<Login />);
		await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
		const field = screen.getByLabelText('Email');
		expect(field).toHaveAttribute('type', 'email');
		expect(screen.queryByLabelText('Email or username')).not.toBeInTheDocument();
	});
});
