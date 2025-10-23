import { Logger, SecretMetadata } from '@OpsiMate/shared';
import { useEffect, useState } from 'react';
import { useToast } from '../hooks/use-toast';
import { updateSecretOnServer } from '../lib/sslKeys';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { FileDropzone } from './ui/file-dropzone';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const logger = new Logger('EditSecretDialog');

interface EditSecretDialogProps {
	secret: SecretMetadata;
	open: boolean;
	onClose: () => void;
	onSuccess: () => void;
}

export const EditSecretDialog = ({ secret, open, onClose, onSuccess }: EditSecretDialogProps) => {
	const [displayName, setDisplayName] = useState(secret.name);
	const [secretType, setSecretType] = useState<'ssh' | 'kubeconfig'>(secret.type);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isFileValid, setIsFileValid] = useState<boolean | null>(null);
	const [updating, setUpdating] = useState(false);
	const { toast } = useToast();

	// Reset form when dialog opens/closes or secret changes
	useEffect(() => {
		if (open) {
			setDisplayName(secret.name);
			setSecretType(secret.type);
			setSelectedFile(null);
			setIsFileValid(null);
		}
	}, [open, secret]);

	const handleFile = async (file: File) => {
		// todo: implement file validation
		setIsFileValid(true);
		setSelectedFile(file);
	};

	const handleSave = async () => {
		if (!displayName.trim()) {
			toast({
				title: 'Error',
				description: 'Secret name is required',
				variant: 'destructive',
			});
			return;
		}

		setUpdating(true);
		try {
			const result = await updateSecretOnServer(
				secret.id,
				displayName.trim(),
				selectedFile || undefined,
				secretType
			);

			if (result.success) {
				toast({
					title: 'Success',
					description: 'Secret updated successfully',
				});
				onSuccess();
				onClose();
			} else {
				toast({
					title: 'Error',
					description: result.error || 'Failed to update secret',
					variant: 'destructive',
				});
			}
		} catch (error) {
			logger.error('Error updating secret:', error);
			toast({
				title: 'Error',
				description: 'An unexpected error occurred while updating the secret',
				variant: 'destructive',
			});
		} finally {
			setUpdating(false);
		}
	};

	const handleCancel = () => {
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className='sm:max-w-[425px]'>
				<DialogHeader>
					<DialogTitle>Edit Secret</DialogTitle>
					<DialogDescription>
						Update the secret name, type, or upload a new file. Leave the file field empty to keep the
						current file.
					</DialogDescription>
				</DialogHeader>
				<div className='space-y-3'>
					<div className='space-y-2'>
						<Label htmlFor='secret-name'>Secret name</Label>
						<Input
							id='secret-name'
							placeholder='My SSH Key'
							value={displayName}
							onChange={e => setDisplayName(e.target.value)}
						/>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='secret-type'>Type</Label>
						<Select
							value={secretType}
							onValueChange={(value: 'ssh' | 'kubeconfig') => setSecretType(value)}
						>
							<SelectTrigger>
								<SelectValue placeholder='Select type' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='ssh'>SSH Key</SelectItem>
								<SelectItem value='kubeconfig'>Kubeconfig</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='secret-upload'>New file (optional)</Label>
						<FileDropzone
							id='secret-upload'
							accept='*'
							loading={updating}
							onFile={handleFile}
							multiple={false}
						/>
						{selectedFile && <p className='text-sm text-muted-foreground'>Selected: {selectedFile.name}</p>}
						{!selectedFile && (
							<p className='text-sm text-muted-foreground'>Current file: {secret.fileName}</p>
						)}
					</div>
				</div>
				<DialogFooter>
					<Button type='button' variant='outline' onClick={handleCancel} disabled={updating}>
						Cancel
					</Button>
					<Button type='button' onClick={handleSave} disabled={updating || !displayName.trim()}>
						{updating ? 'Updating...' : 'Update Secret'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
