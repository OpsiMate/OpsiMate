import { FlatGroupItem } from '../AlertsTable.types';
import { GroupHeader } from '../GroupHeader/GroupHeader';

interface StickyGroupHeaderProps {
	item: FlatGroupItem;
	onToggle: (key: string) => void;
	columnLabels?: Record<string, string>;
}

export const StickyGroupHeader = ({ item, onToggle, columnLabels = {} }: StickyGroupHeaderProps) => (
	<GroupHeader item={item} onToggle={onToggle} columnLabels={columnLabels} />
);
