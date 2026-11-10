import { useEffect, useRef } from 'react';
import { KEEP_SELECTION_SELECTOR, SELECTION_SCOPE_SELECTOR } from './useClickAwayDeselect.constants';

interface UseClickAwayDeselectOptions {
	// Something is selected or open; nothing to clear otherwise.
	active: boolean;
	onClickAway: () => void;
}

// A press on empty space — outside the table, the panels, the selection bar and any
// control or overlay — is "I'm done with these": the keep-list above decides. Only the
// primary button counts: a right-click opens a menu for what is under it.
export const isClickAway = (target: EventTarget | null): boolean => {
	const el = target as Element | null;
	if (!el?.closest) return false;
	return !el.closest(SELECTION_SCOPE_SELECTOR) && !el.closest(KEEP_SELECTION_SELECTOR);
};

// Clears the alert selection (and the open details) when the user presses on empty space,
// the way a file manager does: a plain click selected the row, a click away lets it go.
export const useClickAwayDeselect = ({ active, onClickAway }: UseClickAwayDeselectOptions): void => {
	const latest = useRef({ active, onClickAway });
	useEffect(() => {
		latest.current = { active, onClickAway };
	});
	useEffect(() => {
		const onMouseDown = (e: MouseEvent) => {
			if (e.button !== 0 || !latest.current.active) return;
			if (isClickAway(e.target)) latest.current.onClickAway();
		};
		document.addEventListener('mousedown', onMouseDown);
		return () => document.removeEventListener('mousedown', onMouseDown);
	}, []);
};
