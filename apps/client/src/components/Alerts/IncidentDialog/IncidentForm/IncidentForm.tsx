import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { pluralize } from '@/lib/text';
import { Folder, FolderInput, FolderMinus, FolderPlus, Pencil } from 'lucide-react';
import { FormEvent, useId, useState } from 'react';
import { IncidentDialogTarget, IncidentFormResult } from '../IncidentDialog.types';
import { DestinationOption } from './DestinationOption';
import { DESTINATION_MODE, Destination, Mode, SUBMIT_LABELS } from './IncidentForm.constants';

interface IncidentFormProps {
	target: IncidentDialogTarget;
	onCancel: () => void;
	onSubmit: (result: IncidentFormResult) => void;
	isSubmitting?: boolean;
}

export const IncidentForm = ({ target, onCancel, onSubmit, isSubmitting }: IncidentFormProps) => {
	const idPrefix = useId();
	const editing = 'incident' in target ? target.incident : null;
	const alerts = 'alerts' in target ? target.alerts : [];
	const incidents = 'alerts' in target ? target.incidents : [];
	const incidentsState = 'alerts' in target ? target.incidentsState : 'ready';
	// An incident every selected alert already belongs to has nothing to receive.
	const candidates = incidents.filter((incident) => alerts.some((alert) => alert.incidentId !== incident.id));
	// Members among the selection, for the remove option.
	const members = alerts.filter((alert) => alert.incidentId != null);
	const [destination, setDestination] = useState<Destination>('new');
	const [incidentId, setIncidentId] = useState<string>(candidates[0] ? String(candidates[0].id) : '');
	const [name, setName] = useState(editing?.name ?? '');
	const [description, setDescription] = useState(editing?.description ?? '');

	const mode: Mode = editing ? 'edit' : DESTINATION_MODE[destination];
	const adding = mode === 'add';
	const removing = mode === 'remove';
	// Membership is exclusive, so moving alerts out of an incident that has no other
	// members dissolves it, name and details included. Say so before it happens.
	const selectedIds = new Set(alerts.map((alert) => alert.id));
	const chosenId = adding ? Number(incidentId) : null;
	const dissolving = incidents.filter(
		(incident) =>
			incident.id !== chosenId &&
			incident.alertIds.length > 0 &&
			incident.alertIds.every((id) => selectedIds.has(id))
	);
	const incidentName = (id: number | null | undefined) =>
		incidents.find((incident) => incident.id === id)?.name ?? 'an incident';

	// Even a single alert can start an incident, so 'create' needs nothing beyond the
	// loaded incidents list (for the dissolve warning).
	const modeReady: Record<Mode, boolean> = {
		edit: name.trim().length > 0,
		create: incidentsState === 'ready',
		add: incidentsState === 'ready' && incidentId !== '',
		remove: incidentsState === 'ready' && members.length > 0,
	};
	const canSubmit = !isSubmitting && modeReady[mode];

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (!canSubmit) return;
		switch (mode) {
			case 'edit':
				return onSubmit({ kind: 'edit', name: name.trim(), description: description.trim() });
			case 'add':
				return onSubmit({ kind: 'add', incidentId: Number(incidentId) });
			case 'remove':
				return onSubmit({ kind: 'remove' });
			case 'create':
				return onSubmit({ kind: 'create', name: name.trim(), description: description.trim() });
		}
	};

	const submitLabel = SUBMIT_LABELS[mode][isSubmitting ? 'busy' : 'idle'];

	return (
		<>
			<DialogHeader className="min-w-0">
				<DialogTitle className="flex items-center gap-2">
					{editing ? <Pencil className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
					{editing ? 'Edit incident' : 'Incident'}
				</DialogTitle>
				{!editing && (
					<DialogDescription>
						{alerts.length} {pluralize(alerts.length, 'alert')} selected
						{members.length > 0 ? `, ${members.length} already in an incident` : ''}. Alerts without an
						owner are assigned to the incident's owner — you, for a new incident. Removing an alert's owner
						later takes it out of the incident.
					</DialogDescription>
				)}
			</DialogHeader>
			<form onSubmit={handleSubmit} className="min-w-0 space-y-4">
				{!editing && (
					<div className="grid grid-cols-3 gap-1 rounded-md border border-border p-1" role="radiogroup">
						<DestinationOption
							selected={destination === 'new'}
							icon={<FolderPlus className="h-3.5 w-3.5" />}
							label="New"
							onSelect={() => setDestination('new')}
						/>
						<DestinationOption
							selected={destination === 'existing'}
							disabled={candidates.length === 0}
							title={candidates.length === 0 ? 'No existing incident can take these alerts' : undefined}
							icon={<FolderInput className="h-3.5 w-3.5" />}
							label="Existing"
							onSelect={() => setDestination('existing')}
						/>
						<DestinationOption
							selected={destination === 'remove'}
							disabled={members.length === 0}
							title={members.length === 0 ? 'None of the selected alerts is in an incident' : undefined}
							icon={<FolderMinus className="h-3.5 w-3.5" />}
							label="Remove"
							onSelect={() => setDestination('remove')}
						/>
					</div>
				)}
				{removing ? (
					<p className="text-sm text-muted-foreground">
						{members.length} of {alerts.length} selected {pluralize(alerts.length, 'alert')}{' '}
						{members.length === 1 ? 'is' : 'are'} in an incident and will be taken out of it; the rest are
						left alone.
					</p>
				) : adding ? (
					<div className="space-y-2">
						<Label htmlFor={`${idPrefix}-incident`}>Incident</Label>
						<Select value={incidentId} onValueChange={setIncidentId}>
							<SelectTrigger id={`${idPrefix}-incident`}>
								<SelectValue placeholder="Choose an incident" />
							</SelectTrigger>
							<SelectContent>
								{candidates.map((incident) => (
									<SelectItem key={incident.id} value={String(incident.id)}>
										<span className="truncate">{incident.name}</span>
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
				{incidentsState !== 'ready' && (
					<p className="text-xs text-muted-foreground" role="status">
						{incidentsState === 'loading'
							? 'Loading incidents…'
							: 'Could not load the incidents list; grouping is paused until it does.'}
					</p>
				)}
				{dissolving.length > 0 && (
					<p className="break-words text-xs text-amber-600 dark:text-amber-400" role="alert">
						{dissolving.length === 1 ? 'This dissolves incident ' : 'This dissolves incidents '}
						{dissolving.map((incident) => `"${incident.name}"`).join(', ')}
						{' — every alert '}
						{dissolving.length === 1 ? 'it has' : 'they have'} is selected and moves out.
					</p>
				)}
				{!editing && (
					<div className="max-h-32 overflow-y-auto rounded-md border border-border p-2 space-y-1">
						{alerts.map((alert) => (
							<div
								key={alert.id}
								className="min-w-0 truncate text-xs text-muted-foreground"
								title={alert.alertName}
							>
								{alert.alertName}
								{alert.incidentId != null && (
									<span className="ml-1 opacity-70">· in {incidentName(alert.incidentId)}</span>
								)}
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
