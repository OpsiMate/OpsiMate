import userEvent from '@testing-library/user-event';
import { Role } from '@OpsiMate/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EditUserModal } from '@/components/EditUserModal';
import { apiRequest } from '@/lib/api';
import { User } from '@/types';
import { render, screen, waitFor } from './test-utils';

// The dialog used to listen for keys on window: Enter saved even with Cancel focused,
// and Escape ran onClose twice (once from the listener, once from the Dialog). It is a
// form now, so Enter submits through the Save button and Escape is left to the Dialog.

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
	const onUserUpdated = vi.fn();
	render(<EditUserModal user={user} isOpen onClose={onClose} onUserUpdated={onUserUpdated} />);
	return { onClose, onUserUpdated };
};

beforeEach(() => {
	mockedApiRequest.mockReset().mockResolvedValue({ success: true, data: user });
});

describe('EditUserModal keyboard', () => {
	test('Enter in a text field saves once', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		await keyboard.click(screen.getByLabelText('Full Name'));
		await keyboard.keyboard('{Enter}');

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(mockedApiRequest).toHaveBeenCalledTimes(1);
		expect(mockedApiRequest).toHaveBeenCalledWith('/users/7', 'PATCH', {
			fullName: 'Dana Scully',
			email: 'dana@example.com',
		});
	});

	test('Enter on Cancel closes without saving', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		screen.getByRole('button', { name: 'Cancel' }).focus();
		await keyboard.keyboard('{Enter}');

		expect(mockedApiRequest).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test('Escape calls onClose exactly once', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		await keyboard.click(screen.getByLabelText('Full Name'));
		await keyboard.keyboard('{Escape}');

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(mockedApiRequest).not.toHaveBeenCalled();
	});

	test('Enter does not save while a required field is empty', async () => {
		const keyboard = userEvent.setup();
		const { onClose } = renderDialog();

		await keyboard.clear(screen.getByLabelText('Full Name'));
		await keyboard.click(screen.getByLabelText('Email'));
		await keyboard.keyboard('{Enter}');

		expect(mockedApiRequest).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});
});
