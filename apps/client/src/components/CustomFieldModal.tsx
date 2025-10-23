import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useCreateCustomField, useUpdateCustomField } from '../hooks/queries/custom-fields';
import { useToast } from '@/hooks/use-toast';
import { ServiceCustomField } from '@OpsiMate/shared';

interface CustomFieldModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	editingField?: ServiceCustomField | null;
}

export const CustomFieldModal: React.FC<CustomFieldModalProps> = ({ open, onOpenChange, editingField }) => {
	const [fieldName, setFieldName] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const createCustomField = useCreateCustomField();
	const updateCustomField = useUpdateCustomField();
	const { toast } = useToast();

	const isEditing = !!editingField;

	useEffect(() => {
		if (editingField) {
			setFieldName(editingField.name);
		} else {
			setFieldName('');
		}
	}, [editingField, open]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!fieldName.trim()) {
			toast({
				title: 'Error',
				description: 'Field name is required',
				variant: 'destructive',
			});
			return;
		}

		setIsSubmitting(true);

		try {
			if (isEditing && editingField) {
				await updateCustomField.mutateAsync({
					id: editingField.id,
					name: fieldName.trim(),
				});
				toast({
					title: 'Success',
					description: 'Custom field updated successfully',
				});
			} else {
				await createCustomField.mutateAsync(fieldName.trim());
				toast({
					title: 'Success',
					description: 'Custom field created successfully',
				});
			}
			onOpenChange(false);
		} catch (error: unknown) {
			toast({
				title: 'Error',
				description: (error as Error)?.message || `Failed to ${isEditing ? 'update' : 'create'} custom field`,
				variant: 'destructive',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen && !isSubmitting) {
			setFieldName('');
			onOpenChange(false);
		} else if (newOpen) {
			onOpenChange(true);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isEditing ? 'Edit Custom Field' : 'Create Custom Field'}</DialogTitle>
					<DialogDescription>
						{isEditing
							? 'Update the name of this custom field.'
							: 'Create a new custom field that can be used to store additional information for your services.'}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="field-name">Field Name</Label>
							<Input
								id="field-name"
								placeholder="e.g., Environment, Version, Owner"
								value={fieldName}
								onChange={(e) => setFieldName(e.target.value)}
								disabled={isSubmitting}
								autoFocus
							/>
							<p className="text-sm text-muted-foreground">
								This name will be displayed when managing service custom fields.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting || !fieldName.trim()}>
							{isSubmitting
								? isEditing
									? 'Updating...'
									: 'Creating...'
								: isEditing
									? 'Update Field'
									: 'Create Field'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
