import { USERNAME_RULES } from '@OpsiMate/shared';
import React, { useCallback, useState } from 'react';
import { useFormErrors } from '../hooks/useFormErrors';
import { apiRequest } from '../lib/api';
import { User } from '../types';
import { ErrorAlert } from './ErrorAlert';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface EditUserModalProps {
	user: User | null;
	isOpen: boolean;
	onClose: () => void;
	onUserUpdated: (updatedUser: User) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onUserUpdated }) => {
	const [fullName, setFullName] = useState(user?.fullName || '');
	const [username, setUsername] = useState(user?.username || '');
	const [email, setEmail] = useState(user?.email || '');
	const [saving, setSaving] = useState(false);
	const { generalError, clearErrors, handleApiResponse } = useFormErrors();

	React.useEffect(() => {
		if (user) {
			setFullName(user.fullName);
			setUsername(user.username);
			setEmail(user.email ?? '');
		}
	}, [user]);

	const handleSave = useCallback(async () => {
		if (!user) return;

		clearErrors();
		setSaving(true);

		try {
			const response = await apiRequest<User>(`/users/${user.id}`, 'PATCH', {
				fullName: fullName.trim(),
				username: username.trim(),
				// Optional: an empty box clears the address.
				email: email.trim() || null,
			});

			if (response.success && response.data) {
				onUserUpdated(response.data);
				onClose();
			} else {
				handleApiResponse(response);
			}
		} catch (error) {
			handleApiResponse({
				success: false,
				error: 'Failed to update user',
			});
		} finally {
			setSaving(false);
		}
	}, [user, fullName, username, email, clearErrors, handleApiResponse, onUserUpdated, onClose]);

	const handleClose = useCallback(() => {
		clearErrors();
		onClose();
	}, [clearErrors, onClose]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (saving || !fullName.trim() || !username.trim()) return;
		handleSave();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit User</DialogTitle>
					<DialogDescription>
						Update user information. A renamed username or changed email is what the user signs in with from
						now on.
					</DialogDescription>
				</DialogHeader>

				{generalError && <ErrorAlert message={generalError} />}

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-fullName">Full Name</Label>
						<Input
							id="edit-fullName"
							value={fullName}
							onChange={(e) => setFullName(e.target.value)}
							placeholder="John Doe"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-username">Username</Label>
						<Input
							id="edit-username"
							value={username}
							onChange={(e) => setUsername(e.target.value.toLowerCase())}
							placeholder="john.doe"
							minLength={2}
							maxLength={64}
							pattern="^[a-z0-9._-]{2,64}$"
							title={USERNAME_RULES}
							disabled={user?.authSource === 'ldap'}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-email">Email (optional)</Label>
						<Input
							id="edit-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="john@example.com"
							disabled={user?.authSource === 'ldap'}
						/>
						{user?.authSource === 'ldap' && (
							<p className="text-xs text-muted-foreground">
								Signs in through LDAP: the username and email come from the directory.
							</p>
						)}
					</div>

					<DialogFooter>
						<Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving || !fullName.trim() || !username.trim()}>
							{saving ? 'Saving...' : 'Save Changes'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
