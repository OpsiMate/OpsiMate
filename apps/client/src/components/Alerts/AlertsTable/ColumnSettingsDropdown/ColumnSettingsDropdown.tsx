import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';
import { Columns3 } from 'lucide-react';
import { ALERT_TAGS_LABEL, TOGGLE_COLUMNS_LABEL } from './ColumnSettingsDropdown.constants';

export interface ColumnSettingsDropdownProps {
	visibleColumns: string[];
	onColumnToggle: (column: string) => void;
	columnLabels: Record<string, string>;
	excludeColumns?: string[];
	tagKeys?: TagKeyInfo[];
}

export const ColumnSettingsDropdown = ({
	visibleColumns,
	onColumnToggle,
	columnLabels,
	excludeColumns = [],
	tagKeys = [],
}: ColumnSettingsDropdownProps) => {
	const availableColumns = Object.entries(columnLabels).filter(([key]) => !excludeColumns.includes(key));

	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="icon" className="h-8 w-8">
							<Columns3 className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent>{TOGGLE_COLUMNS_LABEL}</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>{TOGGLE_COLUMNS_LABEL}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{availableColumns.map(([key, label]) => (
					<DropdownMenuCheckboxItem
						key={key}
						checked={visibleColumns.includes(key)}
						onCheckedChange={() => onColumnToggle(key)}
					>
						{label}
					</DropdownMenuCheckboxItem>
				))}
				{tagKeys.length > 0 && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>{ALERT_TAGS_LABEL}</DropdownMenuLabel>
						{tagKeys.map((tagKey) => {
							const columnId = getTagKeyColumnId(tagKey.key);
							return (
								<DropdownMenuCheckboxItem
									key={columnId}
									checked={visibleColumns.includes(columnId)}
									onCheckedChange={() => onColumnToggle(columnId)}
								>
									{tagKey.label}
								</DropdownMenuCheckboxItem>
							);
						})}
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
