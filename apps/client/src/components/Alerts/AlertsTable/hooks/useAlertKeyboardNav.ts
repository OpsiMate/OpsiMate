import { Alert } from '@OpsiMate/shared';
import { Virtualizer } from '@tanstack/react-virtual';
import { RefObject, useEffect, useRef } from 'react';
import { FlatGroupItem } from '../AlertsTable.types';

interface UseAlertKeyboardNavOptions {
	flatRows: FlatGroupItem[];
	// Alert currently open in the details sidebar; arrows move relative to it.
	activeAlertId: string | null;
	onAlertClick?: (alert: Alert) => void;
	virtualizer: Virtualizer<HTMLDivElement, Element>;
	scrollerRef: RefObject<HTMLDivElement | null>;
}

// One registered entry per mounted AlertsTable (split-by-assignment renders several).
interface NavInstance {
	getScroller: () => HTMLDivElement | null;
	containsActive: () => boolean;
	navigate: (delta: 1 | -1) => void;
}

// Arrows must not fire while the user is typing or inside any overlay that has its own
// arrow-key semantics (Radix menus/selects/dialogs render in portals with these roles;
// the popper wrapper catches popovers like the date-range calendar).
const OVERLAY_SELECTOR =
	'[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="combobox"], [data-radix-popper-content-wrapper]';

