import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Provider } from '../Providers.types';

interface DeleteProviderDialogProps {
	open: boolean;
	provider: Provider | null;
	onClose: () => void;
	onConfirm: () => void;
}

export const DeleteProviderDialog = ({ open, provider, onClose, onConfirm }: DeleteProviderDialogProps) => {
	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Are you sure you want to delete this provider?</DialogTitle>
					<DialogDescription>
						This action cannot be undone. This will permanently delete the
						<span className="font-semibold"> {provider?.name} </span>
						provider.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
