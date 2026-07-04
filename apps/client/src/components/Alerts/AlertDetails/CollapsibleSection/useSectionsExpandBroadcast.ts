import { useState } from 'react';
import { SectionsExpandSignal } from './CollapsibleSection.types';

// Owns a broadcast signal: feed `signal` to SectionsExpandContext.Provider and
// `broadcast` to SectionsExpandControls.
export const useSectionsExpandBroadcast = () => {
	const [signal, setSignal] = useState<SectionsExpandSignal | null>(null);
	const broadcast = (open: boolean) => setSignal((prev) => ({ open, token: (prev?.token ?? 0) + 1 }));
	return { signal, broadcast };
};
