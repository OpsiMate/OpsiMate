import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Login from '@/pages/Login';
import { render, screen, waitFor } from './test-utils';

// One login field takes a username or an email; "@" tells them apart, server-side. A bare
// name is a username and only that — the (deprecated) default email domain completes
// logins sent through the legacy email field, not this form, so nothing is suggested.

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
	test.each([
		['with a default email domain', 'acme.test'],
		['without one', null],
	])('takes a username or an email and suggests no completed address, %s', async (_label, domain) => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse(domain)));
		const user = userEvent.setup();
		render(<Login />);
		await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());

		const field = screen.getByLabelText('Username or email');
		expect(field).toHaveAttribute('type', 'text');
		expect(field).toHaveAttribute('autocomplete', 'username');
		await user.type(field, 'idan');
		expect(screen.queryByText(/acme\.test/)).not.toBeInTheDocument();
		await user.clear(field);
		await user.type(field, 'idan@other.test');
		expect(field).toHaveValue('idan@other.test');
	});
});
