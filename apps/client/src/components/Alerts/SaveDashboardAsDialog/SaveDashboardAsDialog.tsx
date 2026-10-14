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
import { FormEvent, useState } from 'react';
import { copyNameError, suggestCopyName } from './SaveDashboardAsDialog.utils';

export interface SaveDashboardAsValues {
	name: string;
	description: string;
}

// The dashboards list the duplicate check runs against. The server does not enforce
// unique names, so until the list has loaded successfully nothing can be submitted.
export type SaveAsNamesStatus = 'loading' | 'ready' | 'error';

export interface SaveDashboardAsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	// The dashboard being copied: its name seeds the suggestion, its description is kept.
	sourceName: string;
	sourceDescription: string;
	// Names already taken, so the copy can't shadow another dashboard in the switcher.
	existingNames: string[];
	namesStatus?: SaveAsNamesStatus;
	onSubmit: (values: SaveDashboardAsValues) => Promise<void>;
}

interface SaveAsFieldsProps {
	name: string;
	onNameChange: (name: string) => void;
	nameError: string | null;
	description: string;
	onDescriptionChange: (description: string) => void;
}

const SaveAsFields = ({ name, onNameChange, nameError, description, onDescriptionChange }: SaveAsFieldsProps) => (
	<div className="grid gap-4 py-4">
		<div className="grid gap-2">
			<Label htmlFor="save-as-name">Name</Label>
			<Input
				id="save-as-name"
				value={name}
				onChange={(e) => onNameChange(e.target.value)}
				autoFocus
				onFocus={(e) => e.target.select()}
				aria-invalid={nameError !== null}
				aria-describedby={nameError ? 'save-as-name-error' : undefined}
			/>
			{nameError && (
				<p id="save-as-name-error" className="text-xs text-destructive" role="alert">
					{nameError}
				</p>
			)}
		</div>
		<div className="grid gap-2">
			<Label htmlFor="save-as-description">Description</Label>
			<Textarea
				id="save-as-description"
				value={description}
				onChange={(e) => onDescriptionChange(e.target.value)}
				placeholder="Optional"
				className="resize-none"
				rows={3}
			/>
		</div>
	</div>
);

const SUBMIT_LABEL: Record<SaveAsNamesStatus, string> = {
	loading: 'Loading dashboards…',
	error: 'Dashboard list unavailable',
	ready: 'Save as new',
};

interface SaveAsFormProps extends Omit<SaveDashboardAsDialogProps, 'open' | 'onSubmit'> {
	submitting: boolean;
	onSubmit: (values: SaveDashboardAsValues) => void;
}

// Lives inside DialogContent, which Radix unmounts on close, so every opening starts
// from a fresh suggestion.
const SaveAsForm = ({
	onOpenChange,
	sourceName,
	sourceDescription,
	existingNames,
	namesStatus = 'ready',
	submitting,
	onSubmit,
}: SaveAsFormProps) => {
	// Derived until the user types: a suggestion made while the list was still loading
	// is replaced by a free one once the names arrive, instead of sitting there flagged
	// as a duplicate.
	const [typedName, setTypedName] = useState<string | null>(null);
	const name = typedName ?? suggestCopyName(sourceName, existingNames);
	const [description, setDescription] = useState(sourceDescription);
	const nameError = copyNameError(name, existingNames);
	const blocked = nameError !== null || namesStatus !== 'ready' || submitting;

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (!blocked) onSubmit({ name: name.trim(), description: description.trim() });
	};

	return (
		<form onSubmit={handleSubmit} noValidate>
			<DialogHeader>
				<DialogTitle>Save as new dashboard</DialogTitle>
				<DialogDescription>
					The view you have now is saved as a separate dashboard. &ldquo;{sourceName || 'New Dashboard'}
					&rdquo; keeps its last saved version.
				</DialogDescription>
			</DialogHeader>
			<SaveAsFields
				name={name}
				onNameChange={setTypedName}
				nameError={nameError}
				description={description}
				onDescriptionChange={setDescription}
			/>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
					Cancel
				</Button>
				<Button type="submit" disabled={blocked}>
					{submitting ? 'Saving…' : SUBMIT_LABEL[namesStatus]}
				</Button>
			</DialogFooter>
		</form>
	);
};

// The current view (filters, columns, toggles, search, time range — saved or not) is
// written to a NEW dashboard under the given name; the one it was derived from keeps
// its last saved version. Until now the only way out of "I like this but don't want to
// overwrite what I started from" was to redo the changes on a fresh draft.
export const SaveDashboardAsDialog = ({ open, onOpenChange, onSubmit, ...formProps }: SaveDashboardAsDialogProps) => {
	// Held here, outside the form, so Escape / overlay / X can't close the dialog
	// mid-request either (the request itself always completes in the caller).
	const [submitting, setSubmitting] = useState(false);

	const submit = async (values: SaveDashboardAsValues) => {
		setSubmitting(true);
		try {
			await onSubmit(values);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
			<DialogContent className="sm:max-w-md">
				<SaveAsForm onOpenChange={onOpenChange} submitting={submitting} onSubmit={submit} {...formProps} />
			</DialogContent>
		</Dialog>
	);
};
