import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
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
import { useCustomActions, useDeleteCustomAction } from '@/hooks/queries/custom-actions';
import { useToast } from '@/hooks/use-toast';
import { CustomAction } from '@OpsiMate/custom-actions';
import { Plus, Loader2, Zap, Trash2 } from 'lucide-react';
import { ActionCard } from './ActionCard';
import { ActionModal } from './ActionModal';
import { groupActionsByTarget } from './actions.utils';
import { ACTION_TARGET_LABELS, ACTION_TARGET_COLORS } from './actions.constants';

export const Actions = () => {
	const { data: actions = [], isLoading } = useCustomActions();
	const deleteMutation = useDeleteCustomAction();
	const { toast } = useToast();
	const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
	const [editingAction, setEditingAction] = useState<CustomAction | undefined>();
	const [deleteActionId, setDeleteActionId] = useState<number | null>(null);

	const groupedActions = groupActionsByTarget(actions);

	const handleEdit = (action: CustomAction) => {
		setEditingAction(action);
		setModalMode('edit');
	};

	const handleDeleteClick = (action: CustomAction & { id: number }) => {
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

	const targetOrder: Array<'service' | 'provider'> = ['service', 'provider'];

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
					<div className="flex flex-col gap-8">
						{targetOrder.map((target) => {
							const targetActions = groupedActions[target];
							if (targetActions.length === 0) return null;

							const targetColor = ACTION_TARGET_COLORS[target];

							const colorClasses = targetColor.split(' ');
							const bgColor = colorClasses.find(c => c.startsWith('bg-')) || 'bg-gray-500/10';
							const borderColor = colorClasses.find(c => c.startsWith('border-')) || 'border-gray-500/20';

							return (
								<div key={target} className="space-y-4">
									<div className="flex items-center gap-3">
										<div className={`flex items-center justify-center w-8 h-6 rounded border-2 ${bgColor} ${borderColor}`}>
											<Zap className="h-4 w-4 text-primary" />
										</div>
										<h2 className="text-xl font-semibold">{ACTION_TARGET_LABELS[target]}</h2>
									</div>
									<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
										{targetActions.map((action) => (
											<ActionCard
												key={(action as any).id}
												action={action}
												onClick={() => handleEdit(action)}
												onDelete={(e) => {
													e.stopPropagation();
													handleDeleteClick(action as CustomAction & { id: number });
												}}
											/>
										))}
									</div>
								</div>
							);
						})}

						{actions.length === 0 && (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<p className="text-muted-foreground mb-4">No actions yet</p>
								<Button onClick={() => setModalMode('create')} variant="outline">
									<Plus className="h-4 w-4 mr-2" />
									Create your first action
								</Button>
							</div>
						)}
					</div>
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