const isTextEntry = (el: EventTarget | null): boolean => {
	if (!(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
};

// ONE window listener shared by every mounted table, dispatching to a single owner —
// per-instance listeners would each move their own rows on the same keypress in the
// split-by-assignment view. Owner resolution: the pane whose rows contain the alert
// that is open in the details sidebar; failing that, the pane the user last
// clicked/focused into; failing that, the first pane on screen.
const instances = new Set<NavInstance>();

const resolveOwner = (): NavInstance | null => {
	const mounted = [...instances].filter((i) => i.getScroller());
	if (mounted.length === 0) return null;
	const withActive = mounted.find((i) => i.containsActive());
	if (withActive) return withActive;
	const focused = mounted.find((i) => i.getScroller()!.contains(document.activeElement));
	if (focused) return focused;
	return mounted.sort((a, b) =>
		a.getScroller()!.compareDocumentPosition(b.getScroller()!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
	)[0];
};

const handleWindowKeyDown = (e: KeyboardEvent) => {
	if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
	// Modified arrows are someone else's shortcut (e.g. Alt+arrows navigates history).
	if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
	if (isTextEntry(e.target)) return;
	if (e.target instanceof HTMLElement && e.target.closest(OVERLAY_SELECTOR)) return;
	const owner = resolveOwner();
	if (!owner) return;
	// Also claims the boundary press (first/last row): the key is "spent" on row
	// navigation either way, rather than falling through to a surprise page scroll.
	e.preventDefault();
	owner.navigate(e.key === 'ArrowDown' ? 1 : -1);
};

// ArrowUp/ArrowDown step the details-sidebar selection through the table's rows —
// group headers are skipped, collapsed groups' alerts are simply absent from flatRows.
// With nothing selected, Down starts at the first row and Up at the last. Selection
// goes through onAlertClick, so keyboard and mouse share one code path (including
// mark-as-read).
export const useAlertKeyboardNav = ({
	flatRows,
	activeAlertId,
	onAlertClick,
	virtualizer,
	scrollerRef,
}: UseAlertKeyboardNavOptions) => {
	// The window listener lives for the instance's lifetime; reading through a ref keeps
	// it current without re-registering (and re-ordering the registry) every render.
	const latest = useRef({ flatRows, activeAlertId, onAlertClick, virtualizer });
	latest.current = { flatRows, activeAlertId, onAlertClick, virtualizer };

	useEffect(() => {
		// The row index the keyboard last navigated to, or null when nothing is pinned.
		// Only the LATEST navigation may correct the scroll — under key-repeat, stale
		// loops from earlier steps would tug the scroller back to old targets.
		let pendingScrollIndex: number | null = null;
		let pendingAlertId: string | null = null;

		// scrollToIndex alone is not enough, for two reasons. (1) The scroller's top is
		// occluded by the sticky column header (and, when grouping, the pinned group
		// copies), which the virtualizer's scroll math knows nothing about — a row it
		// considers visible can sit fully under the header or just below the fold.
		// (2) The layout keeps moving after the keypress: the selection render, the
		// virtualizer's re-measure, and the debounce-coalesced mark-read refetch each
		// shift rows by a few px. So the target is held visible by a BOUNDED per-frame
		// rect check. Bounded matters: an unconditional every-frame nudge oscillates on
		// sub-pixel row fractions — each nudge fires a scroll event and a render, 60
		// times a second, forever. Hence the three stop conditions: an epsilon below
		// which the row counts as in place, a no-progress check for when scrollTop is
		// clamped at its limit (the row cannot be brought closer), and a frame budget
		// long enough (~700ms) to outlast the refetch-driven shifts. A newer keypress
		// retargets the pin; wheel/touch/mousedown releases it (it must never fight a
		// manual scroll).
		const PIN_FRAME_BUDGET = 45;
		const PIN_EPSILON_PX = 1.5;
		const pinTargetVisible = (attempts: number) => {
			const rowIndex = pendingScrollIndex;
			if (rowIndex === null) return;
			if (attempts >= PIN_FRAME_BUDGET) {
				pendingScrollIndex = null;
				return;
			}
			const next = () => requestAnimationFrame(() => pinTargetVisible(attempts + 1));
			const scroller = scrollerRef.current;
			if (!scroller) {
				// Scroller unmounted (tab switch, empty-state flip). Release rather than
				// bare-return: navigate() only starts a loop when none is pinned, so a
				// silent exit that leaves the pin set would strand navigation loop-less.
				pendingScrollIndex = null;
				return;
			}
			// The refetch can reorder rows — if this index no longer holds the alert we
			// navigated to, the pin is meaningless; let go rather than chase a stranger.
			const target = latest.current.flatRows[rowIndex];
			if (!target || target.type !== 'leaf' || target.alert.id !== pendingAlertId) {
				pendingScrollIndex = null;
				return;
			}
			const row = scroller.querySelector(`[data-index="${rowIndex}"]`);
			if (!row) {
				// Not rendered yet (long jump) — the scrollToIndex that accompanied this
				// pin brings it into the window within a frame or two.
				next();
				return;
			}
			const scRect = scroller.getBoundingClientRect();
			// Client box, not rect bottom: the rect includes the horizontal scrollbar
			// (~15px), and a row "visible" against the rect can sit entirely under it.
			const visibleBottom = scRect.top + scroller.clientTop + scroller.clientHeight;
			let visibleTop = scRect.top;
			const sticky = scroller.querySelector('[data-table-sticky-header]');
			if (sticky) {
				visibleTop = Math.max(visibleTop, sticky.getBoundingClientRect().bottom);
				// Pinned group copies hang BELOW the header via absolute positioning,
				// extending the occlusion without extending the header's own rect.
				const hang = sticky.querySelector('[data-table-sticky-hang]');
				if (hang) visibleTop = Math.max(visibleTop, hang.getBoundingClientRect().bottom);
			}
			const rowRect = row.getBoundingClientRect();
			const delta =
				rowRect.top < visibleTop - PIN_EPSILON_PX
					? rowRect.top - visibleTop
					: rowRect.bottom > visibleBottom + PIN_EPSILON_PX
						? rowRect.bottom - visibleBottom
						: 0;
			if (delta !== 0) {
				const before = scroller.scrollTop;
				scroller.scrollTop = before + delta;
				// Clamped at the scroll limit: the row cannot be brought closer, and
				// retrying every frame would nudge-and-render forever.
				if (Math.abs(scroller.scrollTop - before) < 0.5) {
					pendingScrollIndex = null;
					return;
				}
			}
			// In place (or just adjusted): keep watching until the budget runs out —
			// the selection render and refetch shift rows AFTER first convergence.
			next();
		};

		const releasePin = () => {
			pendingScrollIndex = null;
		};

		const instance: NavInstance = {
			getScroller: () => scrollerRef.current,
			containsActive: () => {
				const { flatRows: rows, activeAlertId: id } = latest.current;
				return id !== null && rows.some((r) => r.type === 'leaf' && r.alert.id === id);
			},
			navigate: (delta) => {
				const { flatRows: rows, activeAlertId: id, onAlertClick: open, virtualizer: v } = latest.current;
				if (!open) return;
				const alertRowIndices = rows.flatMap((r, i) => (r.type === 'leaf' ? [i] : []));
				if (alertRowIndices.length === 0) return;
				const currentPos =
					id === null ? -1 : alertRowIndices.findIndex((i) => (rows[i] as { alert: Alert }).alert.id === id);
				const nextPos =
					currentPos === -1
						? delta === 1
							? 0
							: alertRowIndices.length - 1
						: Math.min(Math.max(currentPos + delta, 0), alertRowIndices.length - 1);
				const rowIndex = alertRowIndices[nextPos];
				const alert = (rows[rowIndex] as { alert: Alert }).alert;
				v.scrollToIndex(rowIndex, { align: 'auto' });
				const wasPinned = pendingScrollIndex !== null;
				pendingScrollIndex = rowIndex;
				pendingAlertId = alert.id;
				// One pin loop at a time: retargeting an already-running loop must not
				// stack a second rAF chain on top of it. (The running loop keeps its own
				// attempt count — retargeting mid-flight is fine, the budget just isn't
				// reset, and the next keypress starts fresh anyway.)
				if (!wasPinned) requestAnimationFrame(() => pinTargetVisible(0));
				// Guarded: onAlertClick TOGGLES on a repeated id, so calling it at a list
				// boundary (where the step clamps in place) would close the sidebar.
				if (alert.id !== id) open(alert);
			},
		};
		instances.add(instance);
		if (instances.size === 1) window.addEventListener('keydown', handleWindowKeyDown);
		// Any manual scroll gesture releases the pin — it must never fight the user.
		// Window-level (not scroller-level): the scroller node is remounted on tab
		// switches and empty-state flips, and a listener bound to a dead node is gone.
		window.addEventListener('wheel', releasePin, { passive: true });
		window.addEventListener('touchstart', releasePin, { passive: true });
		window.addEventListener('mousedown', releasePin);
		return () => {
			// Ends the pin loop: its next frame sees null and exits.
			pendingScrollIndex = null;
			window.removeEventListener('wheel', releasePin);
			window.removeEventListener('touchstart', releasePin);
			window.removeEventListener('mousedown', releasePin);
			instances.delete(instance);
			if (instances.size === 0) window.removeEventListener('keydown', handleWindowKeyDown);
		};
	}, [scrollerRef]);
};
