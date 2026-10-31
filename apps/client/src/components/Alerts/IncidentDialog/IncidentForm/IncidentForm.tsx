import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FolderPlus, Pencil } from 'lucide-react';
import { FormEvent, useId, useState } from 'react';
import { IncidentDialogTarget } from '../IncidentDialog.types';

interface IncidentFormProps {
	target: IncidentDialogTarget;
	onCancel: () => void;
	onSubmit: (name: string, description: string) => void;
	isSubmitting?: boolean;
}

export const IncidentForm = ({ target, onCancel, onSubmit, isSubmitting }: IncidentFormProps) => {
	const idPrefix = useId();
	const incident = 'incident' in target ? target.incident : null;
	const [name, setName] = useState(incident?.name ?? '');
	const [description, setDescription] = useState(incident?.description ?? '');
	// An existing incident must keep a name; a new one may be auto-named.
	const canSubmit = !isSubmitting && (incident === null || name.trim().length > 0);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (canSubmit) onSubmit(name.trim(), description.trim());
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					{incident ? <Pencil className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
					{incident ? 'Edit incident' : 'Group into incident'}
				</DialogTitle>
				{'alerts' in target && (
					<DialogDescription>
						{target.alerts.length} alerts will be grouped under one incident. You become its owner, and any
						of them without an owner is assigned to you. Removing an alert's owner later takes it out of the
						incident.
					</DialogDescription>
				)}
			</DialogHeader>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-name`}>Name</Label>
					<Input
						id={`${idPrefix}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={incident ? undefined : 'e.g. Database meltdown (optional — auto-named if empty)'}
						autoFocus
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`${idPrefix}-desc`}>Details</Label>
					<Textarea
						id={`${idPrefix}-desc`}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder={incident ? undefined : "What's going on? (optional)"}
						rows={3}
					/>
				</div>
				{'alerts' in target && (
					<div className="max-h-32 overflow-y-auto rounded-md border border-border p-2 space-y-1">
						{target.alerts.map((alert) => (
							<div key={alert.id} className="text-xs text-muted-foreground truncate">
								{alert.alertName}
							</div>
						))}
					</div>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="submit" disabled={!canSubmit}>
						{incident
							? isSubmitting
								? 'Saving…'
								: 'Save'
							: isSubmitting
								? 'Creating…'
								: 'Create incident'}
					</Button>
				</DialogFooter>
			</form>
		</>
	);
};
