import userEvent from '@testing-library/user-event';
import { Role } from '@OpsiMate/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ResetPasswordModal } from '@/components/ResetPasswordModal';
import { apiRequest } from '@/lib/api';
import { User } from '@/types';
import { render, screen, waitFor } from './test-utils';

// The dialog used to listen for keys on window: Enter reset the password even with
// Cancel focused, and Escape ran onClose twice (once from the listener, once from the
// Dialog). It is a form now, so Enter submits through the Reset button and Escape is
// left to the Dialog.

vi.mock('@/lib/api', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);

const user: User = {
	id: 7,
	email: 'dana@example.com',
	fullName: 'Dana Scully',
	role: Role.Viewer,
	createdAt: '2026-01-01T00:00:00.000Z',
};

const renderDialog = () => {
	const onClose = vi.fn();
	render(<ResetPasswordModal user={user} isOpen onClose={onClose} />);
	return { onClose };
};

beforeEach(() => {
	mockedApiRequest.mockReset().mockResolvedValue({ success: true });
});

describe('ResetPasswordModal keyboard', () => {
	test('Enter in a text field resets once', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		await keyboard.type(screen.getByLabelText('New Password'), 'newsecret1');
		await keyboard.type(screen.getByLabelText('Confirm Password'), 'newsecret1{Enter}');

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(mockedApiRequest).toHaveBeenCalledTimes(1);
		expect(mockedApiRequest).toHaveBeenCalledWith('/users/7/reset-password', 'PATCH', {
			newPassword: 'newsecret1',
		});
	});

	test('Enter on Cancel closes without resetting', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		await keyboard.type(screen.getByLabelText('New Password'), 'newsecret1');
		await keyboard.type(screen.getByLabelText('Confirm Password'), 'newsecret1');
		screen.getByRole('button', { name: 'Cancel' }).focus();
		await keyboard.keyboard('{Enter}');

		expect(mockedApiRequest).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test('Escape calls onClose exactly once', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		await keyboard.click(screen.getByLabelText('New Password'));
		await keyboard.keyboard('{Escape}');

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(mockedApiRequest).not.toHaveBeenCalled();
	});

	test('Enter does not reset while a required field is empty', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		await keyboard.type(screen.getByLabelText('New Password'), 'newsecret1{Enter}');

		expect(mockedApiRequest).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});
});
