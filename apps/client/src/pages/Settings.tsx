import { EditSecretDialog } from '@/components/EditSecretDialog';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createSecretOnServer, deleteSecretOnServer, getSecretsFromServer } from '@/lib/sslKeys';
import { AuditLog, Logger, SecretMetadata } from '@OpsiMate/shared';
import { Check, Edit, FileText, KeyRound, Plus, Settings as SettingsIcon, Trash2, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AddUserModal } from '../components/AddUserModal';
import { CustomFieldsTable } from '../components/CustomFieldsTable';
import { DashboardLayout } from '../components/DashboardLayout';
import { EditUserModal } from '../components/EditUserModal';
import { ErrorAlert } from '../components/ErrorAlert';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useFormErrors } from '../hooks/useFormErrors';
import { apiRequest, auditApi } from '../lib/api';
import { getCurrentUser } from '../lib/auth';
import { Role, User } from '../types';

const logger = new Logger('Settings');
const PAGE_SIZE = 20;

const Settings: React.FC = () => {
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [updatingUser, setUpdatingUser] = useState<string | null>(null);
	const [showAddUserModal, setShowAddUserModal] = useState(false);
	const { generalError, clearErrors, handleApiResponse } = useFormErrors();
	const currentUser = getCurrentUser();
	const [userToDelete, setUserToDelete] = useState<User | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
	const [showEditModal, setShowEditModal] = useState(false);
	const [userToEdit, setUserToEdit] = useState<User | null>(null);
	const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
	const [userToResetPassword, setUserToResetPassword] = useState<User | null>(null);
	const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

	const fetchUsers = useCallback(async () => {
		try {
			const response = await apiRequest<User[]>('/users', 'GET');
			if (response.success && response.data) {
				setUsers(response.data);
			} else {
				handleApiResponse(response);
			}
		} catch (error) {
			handleApiResponse({
				success: false,
				error: 'Failed to fetch users',
			});
		} finally {
			setLoading(false);
		}
	}, [handleApiResponse]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	const handleRoleUpdate = async (email: string, newRole: Role) => {
		setUpdatingUser(email);
		clearErrors();

		try {
			const response = await apiRequest('/users/role', 'PATCH', { email, newRole });
			if (response.success) {
				// Update the local state
				setUsers((prevUsers) =>
					prevUsers.map((user) => (user.email === email ? { ...user, role: newRole as Role } : user))
				);
			} else {
				handleApiResponse(response);
			}
		} catch (error) {
			handleApiResponse({
				success: false,
				error: 'Failed to update user role',
			});
		} finally {
			setUpdatingUser(null);
		}
	};

	const handleUserCreated = (newUser: User) => {
		setUsers((prevUsers) => [...prevUsers, newUser]);
	};

	const getRoleBadgeVariant = (role: Role) => {
		switch (role) {
			case Role.Admin:
				return 'destructive';
			case Role.Editor:
				return 'default';
			case Role.Viewer:
				return 'secondary';
			case Role.Operation:
				return 'info';
			default:
				return 'outline';
		}
	};
	// Filter users based on search query
	const filteredUsers = users.filter(
		(user) =>
			user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			user.email.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Handle bulk role update
	const handleBulkRoleUpdate = async (newRole: Role) => {
		for (const userId of selectedUsers) {
			const user = users.find((u) => u.id === userId);
			if (user && user.email !== currentUser?.email) {
				await handleRoleUpdate(user.email, newRole);
			}
		}
		setSelectedUsers([]);
	};

	// Handle bulk delete
	const handleBulkDelete = async () => {
		for (const userId of selectedUsers) {
			if (users.find((u) => u.id === userId)?.email !== currentUser?.email) {
				await handleDeleteUser(userId);
			}
		}
		setSelectedUsers([]);
		setShowBulkDeleteConfirm(false);
	};

	// Handle user update from edit modal
	const handleUserUpdated = (updatedUser: User) => {
		setUsers((prevUsers) => prevUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const isAdmin = currentUser?.role === Role.Admin;

	const handleDeleteUser = async (userId: number) => {
		setDeleting(true);
		try {
			const response = await apiRequest(`/users/${userId}`, 'DELETE');
			if (response.success) {
				setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));
				setUserToDelete(null);
			} else {
				handleApiResponse(response);
			}
		} catch (error) {
			handleApiResponse({ success: false, error: 'Failed to delete user' });
		} finally {
			setDeleting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-lg">Loading settings...</div>
			</div>
		);
	}

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex-shrink-0 bg-background border-b border-border px-6 py-4">
					<h1 className="text-2xl font-bold">Settings</h1>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-auto p-6">
					<div className="max-w-6xl mx-auto">
						{generalError && <ErrorAlert message={generalError} className="mb-6" />}

						<Tabs
							defaultValue={(function () {
								const h = (location.hash || '').replace('#', '');
								if (h === 'Users') return 'users';
								if (h === 'Audit_Log') return 'audit';
								if (h === 'secrets') return 'secrets';
								if (h === 'custom-fields') return 'custom-fields';
								return 'users';
							})()}
							onValueChange={(v) => {
								const map: Record<string, string> = {
									users: 'Users',
									audit: 'Audit_Log',
									secrets: 'secrets',
									'custom-fields': 'custom-fields',
								};
								const next = map[v] || v;
								if (next) window.location.hash = next;
							}}
							className="space-y-6"
						>
							<div className="flex gap-6">
								<div className="w-64 flex-shrink-0">
									<TabsList className="flex flex-col items-stretch h-auto p-2 gap-2">
										<TabsTrigger value="users" className="justify-start gap-2">
											<Users className="h-4 w-4" />
											Users
										</TabsTrigger>
										<TabsTrigger value="audit" className="justify-start gap-2">
											<FileText className="h-4 w-4" />
											Audit Log
										</TabsTrigger>
										<TabsTrigger value="secrets" className="justify-start gap-2">
											<KeyRound className="h-4 w-4" />
											Secrets
										</TabsTrigger>
										<TabsTrigger value="custom-fields" className="justify-start gap-2">
											<SettingsIcon className="h-4 w-4" />
											Custom Service Fields
										</TabsTrigger>
									</TabsList>
								</div>
								<div className="flex-1">
									<TabsContent value="users" className="space-y-6">
										<div className="flex justify-between items-center gap-4">
											<div className="flex-1">
												<h2 className="text-2xl font-semibold">User Management</h2>
												<p className="text-muted-foreground">
													Manage user access and permissions for your Service instance.
												</p>
											</div>
											<div className="flex gap-2">
												{selectedUsers.length > 0 && (
													<>
														<Select
															value=""
															onValueChange={(newRole) =>
																handleBulkRoleUpdate(newRole as Role)
															}
														>
															<SelectTrigger className="w-40">
																<SelectValue placeholder="Bulk Role Change" />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value={Role.Viewer}>
																	Set as Viewer
																</SelectItem>
																<SelectItem value={Role.Editor}>
																	Set as Editor
																</SelectItem>
																<SelectItem value={Role.Admin}>Set as Admin</SelectItem>
																<SelectItem value={Role.Operation}>
																	Set as Operation
																</SelectItem>
															</SelectContent>
														</Select>
														<Button
															variant="destructive"
															size="sm"
															onClick={() => setShowBulkDeleteConfirm(true)}
														>
															Delete Selected ({selectedUsers.length})
														</Button>
													</>
												)}
												<Button onClick={() => setShowAddUserModal(true)} variant="default">
													<Plus className="h-4 w-4 mr-2" />
													Add User
												</Button>
											</div>
										</div>

										{/* Search Bar */}
										<div className="flex gap-2">
											<Input
												placeholder="Search users by name or email..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="max-w-md"
											/>
											{searchQuery && (
												<Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
													Clear
												</Button>
											)}
										</div>

										{/* Users Table */}
										<Card>
											<CardHeader>
												<CardTitle>Current Users ({filteredUsers.length})</CardTitle>
											</CardHeader>
											<CardContent>
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead className="w-12">
																<input
																	type="checkbox"
																	checked={
																		selectedUsers.length === filteredUsers.length &&
																		filteredUsers.length > 0
																	}
																	onChange={(e) => {
																		if (e.target.checked) {
																			setSelectedUsers(
																				filteredUsers.map((u) => u.id)
																			);
																		} else {
																			setSelectedUsers([]);
																		}
																	}}
																	className="cursor-pointer"
																/>
															</TableHead>
															<TableHead>User</TableHead>
															<TableHead>Email</TableHead>
															<TableHead>Role</TableHead>
															<TableHead>Created</TableHead>
															<TableHead>Actions</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{filteredUsers.map((user) => (
															<TableRow key={user.id}>
																<TableCell>
																	<input
																		type="checkbox"
																		checked={selectedUsers.includes(user.id)}
																		onChange={(e) => {
																			if (e.target.checked) {
																				setSelectedUsers((prev) => [
																					...prev,
																					user.id,
																				]);
																			} else {
																				setSelectedUsers((prev) =>
																					prev.filter((id) => id !== user.id)
																				);
																			}
																		}}
																		disabled={user.email === currentUser?.email}
																		className="cursor-pointer"
																	/>
																</TableCell>
																<TableCell className="font-medium">
																	{user.fullName}
																	{user.email === currentUser?.email && (
																		<Badge
																			variant="outline"
																			className="ml-2 text-xs"
																		>
																			(me)
																		</Badge>
																	)}
																</TableCell>
																<TableCell>{user.email}</TableCell>
																<TableCell>
																	<Badge variant={getRoleBadgeVariant(user.role)}>
																		{user.role}
																	</Badge>
																</TableCell>
																<TableCell>{formatDate(user.createdAt)}</TableCell>
																<TableCell>
																	<div className="flex items-center gap-2">
																		<Select
																			value={user.role}
																			onValueChange={(newRole) =>
																				handleRoleUpdate(
																					user.email,
																					newRole as Role
																				)
																			}
																			disabled={
																				updatingUser === user.email ||
																				user.email === currentUser?.email
																			}
																		>
																			<SelectTrigger className="w-32">
																				<SelectValue />
																			</SelectTrigger>
																			<SelectContent>
																				<SelectItem value={Role.Viewer}>
																					Viewer
																				</SelectItem>
																				<SelectItem value={Role.Editor}>
																					Editor
																				</SelectItem>
																				<SelectItem value={Role.Admin}>
																					Admin
																				</SelectItem>
																				<SelectItem value={Role.Operation}>
																					Operation
																				</SelectItem>
																			</SelectContent>
																		</Select>
																		{isAdmin &&
																			user.email !== currentUser?.email && (
																				<>
																					<Button
																						variant="ghost"
																						size="icon"
																						onClick={() => {
																							setUserToEdit(user);
																							setShowEditModal(true);
																						}}
																						title="Edit user"
																					>
																						<Edit className="h-4 w-4" />
																					</Button>
																					<Button
																						variant="ghost"
																						size="icon"
																						onClick={() => {
																							setUserToResetPassword(
																								user
																							);
																							setShowResetPasswordModal(
																								true
																							);
																						}}
																						title="Reset password"
																					>
																						<KeyRound className="h-4 w-4" />
																					</Button>
																					<AlertDialog>
																						<AlertDialogTrigger asChild>
																							<Button
																								variant="ghost"
																								size="icon"
																								className="text-red-600 hover:bg-red-100 focus:bg-red-100 focus:ring-2 focus:ring-red-400"
																								title="Delete user"
																								onClick={() =>
																									setUserToDelete(
																										user
																									)
																								}
																							>
																								<Trash2 className="h-4 w-4" />
																							</Button>
																						</AlertDialogTrigger>
																						<AlertDialogContent>
																							<AlertDialogHeader>
																								<AlertDialogTitle>
																									Delete User
																								</AlertDialogTitle>
																								<AlertDialogDescription>
																									Are you sure you
																									want to delete{' '}
																									<b>
																										{
																											userToDelete?.fullName
																										}
																									</b>
																									? This action cannot
																									be undone.
																								</AlertDialogDescription>
																							</AlertDialogHeader>
																							<AlertDialogFooter>
																								<AlertDialogCancel
																									disabled={deleting}
																									onClick={() =>
																										setUserToDelete(
																											null
																										)
																									}
																								>
																									Cancel
																								</AlertDialogCancel>
																								<AlertDialogAction
																									className="bg-red-600 hover:bg-red-700 focus:ring-red-400"
																									disabled={deleting}
																									onClick={() =>
																										handleDeleteUser(
																											userToDelete!
																												.id
																										)
																									}
																								>
																									{deleting
																										? 'Deleting...'
																										: 'Delete'}
																								</AlertDialogAction>
																							</AlertDialogFooter>
																						</AlertDialogContent>
																					</AlertDialog>
																				</>
																			)}
																	</div>
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</CardContent>
										</Card>
									</TabsContent>

									<TabsContent value="audit" className="space-y-6">
										<div>
											<h2 className="text-2xl font-semibold">Audit Log</h2>
											<p className="text-muted-foreground">
												View activity logs for all dashboard operations and user actions.
											</p>
										</div>
										<Card>
											<CardHeader>
												<CardTitle>Activity Logs</CardTitle>
											</CardHeader>
											<CardContent>
												<AuditLogTable />
											</CardContent>
										</Card>
									</TabsContent>

									<TabsContent value="secrets" className="space-y-6">
										<div className="flex justify-between items-center">
											<div>
												<h2 className="text-2xl font-semibold">Secrets</h2>
												<p className="text-muted-foreground">
													Manage SSH keys and kubeconfig files used to access providers and
													services securely.
												</p>
											</div>
											<AddSecretButton />
										</div>

										<Card>
											<CardHeader>
												<CardTitle>Secrets</CardTitle>
											</CardHeader>
											<CardContent>
												<SslKeysTable />
											</CardContent>
										</Card>
									</TabsContent>

									<TabsContent value="custom-fields" className="space-y-6">
										<div>
											<h2 className="text-2xl font-semibold">Custom Service Fields</h2>
											<p className="text-muted-foreground">
												Create and manage custom fields for your services. These fields can
												store additional information like environment, version, or any other
												metadata.
											</p>
										</div>
										<Card>
											<CardHeader>
												<CardTitle>Custom Fields</CardTitle>
											</CardHeader>
											<CardContent>
												<CustomFieldsTable />
											</CardContent>
										</Card>
									</TabsContent>
								</div>
							</div>
						</Tabs>
					</div>
				</div>
			</div>
			{/* Add User Modal */}
			<AddUserModal
				isOpen={showAddUserModal}
				onClose={() => setShowAddUserModal(false)}
				onUserCreated={handleUserCreated}
			/>

			{/* Edit User Modal */}
			<EditUserModal
				user={userToEdit}
				isOpen={showEditModal}
				onClose={() => {
					setShowEditModal(false);
					setUserToEdit(null);
				}}
				onUserUpdated={handleUserUpdated}
			/>

			{/* Reset Password Modal */}
			<ResetPasswordModal
				user={userToResetPassword}
				isOpen={showResetPasswordModal}
				onClose={() => {
					setShowResetPasswordModal(false);
					setUserToResetPassword(null);
				}}
			/>

			{/* Bulk Delete Confirmation */}
			<AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Multiple Users</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete {selectedUsers.length} user(s)? This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleBulkDelete}>
							Delete {selectedUsers.length} User(s)
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</DashboardLayout>
	);
};

export default Settings;

// Helper to parse SQLite UTC timestamp as ISO 8601
function parseUTCDate(dateString: string) {
	return new Date(dateString.replace(' ', 'T') + 'Z');
}

function formatRelativeTime(dateString: string) {
	const now = new Date();
	const date = parseUTCDate(dateString);
	const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // in seconds
	if (diff < 60) return 'just now';
	if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? '' : 's'} ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? '' : 's'} ago`;
	if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? '' : 's'} ago`;
	return date.toLocaleDateString();
}

const AuditLogTable: React.FC = () => {
	const [logs, setLogs] = useState<AuditLog[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'>('ALL');

	useEffect(() => {
		let mounted = true;
		setLoading(true);

		auditApi.getAuditLogs(page, pageSize).then((res) => {
			if (mounted) {
				if (res && Array.isArray(res.logs)) {
					setLogs(res.logs);
					setTotal(res.total || 0);
					setError(null);
				} else {
					setError(res?.error || 'Failed to fetch audit logs');
				}
				setLoading(false);
			}
		});

		return () => {
			mounted = false;
		};
	}, [page, pageSize]);

	const totalPages = Math.ceil(total / pageSize);
	const filteredLogs = logs.filter((log) => (filter === 'ALL' ? true : log.actionType === filter));

	const getActionBadgeProps = (action: string) => {
		switch (action) {
			case 'CREATE':
				return { variant: 'secondary', className: 'bg-green-100 text-green-800 border-green-200' };
			case 'UPDATE':
				return {
					variant: 'secondary',
					className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
				};
			case 'DELETE':
				return { variant: 'destructive', className: '' };
			default:
				return { variant: 'outline', className: '' };
		}
	};

	const handlePageChange = (newPage: number) => {
		setPage(newPage);
	};

	const handlePageSizeChange = (newSize: number) => {
		setPageSize(newSize);
		setPage(1);
	};

	const renderPageNumbers = () => {
		return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
			let pageNum;
			if (totalPages <= 5) {
				pageNum = i + 1;
			} else if (page <= 3) {
				pageNum = i + 1;
			} else if (page >= totalPages - 2) {
				pageNum = totalPages - 4 + i;
			} else {
				pageNum = page - 2 + i;
			}

			return (
				<Button
					key={pageNum}
					variant={page === pageNum ? 'default' : 'outline'}
					size="sm"
					onClick={() => handlePageChange(pageNum)}
					className="min-w-[40px]"
				>
					{pageNum}
				</Button>
			);
		});
	};

	return (
		<div>
			<div className="flex justify-end items-center mb-4">
				<div className="flex items-center gap-2">
					<label className="text-sm text-muted-foreground">Items per page:</label>
					<select
						value={pageSize}
						onChange={(e) => handlePageSizeChange(Number(e.target.value))}
						className="border rounded px-3 py-1 text-sm"
					>
						{[5, 10, 15, 20].map((size) => (
							<option key={size} value={size}>
								{size}
							</option>
						))}
					</select>
				</div>
			</div>

			{loading ? (
				<div className="py-8 text-center">Loading audit logs...</div>
			) : error ? (
				<ErrorAlert message={error} className="mb-4" />
			) : filteredLogs.length === 0 ? (
				<div className="py-8 text-center text-muted-foreground">No audit logs found.</div>
			) : (
				<>
					{/* Table */}
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Time</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Resource</TableHead>
								<TableHead>Resource Name</TableHead>
								<TableHead>User</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredLogs.map((log) => {
								const actionProps = getActionBadgeProps(log.actionType);
								return (
									<TableRow key={log.id}>
										<TableCell>
											<span title={parseUTCDate(log.timestamp).toLocaleString()}>
												{formatRelativeTime(log.timestamp)}
											</span>
										</TableCell>
										<TableCell>
											<Badge
												variant={
													actionProps.variant as
														| 'default'
														| 'destructive'
														| 'outline'
														| 'secondary'
												}
												className={actionProps.className}
											>
												{log.actionType}
											</Badge>
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{log.resourceType}</Badge>
										</TableCell>
										<TableCell>{log.resourceName || '-'}</TableCell>
										<TableCell>{log.userName || '-'}</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>

					{totalPages > 1 && (
						<div className="flex justify-center items-center gap-3 mt-6 pt-4 border-t">
							<Button
								variant="outline"
								size="sm"
								onClick={() => handlePageChange(Math.max(1, page - 1))}
								disabled={page === 1}
							>
								&larr; Previous
							</Button>

							<div className="flex items-center gap-2">{renderPageNumbers()}</div>

							<Button
								variant="outline"
								size="sm"
								onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
								disabled={page === totalPages}
							>
								Next &rarr;
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
};

interface AddSecretButtonProps {
	triggerText?: string;
	secretType?: 'ssh' | 'kubeconfig';
	onSecretCreated?: (secretId?: number) => void;
	children?: React.ReactNode;
	className?: string;
}

export const AddSecretButton: React.FC<AddSecretButtonProps> = ({
	triggerText = 'Add Secret',
	secretType: defaultSecretType = 'ssh',
	onSecretCreated,
	children,
	className,
}) => {
	const [open, setOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [fileName, setFileName] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState<string>('');
	const [secretType, setSecretType] = useState<'ssh' | 'kubeconfig'>(defaultSecretType);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isFileValid, setIsFileValid] = useState<boolean | null>(null);
	const { toast } = useToast();

	const handleFile = async (file: File) => {
		setIsFileValid(true);
		setSelectedFile(file);
		setFileName(file.name);
	};

	const handleSave = async () => {
		if (!selectedFile) return;

		setUploading(true);
		try {
			const name = displayName.trim() || fileName || 'key';
			const result = await createSecretOnServer(name, selectedFile, secretType);

			if (result.success) {
				toast({
					title: 'Success',
					description: 'Secret created successfully',
				});

				if (onSecretCreated) {
					onSecretCreated(result.id);
				}

				window.dispatchEvent(new Event('secrets-updated'));
				setOpen(false);
				resetForm();
			} else {
				toast({
					title: 'Error',
					description: result.error || 'Failed to create secret',
					variant: 'destructive',
				});
			}
		} catch (error) {
			logger.error('Error creating SSL key:', error);
			toast({
				title: 'Error',
				description: 'An unexpected error occurred while creating the secret',
				variant: 'destructive',
			});
		} finally {
			setUploading(false);
		}
	};

	const resetForm = () => {
		setFileName(null);
		setDisplayName('');
		setSecretType(defaultSecretType);
		setSelectedFile(null);
		setIsFileValid(null);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(newOpen) => {
				setOpen(newOpen);
				if (!newOpen) {
					resetForm();
				}
			}}
		>
			<DialogTrigger asChild>
				{children || (
					<Button className={className}>
						<Plus className="h-4 w-4 mr-2" />
						{triggerText}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Secret</DialogTitle>
					<DialogDescription>
						Upload a secret file (SSH key or kubeconfig). It will be encrypted and stored securely.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<div className="space-y-2">
						<Label htmlFor="secret-name">Secret name</Label>
						<Input
							id="secret-name"
							placeholder="My SSH Key"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="secret-type">Type</Label>
						<Select
							value={secretType}
							onValueChange={(value: 'ssh' | 'kubeconfig') => setSecretType(value)}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="ssh">SSH Key</SelectItem>
								<SelectItem value="kubeconfig">Kubeconfig</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<FileDropzone
						id="secret-upload"
						accept="*"
						loading={uploading}
						onFile={handleFile}
						multiple={false}
					/>
					{fileName && (
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm">
								<span>
									Selected: <b>{fileName}</b>
								</span>
								{isFileValid !== null &&
									(isFileValid ? (
										<Check className="h-4 w-4 text-green-600" />
									) : (
										<X className="h-4 w-4 text-red-600" />
									))}
							</div>
							{isFileValid === false && (
								<div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
									<X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
									<div className="text-sm text-red-700">
										<p className="font-medium">Invalid file format</p>
										<p className="text-red-600 mt-1">
											This file doesn't appear to be a valid secret file. Please ensure you're
											uploading an SSH key or kubeconfig file.
										</p>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button disabled={!fileName || isFileValid === false} onClick={handleSave}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

const SslKeysTable: React.FC = () => {
	const [secrets, setSecrets] = useState<SecretMetadata[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<number | null>(null);
	const [editingSecret, setEditingSecret] = useState<SecretMetadata | null>(null);
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState('');

	const filteredSecrets = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return secrets;

		return secrets.filter((secret) => {
			const nameMatch = secret.name.toLowerCase().includes(query);
			return nameMatch;
		});
	}, [secrets, searchQuery]);

	const loadSecrets = async () => {
		setLoading(true);
		try {
			const secretsData = await getSecretsFromServer();
			setSecrets(secretsData);
			setError(null);
		} catch (error) {
			logger.error('Error loading secrets:', error);
			setError('Failed to load secrets');
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteSecret = async (secretId: number) => {
		setDeleting(secretId);
		try {
			const result = await deleteSecretOnServer(secretId);
			if (result.success) {
				toast({
					title: 'Success',
					description: 'Secret deleted successfully',
				});
				loadSecrets(); // Refresh the list
			} else {
				toast({
					title: 'Error',
					description: result.error || 'Failed to delete secret',
					variant: 'destructive',
				});
			}
		} catch (error) {
			logger.error('Error deleting SSL key:', error);
			toast({
				title: 'Error',
				description: 'An unexpected error occurred while deleting the secret',
				variant: 'destructive',
			});
		} finally {
			setDeleting(null);
		}
	};

	useEffect(() => {
		loadSecrets();

		// Listen for updates
		const handleSecretsUpdated = () => {
			loadSecrets();
		};

		window.addEventListener('secrets-updated', handleSecretsUpdated);
		return () => window.removeEventListener('secrets-updated', handleSecretsUpdated);
	}, []);

	if (loading) return <div className="py-6 text-center">Loading secrets...</div>;
	if (error) return <div className="py-6 text-center text-red-600">{error}</div>;
	if (!secrets.length) return <div className="py-6 text-center text-muted-foreground">No secrets added yet.</div>;

	return (
		<>
			<div className="relative w-full md:w-96 mb-4">
				<Input
					placeholder="Search by secret name or provider..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pr-8"
				/>

				{searchQuery && (
					<button
						onClick={() => setSearchQuery('')}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						aria-label="Clear search"
					>
						×
					</button>
				)}
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Secret Name</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{filteredSecrets.length === 0 ? (
						<TableRow>
							<TableCell colSpan={4} className="text-center text-gray-500">
								No secrets match your search.
							</TableCell>
						</TableRow>
					) : (
						filteredSecrets.map((secret) => (
							<TableRow key={secret.id}>
								<TableCell>
									<b>{secret.name}</b>
								</TableCell>
								<TableCell>
									<Badge variant={secret.type === 'kubeconfig' ? 'secondary' : 'default'}>
										{secret.type === 'kubeconfig' ? 'Kubeconfig' : 'SSH Key'}
									</Badge>
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<Button
											variant="ghost"
											size="sm"
											className="text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
											title="Edit secret"
											onClick={() => setEditingSecret(secret)}
										>
											<Edit className="h-4 w-4" />
										</Button>
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
													title="Delete SSL key"
													disabled={deleting === secret.id}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Delete Secret</AlertDialogTitle>
													<AlertDialogDescription>
														Are you sure you want to delete "<b>{secret.name}</b>"? This
														action cannot be undone and will permanently remove the secret
														file.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel disabled={deleting === secret.id}>
														Cancel
													</AlertDialogCancel>
													<AlertDialogAction
														className="bg-red-600 hover:bg-red-700 focus:ring-red-400"
														disabled={deleting === secret.id}
														onClick={() => handleDeleteSecret(secret.id)}
													>
														{deleting === secret.id ? 'Deleting...' : 'Delete'}
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>

			{editingSecret && (
				<EditSecretDialog
					secret={editingSecret}
					open={!!editingSecret}
					onClose={() => setEditingSecret(null)}
					onSuccess={() => {
						loadSecrets();
						setEditingSecret(null);
					}}
				/>
			)}
		</>
	);
};
