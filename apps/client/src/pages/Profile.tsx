import { Logger, User as UserType } from '@OpsiMate/shared';
import { Lock, LogOut, Moon, Save, Sun, User, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ErrorAlert } from '../components/ErrorAlert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useFormErrors } from '../hooks/useFormErrors';
import { apiRequest } from '../lib/api';
import { getCurrentUser } from '../lib/auth';

const logger = new Logger('Profile');

interface UserProfile {
	id: number;
	email: string;
	fullName: string;
	role: string;
	createdAt: string;
}

const Profile: React.FC = () => {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [formData, setFormData] = useState({
		fullName: '',
		newPassword: '',
		confirmPassword: '',
	});
	const { errors, generalError, clearErrors, handleApiResponse } = useFormErrors();
	const { theme, setTheme } = useTheme();

	useEffect(() => {
		fetchProfile();
	}, []);

	const fetchProfile = async () => {
		setLoading(true);
		try {
			const currentUser = getCurrentUser();
			if (currentUser) {
				// Fetch the full user profile from the server
				const response = await apiRequest<UserType>('/users/profile', 'GET');
				if (response.success && response.data) {
					setProfile({
						id: response.data.id,
						email: response.data.email,
						fullName: response.data.fullName,
						role: response.data.role,
						createdAt: response.data.createdAt,
					});
					setFormData((prev) => ({ ...prev, fullName: response.data.fullName }));
				} else {
					// Fallback to JWT data if server request fails
					logger.warn('Failed to fetch user profile from server, using JWT data as fallback');
					setProfile({
						id: currentUser.id,
						email: currentUser.email,
						fullName: currentUser.email.split('@')[0], // Use email prefix as fallback
						role: currentUser.role,
						createdAt: new Date().toISOString(),
					});
					setFormData((prev) => ({ ...prev, fullName: currentUser.email.split('@')[0] }));
				}
			}
		} catch (error) {
			handleApiResponse({
				success: false,
				error: 'Failed to load profile',
			});
		} finally {
			setLoading(false);
		}
	};

	const handleEdit = () => {
		setIsEditing(true);
		clearErrors();
	};

	const handleCancel = () => {
		setIsEditing(false);
		setFormData((prev) => ({ ...prev, fullName: profile?.fullName || '' }));
		clearErrors();
	};

	const handleSave = async () => {
		setSaving(true);
		clearErrors();

		// Validate passwords if changing password
		if (formData.newPassword) {
			if (!formData.newPassword) {
				handleApiResponse({
					success: false,
					error: 'New password is required',
				});
				setSaving(false);
				return;
			}
			if (formData.newPassword !== formData.confirmPassword) {
				handleApiResponse({
					success: false,
					error: 'New passwords do not match',
				});
				setSaving(false);
				return;
			}
			if (formData.newPassword.length < 6) {
				handleApiResponse({
					success: false,
					error: 'New password must be at least 6 characters',
				});
				setSaving(false);
				return;
			}
			if (/\s/.test(formData.newPassword)) {
				handleApiResponse({
					success: false,
					error: 'Password must not contain spaces',
				});
				setSaving(false);
				return;
			}
		}

		try {
			const updateData: { fullName: string; newPassword?: string } = {
				fullName: formData.fullName,
			};

			if (formData.newPassword) {
				updateData.newPassword = formData.newPassword;
			}

			const response = await apiRequest('/users/profile', 'PATCH', updateData);

			if (response.success) {
				// Update local profile state
				if (profile) {
					setProfile({
						...profile,
						fullName: formData.fullName,
					});
				}

				// Update JWT token if password was changed
				if (response.data && typeof response.data === 'object' && 'token' in response.data) {
					localStorage.setItem('jwt', response.data.token as string);
				}

				setIsEditing(false);
				setFormData((prev) => ({
					...prev,
					newPassword: '',
					confirmPassword: '',
				}));

				// Show success message (you might want to add a toast here)
				logger.info('Profile updated successfully');
			} else {
				handleApiResponse(response);
			}
		} catch (error) {
			handleApiResponse({
				success: false,
				error: 'Failed to update profile',
			});
		} finally {
			setSaving(false);
		}
	};

	const handleLogout = () => {
		localStorage.removeItem('jwt');
		window.location.href = '/login';
	};

	const getInitials = (name: string) => {
		return name
			.split(' ')
			.map((word) => word.charAt(0))
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});
	};

	if (loading) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center h-full">
					<div className="text-lg">Loading profile...</div>
				</div>
			</DashboardLayout>
		);
	}

	if (!profile) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center h-full">
					<div className="text-lg text-red-500">Failed to load profile</div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
					<h1 className="text-2xl font-bold">Profile</h1>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto p-6">
					<div className="max-w-6xl mx-auto">
						<Card>
							<CardHeader>
								<div className="flex items-center gap-4">
									<div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 p-2">
										<span className="text-xl font-semibold text-primary">
											{getInitials(profile.fullName)}
										</span>
									</div>
									<div>
										<CardTitle className="text-xl">{profile.fullName}</CardTitle>
										<CardDescription>{profile.email}</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="space-y-6">
								{generalError && <ErrorAlert message={generalError} />}

								{/* Profile Information */}
								<div className="space-y-4">
									<div className="flex items-center gap-3">
										<User className="h-5 w-5 text-gray-500" />
										<h3 className="font-semibold">Profile Information</h3>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="text-sm font-semibold text-muted-foreground">Email</label>
											<div className="mt-1 text-sm text-foreground">{profile.email}</div>
										</div>
										<div>
											<label className="text-sm font-semibold text-muted-foreground">Role</label>
											<div className="mt-1 text-sm text-foreground capitalize">
												{profile.role}
											</div>
										</div>
										<div>
											<label className="text-sm font-semibold text-muted-foreground">
												Member Since
											</label>
											<div className="mt-1 text-sm text-foreground">
												{formatDate(profile.createdAt)}
											</div>
										</div>
									</div>
								</div>

								{/* Theme Preferences */}
								<div className="space-y-4 border-t pt-6">
									<div className="flex items-center gap-3">
										<Sun className="h-5 w-5 text-gray-500" />
										<h3 className="font-semibold">Theme Preferences</h3>
									</div>

									<div className="flex gap-2">
										<Button
											variant={theme === 'light' ? 'default' : 'outline'}
											onClick={() => setTheme('light')}
											className="flex items-center gap-2"
										>
											<Sun className="h-4 w-4" />
											Light
										</Button>
										<Button
											variant={theme === 'dark' ? 'default' : 'outline'}
											onClick={() => setTheme('dark')}
											className="flex items-center gap-2"
										>
											<Moon className="h-4 w-4" />
											Dark
										</Button>
										<Button
											variant={theme === 'system' ? 'default' : 'outline'}
											onClick={() => setTheme('system')}
											className="flex items-center gap-2"
										>
											<div className="h-4 w-4 rounded border-2 border-current" />
											System
										</Button>
									</div>
								</div>

								{/* Edit Form */}
								{isEditing ? (
									<div className="space-y-4 border-t pt-6">
										<div className="flex items-center gap-3">
											<Lock className="h-5 w-5 text-gray-500" />
											<h3 className="font-semibold">Edit Profile</h3>
										</div>

										<div className="space-y-4">
											<div className="max-w-md">
												<label className="text-sm font-semibold text-muted-foreground">
													Full Name
												</label>
												<Input
													type="text"
													value={formData.fullName}
													onChange={(e) =>
														setFormData((prev) => ({ ...prev, fullName: e.target.value }))
													}
													className="mt-1"
													disabled={saving}
												/>
												{errors.fullName && (
													<ErrorAlert message={errors.fullName} className="mt-2" />
												)}
											</div>

											<div className="space-y-3">
												<h4 className="text-sm font-semibold text-muted-foreground">
													Change Password (Optional)
												</h4>

												<div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
													<div>
														<label className="text-sm font-semibold text-muted-foreground">
															New Password
														</label>
														<Input
															type="password"
															value={formData.newPassword}
															onChange={(e) =>
																setFormData((prev) => ({
																	...prev,
																	newPassword: e.target.value,
																}))
															}
															className="mt-1"
															disabled={saving}
															placeholder="Enter new password"
														/>
													</div>

													<div>
														<label className="text-sm font-semibold text-muted-foreground">
															Confirm Password
														</label>
														<Input
															type="password"
															value={formData.confirmPassword}
															onChange={(e) =>
																setFormData((prev) => ({
																	...prev,
																	confirmPassword: e.target.value,
																}))
															}
															className="mt-1"
															disabled={saving}
															placeholder="Confirm password"
														/>
													</div>
												</div>
											</div>
										</div>

										<div className="flex gap-3 pt-4">
											<Button
												onClick={handleSave}
												disabled={saving}
												className="flex items-center gap-2"
											>
												<Save className="h-4 w-4" />
												{saving ? 'Saving...' : 'Save Changes'}
											</Button>
											<Button
												variant="outline"
												onClick={handleCancel}
												disabled={saving}
												className="flex items-center gap-2"
											>
												<X className="h-4 w-4" />
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<div className="flex gap-3 pt-4 border-t">
										<Button onClick={handleEdit} className="flex items-center gap-2">
											<User className="h-4 w-4" />
											Edit Profile
										</Button>
									</div>
								)}

								{/* Logout Section */}
								<div className="border-t pt-6">
									<div className="flex items-center gap-3 mb-4">
										<LogOut className="h-5 w-5 text-gray-500" />
										<h3 className="font-semibold">Account</h3>
									</div>
									<Button
										variant="outline"
										onClick={handleLogout}
										className="flex items-center gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
									>
										<LogOut className="h-4 w-4" />
										Logout
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</DashboardLayout>
	);
};

export default Profile;
