import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tag } from '@OpsiMate/shared';
import { Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { TagsFilter } from './TagsFilter';

interface DashboardsFilterProps {
	searchTerm: string;
	onSearchChange: (value: string) => void;
	availableTags: Tag[];
	selectedTagIds: number[];
	onTagToggle: (tagId: number) => void;
	onClearTagFilters: () => void;
	onCreateDashboard: () => void;
}

export const DashboardsFilter = ({
	searchTerm,
	onSearchChange,
	availableTags,
	selectedTagIds,
	onTagToggle,
	onClearTagFilters,
	onCreateDashboard,
}: DashboardsFilterProps) => {
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	return (
		<div className="flex items-center gap-4 mb-4">
			<TagsFilter
				availableTags={availableTags}
				selectedTagIds={selectedTagIds}
				onTagToggle={onTagToggle}
				onClearAll={onClearTagFilters}
			/>

			<div
				className={cn(
					'relative transition-all duration-300 ease-in-out',
					isSearchFocused || searchTerm ? 'w-96' : 'w-64'
				)}
			>
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search dashboards..."
					value={searchTerm}
					onChange={(e) => onSearchChange(e.target.value)}
					onFocus={() => setIsSearchFocused(true)}
					onBlur={() => setIsSearchFocused(false)}
					className="pl-10 pr-10"
				/>
				{searchTerm && (
					<Button
						variant="ghost"
						size="icon"
						className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
						onClick={() => onSearchChange('')}
					>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>

			<div className="flex-1" />

			<Button onClick={onCreateDashboard} className="gap-2">
				<Plus className="h-4 w-4" />
				New Dashboard
			</Button>
		</div>
	);
};
