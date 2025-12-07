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
	const [email, setEmail] = useState(user?.email || '');
	const [saving, setSaving] = useState(false);
	const { generalError, clearErrors, handleApiResponse } = useFormErrors();

	React.useEffect(() => {
		if (user) {
			setFullName(user.fullName);
			setEmail(user.email);
		}
	}, [user]);

	const handleSave = useCallback(async () => {
		if (!user) return;

		clearErrors();
		setSaving(true);

		try {
			const response = await apiRequest<User>(`/users/${user.id}`, 'PATCH', {
				fullName: fullName.trim(),
				email: email.trim(),
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
	}, [user, fullName, email, clearErrors, handleApiResponse, onUserUpdated, onClose]);

	const handleClose = useCallback(() => {
		clearErrors();
		onClose();
	}, [clearErrors, onClose]);

	React.useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				handleClose();
			} else if (e.key === 'Enter' && !saving && fullName.trim() && email.trim()) {
				e.preventDefault();
				handleSave();
			}
		};

		if (isOpen) {
			window.addEventListener('keydown', handleKeyDown);
			return () => {
				window.removeEventListener('keydown', handleKeyDown);
			};
		}
	}, [isOpen, saving, fullName, email, handleClose, handleSave]);

	return (
		<Dialog open={isOpen} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit User</DialogTitle>
					<DialogDescription>
						Update user information. The user will need to use their new email for login if changed.
					</DialogDescription>
				</DialogHeader>

				{generalError && <ErrorAlert message={generalError} />}

				<div className="space-y-4">
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
						<Label htmlFor="edit-email">Email</Label>
						<Input
							id="edit-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="john@example.com"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={handleClose} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving || !fullName.trim() || !email.trim()}>
						{saving ? 'Saving...' : 'Save Changes'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
