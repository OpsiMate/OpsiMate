import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Login from '@/pages/Login';
import { render, screen, waitFor } from './test-utils';

// One login field takes a username or an email. With the (deprecated) default email
// domain configured, a bare name also tries the address it completes to, and the page
// says so; without it, nothing is suggested.

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

describe('Login field', () => {
	test('takes a username or an email; with a default domain a bare name shows the address it also tries', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse('acme.test')));
		const user = userEvent.setup();
		render(<Login />);

		const field = await screen.findByLabelText('Username or email');
		expect(field).toHaveAttribute('type', 'text');
		await user.type(field, 'idan');
		await waitFor(() => expect(screen.getByText('Also tries idan@acme.test')).toBeInTheDocument());

		await user.clear(field);
		await user.type(field, 'idan@other.test');
		expect(screen.queryByText(/Also tries/)).not.toBeInTheDocument();
	});

	test('without the setting the field is the same, and a bare name is simply a username', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse(null)));
		const user = userEvent.setup();
		render(<Login />);
		await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
		const field = screen.getByLabelText('Username or email');
		expect(field).toHaveAttribute('type', 'text');
		await user.type(field, 'idan');
		expect(screen.queryByText(/Also tries/)).not.toBeInTheDocument();
	});
});
