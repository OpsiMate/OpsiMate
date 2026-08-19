import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@OpsiMate/shared';
import { FolderPlus } from 'lucide-react';
import { FormEvent, useId, useState } from 'react';

interface CreateIncidentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	// The alerts being grouped; shown so the user confirms WHAT they're grouping.
	alerts: Alert[];
	onCreate: (name: string, description: string) => void;
	isCreating?: boolean;
}

// Names an incident at creation. Both fields are optional — submitting empty is fine,
// the server then names it "Incident #<id>" — so grouping is never blocked on wording.
export const CreateIncidentDialog = ({
	open,
	onOpenChange,
	alerts,
	onCreate,
	isCreating,
}: CreateIncidentDialogProps) => {
	const idPrefix = useId();
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		onCreate(name.trim(), description.trim());
	};

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			setName('');
			setDescription('');
		}
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FolderPlus className="h-4 w-4" />
						Group into incident
					</DialogTitle>
					<DialogDescription>
						{alerts.length} alerts will be grouped under one incident. They stay fully functional — the
						incident is a folder, not a cage.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor={`${idPrefix}-name`}>Name</Label>
						<Input
							id={`${idPrefix}-name`}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. Database meltdown (optional — auto-named if empty)"
							autoFocus
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${idPrefix}-desc`}>Details</Label>
						<Textarea
							id={`${idPrefix}-desc`}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="What's going on? (optional)"
							rows={3}
						/>
					</div>
					<div className="max-h-32 overflow-y-auto rounded-md border border-border p-2 space-y-1">
						{alerts.map((alert) => (
							<div key={alert.id} className="text-xs text-muted-foreground truncate">
								{alert.alertName}
							</div>
						))}
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={isCreating}>
							{isCreating ? 'Creating…' : 'Create incident'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
