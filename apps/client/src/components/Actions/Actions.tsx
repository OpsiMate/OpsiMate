import { DashboardLayout } from '@/components/DashboardLayout';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useCustomActions, useDeleteCustomAction } from '@/hooks/queries/custom-actions';
import { useToast } from '@/hooks/use-toast';
import { ActionTarget, CustomAction } from '@OpsiMate/custom-actions';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { ActionCategories } from './ActionCategories';
import { ActionModal } from './ActionModal';

export const Actions = () => {
	const { data: actions = [], isLoading } = useCustomActions();
	const deleteMutation = useDeleteCustomAction();
	const { toast } = useToast();
	const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
	const [editingAction, setEditingAction] = useState<CustomAction | undefined>();
	const [deleteActionId, setDeleteActionId] = useState<number | null>(null);

	const handleEdit = (action: CustomAction) => {
		setEditingAction(action);
		setModalMode('edit');
	};

	const handleDeleteClick = (action: CustomAction) => {
		if (!action.id) {
			toast({
				title: 'Error',
				description: 'Action ID is missing. Cannot delete this action.',
				variant: 'destructive',
			});
			return;
		}
		setDeleteActionId(action.id);
	};

	const handleDeleteConfirm = async () => {
		if (deleteActionId === null) return;
		try {
			await deleteMutation.mutateAsync(deleteActionId);
			toast({
				title: 'Success',
				description: 'Action deleted successfully',
			});
			setDeleteActionId(null);
		} catch (error) {
			toast({
				title: 'Error',
				description: error instanceof Error ? error.message : 'Failed to delete action',
				variant: 'destructive',
			});
		}
	};

	const targetOrder: Array<Exclude<ActionTarget, null>> = ['provider', 'service'];

	return (
		<DashboardLayout>
			<div className="flex flex-col h-full p-6 gap-6 max-w-7xl mx-auto">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Actions</h1>
						<p className="text-muted-foreground mt-1">Manage your custom actions</p>
					</div>
					<Button onClick={() => setModalMode('create')} className="gap-2">
						<Plus className="h-4 w-4" />
						New Action
					</Button>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : (
					<>
						<ActionCategories
							actions={actions}
							targetOrder={targetOrder}
							onEdit={handleEdit}
							onDelete={handleDeleteClick}
						/>

						{actions.length === 0 && (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<p className="text-muted-foreground mb-4">No actions yet</p>
								<Button onClick={() => setModalMode('create')} variant="outline">
									<Plus className="h-4 w-4 mr-2" />
									Create your first action
								</Button>
							</div>
						)}
					</>
				)}

				<ActionModal
					open={modalMode !== null}
					onClose={() => {
						setModalMode(null);
						setEditingAction(undefined);
					}}
					action={modalMode === 'edit' ? editingAction : undefined}
				/>

				<AlertDialog open={deleteActionId !== null} onOpenChange={(open) => !open && setDeleteActionId(null)}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Delete Action</AlertDialogTitle>
							<AlertDialogDescription>
								Are you sure you want to delete this action? This action cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={handleDeleteConfirm}
								disabled={deleteMutation.isPending}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{deleteMutation.isPending ? 'Deleting...' : 'Delete'}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</DashboardLayout>
	);
};
