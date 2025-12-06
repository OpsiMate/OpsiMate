import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { COLUMN_LABELS } from '../AlertsTable.constants';
import { FlatGroupItem } from '../AlertsTable.types';

interface StickyGroupHeaderProps {
	item: FlatGroupItem;
	onToggle: (key: string) => void;
	columnLabels?: Record<string, string>;
}

export const StickyGroupHeader = ({ item, onToggle, columnLabels = {} }: StickyGroupHeaderProps) => {
	if (item.type !== 'group') return null;

	const fieldLabel = columnLabels[item.field] || COLUMN_LABELS[item.field] || item.field;

	return (
		<div
			key={`sticky-${item.key}`}
			className="flex items-center h-8 border-b bg-muted/30 backdrop-blur-md hover:bg-muted/50 px-2 cursor-pointer"
			style={{
				paddingLeft: `${item.level * 24 + 8}px`,
			}}
			onClick={() => onToggle(item.key)}
		>
			<Button variant="ghost" size="icon" className="h-6 w-6 p-0 mr-2">
				{item.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
			</Button>
			<span className="font-medium text-sm mr-2 text-muted-foreground">{fieldLabel}:</span>
			<span className="font-medium text-sm mr-2">{item.value}</span>
			<Badge variant="secondary" className="h-5 px-1.5 text-xs rounded-sm">
				{item.count}
			</Badge>
		</div>
	);
};
