import { useMemo } from 'react';
import { VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import { FlatGroupItem } from '../AlertsTable.types';

interface UseStickyHeadersProps {
	flatRows: FlatGroupItem[];
	groupByColumns: string[];
	virtualItems: VirtualItem[];
	virtualizer: Virtualizer<HTMLDivElement, Element>;
}

export const useStickyHeaders = ({ flatRows, groupByColumns, virtualItems, virtualizer }: UseStickyHeadersProps) => {
	return useMemo(() => {
		if (groupByColumns.length === 0 || flatRows.length === 0 || virtualItems.length === 0) {
			return [];
		}

		const currentScroll = virtualizer.scrollOffset || 0;
		const topVisibleItem = virtualItems.find((item) => item.start + item.size > currentScroll);

		const anchorIndex = topVisibleItem ? topVisibleItem.index : virtualItems[0].index;

		const activeHeaders = new Map<number, FlatGroupItem>();

		for (let i = anchorIndex; i >= 0; i--) {
			const item = flatRows[i];
			if (item.type === 'group') {
				if (!activeHeaders.has(item.level)) {
					activeHeaders.set(item.level, item);
				}
				if (item.level === 0) break;
			}
		}

		return Array.from(activeHeaders.values()).sort((a, b) => {
			if (a.type !== 'group' || b.type !== 'group') return 0;
			return a.level - b.level;
		});
	}, [virtualItems, flatRows, groupByColumns, virtualizer.scrollOffset]);
};
