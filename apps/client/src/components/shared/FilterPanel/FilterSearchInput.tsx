import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

interface FilterSearchInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export const FilterSearchInput = ({ value, onChange, placeholder = 'Search filters...' }: FilterSearchInputProps) => {
	return (
		<div className="px-3 py-2 border-b border-border">
			<div className="relative">
				<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
				<Input
					placeholder={placeholder}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className="pl-8 pr-8 h-7 text-xs"
				/>
				{value && (
					<button
						onClick={() => onChange('')}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
		</div>
	);
};
