import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Login from '@/pages/Login';
import { render, screen, waitFor } from './test-utils';

// One login field takes a username or an email; "@" tells them apart, server-side. A bare
// name is a username and only that — the (deprecated) default email domain completes
// logins sent through the legacy email field, not this form, so nothing is suggested.

const statusResponse = () =>
	new Response(JSON.stringify({ success: true, data: { isEmailEnabled: false } }), {
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
	test('takes a username or an email, as typed, and suggests nothing', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(statusResponse()));
		const user = userEvent.setup();
		render(<Login />);
		await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());

		const field = screen.getByLabelText('Username or email');
		expect(field).toHaveAttribute('type', 'text');
		expect(field).toHaveAttribute('autocomplete', 'username');
		await user.type(field, 'idan');
		expect(screen.queryByText(/@/)).not.toBeInTheDocument();
		await user.clear(field);
		await user.type(field, 'idan@other.test');
		expect(field).toHaveValue('idan@other.test');
	});
});
