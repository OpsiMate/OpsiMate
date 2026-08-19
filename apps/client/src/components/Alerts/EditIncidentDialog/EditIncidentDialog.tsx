import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IncidentSummary } from '@OpsiMate/shared';
import { Pencil } from 'lucide-react';
import { FormEvent, useEffect, useId, useState } from 'react';

interface EditIncidentDialogProps {
	incident: IncidentSummary | null;
	onOpenChange: (open: boolean) => void;
	onSave: (id: number, name: string, description: string) => void;
	isSaving?: boolean;
}

// Rename / edit-details for an existing incident; open whenever `incident` is set.
export const EditIncidentDialog = ({ incident, onOpenChange, onSave, isSaving }: EditIncidentDialogProps) => {
	const idPrefix = useId();
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');

	// Sync form state when a (different) incident opens the dialog.
	useEffect(() => {
		if (incident) {
			setName(incident.name);
			setDescription(incident.description ?? '');
		}
	}, [incident]);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!incident || !name.trim()) return;
		onSave(incident.id, name.trim(), description.trim());
	};

	return (
		<Dialog open={incident !== null} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Pencil className="h-4 w-4" />
						Edit incident
					</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={`${idPrefix}-name`}>Name</Label>
						<Input
							id={`${idPrefix}-name`}
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoFocus
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${idPrefix}-desc`}>Details</Label>
						<Textarea
							id={`${idPrefix}-desc`}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={3}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSaving || !name.trim()}>
							{isSaving ? 'Saving…' : 'Save'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
