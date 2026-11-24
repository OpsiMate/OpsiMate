import { MemberSelectionState } from '../AlertsTable.constants';
import { FlatGroupItem } from '../AlertsTable.types';
import { GroupHeader } from '../GroupHeader/GroupHeader';

interface StickyGroupHeaderProps {
	item: FlatGroupItem;
	onToggle: (key: string) => void;
	columnLabels?: Record<string, string>;
	// The pinned copy keeps the real header's checkbox, so it works while the row is scrolled off.
	selectionState?: MemberSelectionState;
	onToggleSelection?: () => void;
}

export const StickyGroupHeader = ({
	item,
	onToggle,
	columnLabels = {},
	selectionState,
	onToggleSelection,
}: StickyGroupHeaderProps) => (
	<GroupHeader
		item={item}
		onToggle={onToggle}
		columnLabels={columnLabels}
		selectionState={selectionState}
		onToggleSelection={onToggleSelection}
	/>
);
