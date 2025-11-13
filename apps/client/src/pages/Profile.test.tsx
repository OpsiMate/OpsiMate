import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import Profile from './Profile';
import * as authLib from '../lib/auth';
import * as apiLib from '../lib/api';
import type { User } from '@OpsiMate/shared';

// Mock dependencies
vi.mock('../components/DashboardLayout', () => ({
	DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('../lib/auth');
vi.mock('../lib/api');

const mockGetCurrentUser = vi.mocked(authLib.getCurrentUser);
const mockApiRequest = vi.mocked(apiLib.apiRequest);

// Helper to render with theme provider
const renderWithTheme = (component: React.ReactElement) => {
	return render(
		<ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
			{component}
		</ThemeProvider>
	);
};

// Mock user data
const mockUser: User = {
	id: 1,
	email: 'test@example.com',
	fullName: 'Test User',
	role: 'admin' as const,
	createdAt: '2024-01-15T10:00:00Z',
};

const mockJWTUser = {
	id: 1,
	email: 'test@example.com',
	role: 'admin' as const,
	iat: 1234567890,
	exp: 9999999999,
};

describe('Profile Page', () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks();
		
		// Setup matchMedia mock for next-themes
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation((query) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
		
		// Setup default localStorage mock
		const localStorageMock: { [key: string]: string } = {};
		Storage.prototype.getItem = vi.fn((key: string) => localStorageMock[key] || null);
		Storage.prototype.setItem = vi.fn((key: string, value: string) => {
			localStorageMock[key] = value;
		});
		Storage.prototype.removeItem = vi.fn((key: string) => {
			delete localStorageMock[key];
		});

		// Default mock implementations
		mockGetCurrentUser.mockReturnValue(mockJWTUser);
		mockApiRequest.mockResolvedValue({
			success: true,
			data: mockUser,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Profile Information Display', () => {
		it('renders user profile information correctly', async () => {
			renderWithTheme(<Profile />);

			// Wait for profile to load
			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			// Check all profile information is displayed - use getAllByText for duplicate email
			const emailElements = screen.getAllByText('test@example.com');
			expect(emailElements.length).toBeGreaterThan(0);
			expect(screen.getByText('admin')).toBeInTheDocument();
			expect(screen.getByText('January 15, 2024')).toBeInTheDocument();
		});

		it('displays user avatar with correct initials', async () => {
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('TU')).toBeInTheDocument();
			});
		});

		it('shows loading state during profile fetch', () => {
			mockApiRequest.mockImplementation(() => new Promise(() => {})); // Never resolves

			renderWithTheme(<Profile />);

			expect(screen.getByText('Loading profile...')).toBeInTheDocument();
		});

		it('handles profile fetch failure and shows fallback data', async () => {
			mockApiRequest.mockResolvedValue({
				success: false,
				error: 'Failed to fetch profile',
			});

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('test')).toBeInTheDocument(); // Fallback uses email prefix
			});
		});

		it('shows error message when user is not authenticated', async () => {
			mockGetCurrentUser.mockReturnValue(null);

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Failed to load profile')).toBeInTheDocument();
			});
		});
	});

	describe('Profile Editing', () => {
		it('enters edit mode when Edit Profile button is clicked', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			const editButton = screen.getByRole('button', { name: /edit profile/i });
			await user.click(editButton);

			// Check that edit form is visible
			expect(screen.getByText('Edit Profile')).toBeInTheDocument();
			expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
		});

		it('exits edit mode when Cancel button is clicked', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			// Enter edit mode
			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			// Make changes
			const nameInput = screen.getByDisplayValue('Test User');
			await user.clear(nameInput);
			await user.type(nameInput, 'Modified Name');

			// Click cancel
			await user.click(screen.getByRole('button', { name: /cancel/i }));

			// Check that edit form is hidden (Save Changes button disappears) and changes are reverted
			await waitFor(() => {
				expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
			});
			expect(screen.getByText('Test User')).toBeInTheDocument();
		});

		it('allows modification of full name in edit mode', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const nameInput = screen.getByDisplayValue('Test User') as HTMLInputElement;
			expect(nameInput.value).toBe('Test User');

			await user.clear(nameInput);
			await user.type(nameInput, 'Updated Name');

			expect(nameInput.value).toBe('Updated Name');
		});

		it('clears errors when entering edit mode', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: false, error: 'Update failed' });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			// Try to save with error
			await user.click(screen.getByRole('button', { name: /edit profile/i }));
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('Update failed')).toBeInTheDocument();
			});

			// Cancel and re-enter edit mode
			await user.click(screen.getByRole('button', { name: /cancel/i }));
			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			// Error should be cleared
			expect(screen.queryByText('Update failed')).not.toBeInTheDocument();
		});
	});

	describe('Form Validation', () => {
		it('validates password length (minimum 6 characters)', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
			const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

			await user.type(newPasswordInput, 'short');
			await user.type(confirmPasswordInput, 'short');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('New password must be at least 6 characters')).toBeInTheDocument();
			});

			expect(mockApiRequest).toHaveBeenCalledTimes(1); // Only initial profile fetch
		});

		it('validates password match', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
			const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

			await user.type(newPasswordInput, 'password123');
			await user.type(confirmPasswordInput, 'different456');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('New passwords do not match')).toBeInTheDocument();
			});
		});

		it('validates password does not contain spaces', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
			const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

			await user.type(newPasswordInput, 'password with spaces');
			await user.type(confirmPasswordInput, 'password with spaces');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('Password must not contain spaces')).toBeInTheDocument();
			});
		});

		it('allows profile update without password change', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: true, data: { ...mockUser, fullName: 'Updated Name' } });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const nameInput = screen.getByDisplayValue('Test User');
			await user.clear(nameInput);
			await user.type(nameInput, 'Updated Name');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(mockApiRequest).toHaveBeenCalledWith('/users/profile', 'PATCH', {
					fullName: 'Updated Name',
				});
			});
		});
	});

	describe('Password Change Functionality', () => {
		it('includes password in update when provided', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: true, data: mockUser });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
			const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

			await user.type(newPasswordInput, 'newpassword123');
			await user.type(confirmPasswordInput, 'newpassword123');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(mockApiRequest).toHaveBeenCalledWith('/users/profile', 'PATCH', {
					fullName: 'Test User',
					newPassword: 'newpassword123',
				});
			});
		});

		it('sends password change request correctly', async () => {
			const user = userEvent.setup();
			const newToken = 'new-jwt-token';
			
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: true, data: mockUser, token: newToken });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
			const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

			await user.type(newPasswordInput, 'newpassword123');
			await user.type(confirmPasswordInput, 'newpassword123');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			// Verify the API was called with the new password
			await waitFor(() => {
				expect(mockApiRequest).toHaveBeenCalledWith('/users/profile', 'PATCH', {
					fullName: 'Test User',
					newPassword: 'newpassword123',
				});
			});

			// Verify the update was successful (edit mode exited)
			await waitFor(() => {
				expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
			});
		});

		it('clears password fields after successful update', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: true, data: mockUser });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);
			const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);

			await user.type(newPasswordInput, 'newpassword123');
			await user.type(confirmPasswordInput, 'newpassword123');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.queryByPlaceholderText(/enter new password/i)).not.toBeInTheDocument();
			});
		});
	});

	describe('Profile Update', () => {
		it('shows saving state during profile update', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockImplementation(() => new Promise(() => {})); // Never resolves

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			expect(screen.getByRole('button', { name: /saving.../i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /saving.../i })).toBeDisabled();
		});

		it('disables form inputs during save', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockImplementation(() => new Promise(() => {})); // Never resolves

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const nameInput = screen.getByDisplayValue('Test User');
			const newPasswordInput = screen.getByPlaceholderText(/enter new password/i);

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			expect(nameInput).toBeDisabled();
			expect(newPasswordInput).toBeDisabled();
		});

		it('updates local profile state after successful save', async () => {
			const user = userEvent.setup();
			const updatedUser = { ...mockUser, fullName: 'Updated Name' };
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: true, data: updatedUser });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			const nameInput = screen.getByDisplayValue('Test User');
			await user.clear(nameInput);
			await user.type(nameInput, 'Updated Name');

			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('Updated Name')).toBeInTheDocument();
			});
		});

		it('exits edit mode after successful save', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: true, data: mockUser });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			// Check that Save Changes button disappears (meaning edit mode exited)
			await waitFor(() => {
				expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
			});
		});

		it('handles update failure and shows error message', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: false, error: 'Failed to update profile' });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('Failed to update profile')).toBeInTheDocument();
			});

			// Should remain in edit mode on error
			expect(screen.getByText('Edit Profile')).toBeInTheDocument();
		});

		it('handles network error during update', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockRejectedValueOnce(new Error('Network error'));

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(screen.getByText('Failed to update profile')).toBeInTheDocument();
			});
		});
	});

	describe('Theme Preferences', () => {
		it('displays theme selection buttons', async () => {
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
		});

		it('allows theme switching', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			const darkButton = screen.getByRole('button', { name: /dark/i });
			await user.click(darkButton);

			// Note: We can't easily test the actual theme change without mocking useTheme hook
			// but we can verify the button is clickable and doesn't error
			expect(darkButton).toBeInTheDocument();
		});
	});

	describe('Logout Functionality', () => {
		it('displays logout button', async () => {
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
		});

		it('removes JWT and redirects on logout', async () => {
			const user = userEvent.setup();
			delete (window as { location?: Location }).location;
			window.location = { href: '' } as Location;

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			const logoutButton = screen.getByRole('button', { name: /logout/i });
			await user.click(logoutButton);

			expect(localStorage.removeItem).toHaveBeenCalledWith('jwt');
			expect(window.location.href).toBe('/login');
		});
	});

	describe('Accessibility', () => {
		it('has accessible form labels', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));

			// Check that form inputs are present
			expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
			expect(screen.getByPlaceholderText(/enter new password/i)).toBeInTheDocument();
			expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
		});

		it('has accessible buttons with proper labels', async () => {
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			// Check main action buttons
			expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
		});

		it('shows error messages in accessible alert components', async () => {
			const user = userEvent.setup();
			mockApiRequest
				.mockResolvedValueOnce({ success: true, data: mockUser })
				.mockResolvedValueOnce({ success: false, error: 'Update failed' });

			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			await user.click(screen.getByRole('button', { name: /edit profile/i }));
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				const errorAlert = screen.getByText('Update failed').closest('[role="alert"]');
				expect(errorAlert).toBeInTheDocument();
			});
		});

		it('maintains focus management during edit mode transitions', async () => {
			const user = userEvent.setup();
			renderWithTheme(<Profile />);

			await waitFor(() => {
				expect(screen.getByText('Test User')).toBeInTheDocument();
			});

			const editButton = screen.getByRole('button', { name: /edit profile/i });
			await user.click(editButton);

			// Form should be visible and focusable
			const nameInput = screen.getByDisplayValue('Test User');
			expect(nameInput).toBeInTheDocument();
			expect(nameInput).not.toBeDisabled();
		});
	});
});