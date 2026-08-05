import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { ACTIONS_COLUMN, COLUMN_MIN_WIDTHS } from '../AlertsTable.constants';

// Content-aware sizing for the text columns whose values vary wildly (alert name and
// tag columns): each gets the width its longest visible value needs — so nothing
// truncates while free space exists — but no more, so short content doesn't balloon
// a column into whitespace. CSS can't do this here: the header and every virtualized
// row are separate layout-fixed tables, so auto layout would size each independently
// and misalign them; instead we measure the strings and hand both sides one pixel
// width per column.

// Cell horizontal padding (px-2 both sides).
const CELL_PADDING_PX = 16;
// Tag values render inside a badge: its padding, border and radius chrome.
const BADGE_CHROME_PX = 30;
// Header labels sit next to a sort icon and its gap.
const HEADER_CHROME_PX = 34;
// Growth caps: a single absurdly long value shouldn't claim half the screen — beyond
// the cap the value truncates (full text stays in the hover tooltip).
const MAX_ALERT_NAME_PX = 460;
const MAX_TAG_PX = 480;
// Shrink floors when space is tight; below the summed floors the table itself scrolls
// horizontally (tableMinWidth), so columns never crush further.
const MIN_ALERT_NAME_PX = 170;
const MIN_TAG_PX = 110;

// Distribute available width over columns that each want `desired` px but can shrink
// to `floors` px. If everything fits, everyone gets what they want; otherwise columns
// give up space proportionally to how much slack (desired - floor) they have.
export const distributeWidths = (
	desired: Record<string, number>,
	floors: Record<string, number>,
	available: number
): Record<string, number> => {
	const total = Object.values(desired).reduce((sum, w) => sum + w, 0);
	if (total <= available) {
		return desired;
	}
	const overflow = total - available;
	const reducible = Object.keys(desired).reduce(
		(sum, col) => sum + Math.max(0, desired[col] - (floors[col] ?? 0)),
		0
	);
	if (reducible <= 0 || overflow >= reducible) {
		return Object.fromEntries(Object.keys(desired).map((col) => [col, floors[col] ?? desired[col]]));
	}
	const scale = overflow / reducible;
	return Object.fromEntries(
		Object.keys(desired).map((col) => {
			const floor = floors[col] ?? 0;
			return [col, Math.round(desired[col] - (desired[col] - floor) * scale)];
		})
	);
};

// Shared canvas context for text measurement (never attached to the DOM).
let measureContext: CanvasRenderingContext2D | null = null;
const measureText = (text: string, font: string): number => {
	if (!measureContext) {
		measureContext = document.createElement('canvas').getContext('2d');
	}
	if (!measureContext) {
		return 0;
	}
	measureContext.font = font;
	return Math.ceil(measureContext.measureText(text).width);
};

interface UseContentColumnWidthsOptions {
	alerts: Alert[];
	orderedColumns: string[];
	// Labels for header cells (a tag column's header can be wider than its values).
	columnLabels: Record<string, string>;
	// Width of the table's scroll container; 0 before the first measurement, which
	// disables dynamic sizing (columns fall back to their static classes).
	containerWidth: number;
	hasSelectColumn: boolean;
	actionsColumnWidthPx: number;
}

// Pixel widths for the content-sized columns (alertName + tag columns), or an empty
// map when dynamic sizing can't run yet. Fixed icon/date columns keep their static
// classes; summary (when visible) and the filler column absorb whatever remains.
export const useContentColumnWidths = ({
	alerts,
	orderedColumns,
	columnLabels,
	containerWidth,
	hasSelectColumn,
	actionsColumnWidthPx,
}: UseContentColumnWidthsOptions): Record<string, number> => {
	return useMemo(() => {
		if (!containerWidth) {
			return {};
		}
		const contentColumns = orderedColumns.filter((col) => col === 'alertName' || isTagKeyColumn(col));
		if (contentColumns.length === 0) {
			return {};
		}

		// Measure at the heaviest weight: unread rows render font-black (900), and a column
		// sized for the regular weight would truncate exactly the rows that must stand out.
		const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
		const font = `900 14px ${fontFamily}`;

		const desired: Record<string, number> = {};
		const floors: Record<string, number> = {};
		for (const col of contentColumns) {
			const headerWidth = measureText(columnLabels[col] ?? col, font) + HEADER_CHROME_PX;
			if (col === 'alertName') {
				const content = alerts.reduce(
					(max, alert) => Math.max(max, measureText(alert.alertName ?? '', font)),
					0
				);
				desired[col] = Math.min(
					Math.max(content + CELL_PADDING_PX, headerWidth, MIN_ALERT_NAME_PX),
					MAX_ALERT_NAME_PX
				);
				floors[col] = MIN_ALERT_NAME_PX;
			} else {
				const tagKey = extractTagKeyFromColumnId(col);
				const content = alerts.reduce(
					(max, alert) => Math.max(max, measureText((tagKey && alert.tags?.[tagKey]) || '', font)),
					0
				);
				desired[col] = Math.min(
					Math.max(content + BADGE_CHROME_PX + CELL_PADDING_PX, headerWidth, MIN_TAG_PX),
					MAX_TAG_PX
				);
				floors[col] = MIN_TAG_PX;
			}
		}

		// Space the fixed columns claim; summary (when visible) keeps at least its
		// minimum — anything the content columns leave over flows to it (or, without
		// summary, to the filler column).
		let claimed = hasSelectColumn ? 40 : 0;
		for (const col of orderedColumns) {
			if (contentColumns.includes(col)) continue;
			if (col === ACTIONS_COLUMN) {
				claimed += actionsColumnWidthPx;
			} else {
				claimed += COLUMN_MIN_WIDTHS[col] ?? COLUMN_MIN_WIDTHS.default;
			}
		}
		return distributeWidths(desired, floors, containerWidth - claimed);
	}, [alerts, orderedColumns, columnLabels, containerWidth, hasSelectColumn, actionsColumnWidthPx]);
};
