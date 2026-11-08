import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { RefObject, useEffect, useRef } from 'react';
import { COPY_PREVIEW_MAX_CHARS } from '../AlertRow/AlertCellContextMenu/AlertCellContextMenu.constants';
import { copyValueOf, previewValue } from '../AlertRow/AlertRow.utils';
import { CELL_COPIED_DESCRIPTION, EDITABLE_TARGET_SELECTOR } from './useCellCopyShortcut.constants';

// Cmd+C (Mac) / Ctrl+C, without Shift/Alt variants (those are other shortcuts).
export const isCopyShortcut = (e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>) =>
	e.key.toLowerCase() === 'c' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;

// Copying from a field the user is typing in, or of text they highlighted, is the
// browser's job; the shortcut only steps in when neither applies.
export const browserOwnsCopy = (target: EventTarget | null): boolean =>
	!!(target as Element | null)?.closest?.(EDITABLE_TARGET_SELECTOR) ||
	(window.getSelection()?.toString() ?? '').length > 0;

interface UseCellCopyShortcutOptions {
	// The table's scroll element: presses inside it pick the cell to copy.
	scrollerRef: RefObject<HTMLDivElement | null>;
}

// Click a cell, press Cmd/Ctrl+C, and the cell's value is copied — no text selection
// needed (dragging across a row's text drags the row). The last pressed cell is
// remembered until a press outside the table; the value is the same one the row's
// right-click menu copies (full value where a cell declares one, its text otherwise,
// nothing for the checkbox, icon and placeholder cells).
export const useCellCopyShortcut = ({ scrollerRef }: UseCellCopyShortcutOptions): void => {
	const { copy } = useCopyToClipboard();
	// The listeners below live for the component's life; they read the latest copy() through a ref.
	const copyRef = useRef(copy);
	useEffect(() => {
		copyRef.current = copy;
	});
	const pressedValue = useRef<string | null>(null);

	useEffect(() => {
		const onMouseDown = (e: MouseEvent) => {
			const inTable = !!scrollerRef.current?.contains(e.target as Node);
			pressedValue.current = inTable ? copyValueOf(e.target) : null;
		};
		const onKeyDown = (e: KeyboardEvent) => {
			const value = pressedValue.current;
			if (!value || !isCopyShortcut(e) || browserOwnsCopy(e.target)) return;
			e.preventDefault();
			void copyRef.current(value, {
				successDescription: CELL_COPIED_DESCRIPTION(previewValue(value, COPY_PREVIEW_MAX_CHARS)),
			});
		};
		document.addEventListener('mousedown', onMouseDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onMouseDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [scrollerRef]);
};
