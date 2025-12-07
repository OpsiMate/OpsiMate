import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export interface SearchBarProps {
	searchTerm: string;
	onSearchChange: (searchTerm: string) => void;
}

export const SearchBar = ({ searchTerm, onSearchChange }: SearchBarProps) => {
	return (
		<div className="relative flex-1 max-w-sm">
			<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
			<Input
				placeholder="Search alerts..."
				value={searchTerm}
				onChange={(e) => onSearchChange(e.target.value)}
				className="h-7 pl-7 pr-2 text-sm"
			/>
		</div>
	);
};
