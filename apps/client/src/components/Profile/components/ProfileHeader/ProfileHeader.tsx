import { useRef, useState, useCallback } from 'react';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getInitials } from '../../utils/profile.utils';
import { useUploadAvatar, useDeleteAvatar, validateAvatarFile } from '@/hooks/queries/users';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfileHeaderProps {
	fullName: string;
	email: string;
	avatarUrl?: string | null;
}

export const ProfileHeader = ({ fullName, email, avatarUrl }: ProfileHeaderProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const { toast } = useToast();

	const uploadAvatar = useUploadAvatar();
	const deleteAvatar = useDeleteAvatar();

	const handleFileSelect = useCallback(
		async (file: File) => {
			const validation = validateAvatarFile(file);
			if (!validation.valid) {
				toast({
					variant: 'destructive',
					title: 'Invalid file',
					description: validation.error,
				});
				return;
			}

			try {
				await uploadAvatar.mutateAsync(file);
				toast({
					title: 'Avatar updated',
					description: 'Your profile image has been updated successfully.',
				});
			} catch (error) {
				toast({
					variant: 'destructive',
					title: 'Upload failed',
					description: error instanceof Error ? error.message : 'Failed to upload avatar',
				});
			}
		},
		[uploadAvatar, toast]
	);

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
		// Reset input so the same file can be selected again
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	const handleDeleteAvatar = async () => {
		try {
			await deleteAvatar.mutateAsync();
			toast({
				title: 'Avatar removed',
				description: 'Your profile image has been removed.',
			});
		} catch (error) {
			toast({
				variant: 'destructive',
				title: 'Delete failed',
				description: error instanceof Error ? error.message : 'Failed to delete avatar',
			});
		}
	};

	const isLoading = uploadAvatar.isPending || deleteAvatar.isPending;

	return (
		<CardHeader>
			<div className="flex items-center gap-4">
				{/* Avatar container with upload functionality */}
				<div className="relative group">
					<div
						className={`flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 overflow-hidden transition-all ${
							isDragging ? 'border-primary ring-2 ring-primary/50' : 'border-primary/20'
						} ${!isLoading ? 'cursor-pointer hover:border-primary/50' : ''}`}
						onClick={() => !isLoading && fileInputRef.current?.click()}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
					>
						{isLoading ? (
							<Loader2 className="w-6 h-6 animate-spin text-primary" />
						) : avatarUrl ? (
							<img src={avatarUrl} alt={`${fullName}'s avatar`} className="w-full h-full object-cover" />
						) : (
							<span className="text-xl font-semibold text-primary">{getInitials(fullName)}</span>
						)}
					</div>

					{/* Upload/Edit overlay */}
					{!isLoading && (
						<div
							className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
							onClick={() => fileInputRef.current?.click()}
						>
							<Camera className="w-5 h-5 text-white" />
						</div>
					)}

					{/* Delete button - only show when avatar exists */}
					{avatarUrl && !isLoading && (
						<Button
							variant="destructive"
							size="icon"
							className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
							onClick={(e) => {
								e.stopPropagation();
								handleDeleteAvatar();
							}}
						>
							<Trash2 className="w-3 h-3" />
						</Button>
					)}
				</div>

				{/* Hidden file input */}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png"
					onChange={handleFileInputChange}
					className="hidden"
				/>

				<div>
					<CardTitle className="text-xl">{fullName}</CardTitle>
					<CardDescription>{email}</CardDescription>
					<p className="text-xs text-muted-foreground mt-1">Click or drag an image to update your avatar</p>
				</div>
			</div>
		</CardHeader>
	);
};
