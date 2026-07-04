import { createContext, useState } from 'react';

// Broadcast from a container's "Expand all" / "Collapse all" buttons to every
// CollapsibleSection below it. `token` bumps on each click so the same action can be
// applied twice in a row; sections keep their own state between broadcasts.
export interface SectionsExpandSignal {
	open: boolean;
	token: number;
}

export const SectionsExpandContext = createContext<SectionsExpandSignal | null>(null);

// Owns a broadcast signal: feed `signal` to SectionsExpandContext.Provider and
// `broadcast` to SectionsExpandControls.
export const useSectionsExpandBroadcast = () => {
	const [signal, setSignal] = useState<SectionsExpandSignal | null>(null);
	const broadcast = (open: boolean) => setSignal((prev) => ({ open, token: (prev?.token ?? 0) + 1 }));
	return { signal, broadcast };
};
