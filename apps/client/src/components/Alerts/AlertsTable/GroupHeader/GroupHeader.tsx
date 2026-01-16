import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { COLUMN_LABELS } from '../AlertsTable.constants';
import { FlatGroupItem, GroupStatus } from '../AlertsTable.types';

interface GroupHeaderProps {
	item: FlatGroupItem;
	onToggle: (key: string) => void;
	columnLabels?: Record<string, string>;
}

const getStatusBadgeVariant = (status: GroupStatus): 'destructive' | 'success' | 'muted' => {
	switch (status) {
		case 'firing':
			return 'destructive';
		case 'resolved':
			return 'success';
		case 'dismissed':
			return 'muted';
	}
};

export const GroupHeader = ({ item, onToggle, columnLabels = {} }: GroupHeaderProps) => {
	if (item.type !== 'group') return null;

	const fieldLabel = columnLabels[item.field] || COLUMN_LABELS[item.field] || item.field;
	const badgeVariant = getStatusBadgeVariant(item.groupStatus);

	return (
		<div
			className="flex items-center h-8 border-b bg-muted/50 hover:bg-muted/70 px-2 cursor-pointer"
			style={{ paddingLeft: `${item.level * 24 + 8}px` }}
			onClick={() => onToggle(item.key)}
		>
			<Button variant="ghost" size="icon" className="h-6 w-6 p-0 mr-2 text-foreground">
				{item.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
			</Button>
			<span className="font-semibold text-sm mr-2 text-foreground">{fieldLabel}:</span>
			<span className="text-sm mr-2 text-foreground/80">{item.value}</span>
			<Badge variant={badgeVariant} className="h-5 px-1.5 text-xs rounded-sm">
				{item.count}
			</Badge>
		</div>
	);
};
