import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { providerApi } from '@/lib/api';
import { Tag } from '@OpsiMate/shared';
import { AlertTriangle } from 'lucide-react';

interface DeleteTagDialogProps {
	open: boolean;
	onClose: () => void;
	tag: Tag | null;
	onTagDeleted: (tagId: number) => void;
}

export const DeleteTagDialog = ({ open, onClose, tag, onTagDeleted }: DeleteTagDialogProps) => {
	const { toast } = useToast();
	const [loading, setLoading] = useState(false);

	const handleDelete = async () => {
		if (!tag) return;

		setLoading(true);
		try {
			const response = await providerApi.deleteTag(tag.id);

			if (response.success) {
				onTagDeleted(tag.id);
				toast({
					title: 'Success',
					description: 'Tag deleted successfully',
				});
				handleClose();
			} else {
				toast({
					title: 'Error',
					description: response.error || 'Failed to delete tag',
					variant: 'destructive',
				});
			}
		} catch (error) {
			toast({
				title: 'Error',
				description: 'Failed to delete tag',
				variant: 'destructive',
			});
		} finally {
			setLoading(false);
		}
	};

	const handleClose = () => {
		setLoading(false);
		onClose();
	};

	if (!tag) return null;

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className='sm:max-w-[425px]'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<AlertTriangle className='h-5 w-5 text-destructive' />
						Delete Tag
					</DialogTitle>
					<DialogDescription>
						Are you sure you want to delete the tag <strong>"{tag.name}"</strong>? This action will remove
						the tag from all services and cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className='flex items-center gap-3 p-4 bg-muted/50 rounded-lg'>
					<div className='w-4 h-4 rounded-full' style={{ backgroundColor: tag.color }} />
					<span className='font-medium'>{tag.name}</span>
				</div>

				<DialogFooter>
					<Button type='button' variant='outline' onClick={handleClose} disabled={loading}>
						Cancel
					</Button>
					<Button type='button' variant='destructive' onClick={handleDelete} disabled={loading}>
						{loading ? 'Deleting...' : 'Delete Tag'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
