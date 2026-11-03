// What happens to the selection: a new incident, an existing one, or out of its incidents.
export type Destination = 'new' | 'existing' | 'remove';

// What submitting does. Editing is decided by the target; the rest by the destination.
export type Mode = 'edit' | 'create' | 'add' | 'remove';
export const DESTINATION_MODE: Record<Destination, Mode> = { new: 'create', existing: 'add', remove: 'remove' };
export const SUBMIT_LABELS: Record<Mode, { idle: string; busy: string }> = {
	edit: { idle: 'Save', busy: 'Saving…' },
	create: { idle: 'Create incident', busy: 'Creating…' },
	add: { idle: 'Add to incident', busy: 'Adding…' },
	remove: { idle: 'Remove from incident', busy: 'Removing…' },
};
