import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { User } from '../types';
import { apiRequest } from '../lib/api';
import { useFormErrors } from '../hooks/useFormErrors';
import { ErrorAlert } from './ErrorAlert';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff } from 'lucide-react';

interface ResetPasswordModalProps {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ user, isOpen, onClose }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetting, setResetting] = useState(false);
    const { generalError, clearErrors, handleApiResponse } = useFormErrors();
    const { toast } = useToast();

    const handleReset = async () => {
        if (!user) return;

        if (newPassword !== confirmPassword) {
            handleApiResponse({
                success: false,
                error: 'Passwords do not match'
            });
            return;
        }

        if (newPassword.length < 8) {
            handleApiResponse({
                success: false,
                error: 'Password must be at least 8 characters'
            });
            return;
        }

        clearErrors();
        setResetting(true);

        try {
            const response = await apiRequest(`/users/${user.id}/reset-password`, 'PATCH', {
                newPassword
            });

            if (response.success) {
                toast({
                    title: "Success",
                    description: `Password reset for ${user.fullName}`,
                });
                setNewPassword('');
                setConfirmPassword('');
                onClose();
            } else {
                handleApiResponse(response);
            }
        } catch (error) {
            handleApiResponse({
                success: false,
                error: 'Failed to reset password'
            });
        } finally {
            setResetting(false);
        }
    };

    const handleClose = () => {
        clearErrors();
        setNewPassword('');
        setConfirmPassword('');
        onClose();
    };

    React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            handleClose();
        } else if (e.key === 'Enter' && !resetting && newPassword && confirmPassword) {
            e.preventDefault();
            handleReset();
        }
    };

    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}, [isOpen, resetting, newPassword, confirmPassword]);

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset Password</DialogTitle>
                    <DialogDescription>
                        Set a new password for <strong>{user?.fullName}</strong>. They will need to use this password on their next login.
                    </DialogDescription>
                </DialogHeader>

                {generalError && <ErrorAlert message={generalError} />}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose} disabled={resetting}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleReset} 
                        disabled={resetting || !newPassword || !confirmPassword}
                    >
                        {resetting ? 'Resetting...' : 'Reset Password'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};