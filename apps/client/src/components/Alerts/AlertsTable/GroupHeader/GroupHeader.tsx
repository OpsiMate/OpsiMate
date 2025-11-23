import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FlatGroupItem } from '../AlertsTable.types';
import { COLUMN_LABELS } from '../AlertsTable.constants';

interface GroupHeaderProps {
	item: FlatGroupItem;
	onToggle: (key: string) => void;
}

export const GroupHeader = ({ item, onToggle }: GroupHeaderProps) => {
	if (item.type !== 'group') return null;

	return (
		<div
			className="flex items-center h-8 border-b bg-muted/30 hover:bg-muted/50 px-2 cursor-pointer"
			style={{ paddingLeft: `${item.level * 24 + 8}px` }}
			onClick={() => onToggle(item.key)}
		>
			<Button variant="ghost" size="icon" className="h-6 w-6 p-0 mr-2">
				{item.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
			</Button>
			<span className="font-medium text-sm mr-2 text-muted-foreground">
				{COLUMN_LABELS[item.field] || item.field}:
			</span>
			<span className="font-medium text-sm mr-2">{item.value}</span>
			<Badge variant="secondary" className="h-5 px-1.5 text-xs rounded-sm">
				{item.count}
			</Badge>
		</div>
	);
};
