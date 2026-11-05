import { FlatGroupItem } from '../AlertsTable.types';
import { GROUP_SELECTION_LABELS } from './GroupHeader.constants';

type GroupItem = Extract<FlatGroupItem, { type: 'group' }>;

// "Status" for the field (its column label, else the field name) and "Status: firing" for the group.
export const groupLabels = (
	item: GroupItem,
	columnLabels: Record<string, string>,
	defaults: Record<string, string>
) => {
	const fieldLabel = columnLabels[item.field] || defaults[item.field] || item.field;
	return { fieldLabel, groupLabel: `${fieldLabel}: ${item.value}` };
};

// Grouped views may hold only a page of a group's alerts while its count is the server's
// full total: the checkbox then stands for the loaded alerts, and says so.
export const isPartiallyLoaded = (item: GroupItem): boolean => item.members.length < item.count;

// What the count badge shows: the full count, or loaded/total when only a page is here.
export const groupCountLabel = (item: GroupItem): string =>
	isPartiallyLoaded(item) ? `${item.members.length}/${item.count}` : String(item.count);

export interface GroupCheckboxText {
	labels: Record<'select' | 'unselect', string>;
	title?: string;
}

export const groupCheckboxText = (item: GroupItem, groupLabel: string): GroupCheckboxText => {
	if (!isPartiallyLoaded(item)) {
		return {
			labels: {
				select: GROUP_SELECTION_LABELS.select(groupLabel),
				unselect: GROUP_SELECTION_LABELS.unselect(groupLabel),
			},
		};
	}
	const loaded = item.members.length;
	return {
		labels: {
			select: GROUP_SELECTION_LABELS.selectLoaded(groupLabel, loaded, item.count),
			unselect: GROUP_SELECTION_LABELS.unselectLoaded(groupLabel, loaded, item.count),
		},
		title: GROUP_SELECTION_LABELS.partialHint(loaded, item.count),
	};
};
