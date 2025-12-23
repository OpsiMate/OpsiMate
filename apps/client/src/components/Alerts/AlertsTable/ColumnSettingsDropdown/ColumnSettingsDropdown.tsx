import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';
import { Columns3, Search, X } from 'lucide-react';
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
	const [searchQuery, setSearchQuery] = useState('');

	const availableColumns = Object.entries(columnLabels).filter(([key]) => !excludeColumns.includes(key));

	// Filter columns based on search query
	const filteredColumns = availableColumns.filter(([, label]) =>
		label.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const filteredTagKeys = tagKeys.filter((tagKey) =>
		tagKey.label.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const totalItems = filteredColumns.length + filteredTagKeys.length;

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
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>{TOGGLE_COLUMNS_LABEL}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				
				{/* Search Input */}
				<div className="px-2 pb-2">
					<div className="relative">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
						<Input
							placeholder="Search columns..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-7 pr-7 h-7 text-xs"
							onKeyDown={(e) => e.stopPropagation()}
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				</div>

				{/* Scrollable Column List */}
				<div className={totalItems > 10 ? 'max-h-[280px] overflow-y-auto' : ''}>
					{filteredColumns.map(([key, label]) => (
						<DropdownMenuCheckboxItem
							key={key}
							checked={visibleColumns.includes(key)}
							onCheckedChange={() => onColumnToggle(key)}
							onSelect={(e) => e.preventDefault()}
						>
							{label}
							</DropdownMenuCheckboxItem>
					))}
					{filteredTagKeys.length > 0 && (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuLabel>{ALERT_TAGS_LABEL}</DropdownMenuLabel>
							{filteredTagKeys.map((tagKey) => {
								const columnId = getTagKeyColumnId(tagKey.key);
								return (
									<DropdownMenuCheckboxItem
										key={columnId}
										checked={visibleColumns.includes(columnId)}
										onCheckedChange={() => onColumnToggle(columnId)}
										onSelect={(e) => e.preventDefault()}
									>
										{tagKey.label}
									</DropdownMenuCheckboxItem>
								);
							})}
						</>
					)}

					{/* No Results */}
					{totalItems === 0 && searchQuery && (
						<p className="text-xs text-muted-foreground text-center py-3 px-2">
							No columns match "{searchQuery}"
						</p>
					)}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
