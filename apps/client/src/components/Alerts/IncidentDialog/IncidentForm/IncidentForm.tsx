import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { pluralize } from '@/lib/text';
import { FolderInput, FolderPlus, Pencil } from 'lucide-react';
import { FormEvent, useId, useState } from 'react';
import { IncidentDialogTarget, IncidentFormResult } from '../IncidentDialog.types';

interface IncidentFormProps {
	target: IncidentDialogTarget;
	onCancel: () => void;
	onSubmit: (result: IncidentFormResult) => void;
	isSubmitting?: boolean;
}

// Where the selection goes: a new incident, or one that already exists.
type Destination = 'new' | 'existing';

export const IncidentForm = ({ target, onCancel, onSubmit, isSubmitting }: IncidentFormProps) => {
	const idPrefix = useId();
	const editing = 'incident' in target ? target.incident : null;
	const alerts = 'alerts' in target ? target.alerts : [];
	// An incident every selected alert already belongs to has nothing to receive.
	const candidates =
		'alerts' in target
			? target.incidents.filter((incident) => alerts.some((alert) => alert.incidentId !== incident.id))
			: [];
	// Even a single alert can start an incident; it just grows from there.
	const canCreate = alerts.length >= 1;
	const [destination, setDestination] = useState<Destination>('new');
	const [incidentId, setIncidentId] = useState<string>(candidates[0] ? String(candidates[0].id) : '');
	// Membership is exclusive, so moving alerts out of an incident that has no other
	// members dissolves it, name and details included. Say so before it happens.
	const selectedIds = new Set(alerts.map((alert) => alert.id));
	const chosenId = destination === 'existing' ? Number(incidentId) : null;
	const dissolving = ('alerts' in target ? target.incidents : []).filter(
		(incident) =>
			incident.id !== chosenId &&
			incident.alertIds.length > 0 &&
			incident.alertIds.every((id) => selectedIds.has(id))
	);
	const [name, setName] = useState(editing?.name ?? '');
	const [description, setDescription] = useState(editing?.description ?? '');

	const adding = editing === null && destination === 'existing';
	const canSubmit =
		!isSubmitting && (editing !== null ? name.trim().length > 0 : adding ? incidentId !== '' : canCreate);

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!canSubmit) return;
		if (editing) onSubmit({ kind: 'edit', name: name.trim(), description: description.trim() });
		else if (adding) onSubmit({ kind: 'add', incidentId: Number(incidentId) });
		else onSubmit({ kind: 'create', name: name.trim(), description: description.trim() });
	};

	const submitLabel = editing
		? isSubmitting
			? 'Saving…'
			: 'Save'
		: adding
			? isSubmitting
				? 'Adding…'
				: 'Add to incident'
			: isSubmitting
				? 'Creating…'
				: 'Create incident';

	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					{editing ? <Pencil className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
					{editing ? 'Edit incident' : 'Add to incident'}
				</DialogTitle>
				{!editing && (
					<DialogDescription>
						{alerts.length} {pluralize(alerts.length, 'alert')} selected. Alerts without an owner are
						assigned to the incident's owner — you, for a new incident. Removing an alert's owner later
						takes it out of the incident.
					</DialogDescription>
				)}
			</DialogHeader>
			<form onSubmit={handleSubmit} className="space-y-4">
				{!editing && (
					<div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1" role="radiogroup">
						<DestinationOption
							selected={destination === 'new'}
							disabled={!canCreate}
							icon={<FolderPlus className="h-3.5 w-3.5" />}
							label="New incident"
							onSelect={() => setDestination('new')}
						/>
						<DestinationOption
							selected={destination === 'existing'}
							disabled={candidates.length === 0}
							title={candidates.length === 0 ? 'No existing incident can take these alerts' : undefined}
							icon={<FolderInput className="h-3.5 w-3.5" />}
							label="Existing incident"
							onSelect={() => setDestination('existing')}
						/>
					</div>
				)}
				{adding ? (
					<div className="space-y-2">
						<Label htmlFor={`${idPrefix}-incident`}>Incident</Label>
						<Select value={incidentId} onValueChange={setIncidentId}>
							<SelectTrigger id={`${idPrefix}-incident`}>
								<SelectValue placeholder="Choose an incident" />
							</SelectTrigger>
							<SelectContent>
								{candidates.map((incident) => (
									<SelectItem key={incident.id} value={String(incident.id)}>
										{incident.name}
										<span className="ml-2 text-xs text-muted-foreground">
											{incident.alertCount} {pluralize(incident.alertCount, 'alert')}
											{incident.ownerName ? ` · ${incident.ownerName}` : ''}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : (
					<>
						<div className="space-y-2">
							<Label htmlFor={`${idPrefix}-name`}>Name</Label>
							<Input
								id={`${idPrefix}-name`}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder={
									editing ? undefined : 'e.g. Database meltdown (optional — auto-named if empty)'
								}
								autoFocus
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${idPrefix}-desc`}>Details</Label>
							<Textarea
								id={`${idPrefix}-desc`}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder={editing ? undefined : "What's going on? (optional)"}
								rows={3}
							/>
						</div>
					</>
				)}
				{dissolving.length > 0 && (
					<p className="text-xs text-amber-600 dark:text-amber-400" role="alert">
						{dissolving.length === 1 ? 'This dissolves incident ' : 'This dissolves incidents '}
						{dissolving.map((incident) => `"${incident.name}"`).join(', ')}
						{' — every alert '}
						{dissolving.length === 1 ? 'it has' : 'they have'} is selected and moves out.
					</p>
				)}
				{!editing && (
					<div className="max-h-32 overflow-y-auto rounded-md border border-border p-2 space-y-1">
						{alerts.map((alert) => (
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
						{submitLabel}
					</Button>
				</DialogFooter>
			</form>
		</>
	);
};

interface DestinationOptionProps {
	selected: boolean;
	disabled: boolean;
	title?: string;
	icon: React.ReactNode;
	label: string;
	onSelect: () => void;
}

const DestinationOption = ({ selected, disabled, title, icon, label, onSelect }: DestinationOptionProps) => (
	<button
		type="button"
		role="radio"
		aria-checked={selected}
		disabled={disabled}
		title={title}
		onClick={onSelect}
		className={cn(
			'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors',
			selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
			disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
		)}
	>
		{icon}
		{label}
	</button>
);
