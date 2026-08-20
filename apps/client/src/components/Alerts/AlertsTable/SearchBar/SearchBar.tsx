import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAiFilter, useAiStatus } from '@/hooks/queries/ai';
import { cn } from '@/lib/utils';
import { AiFilterResult } from '@OpsiMate/shared';
import { Loader2, Search, Sparkle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface SearchBarProps {
	searchTerm: string;
	onSearchChange: (searchTerm: string) => void;
	onAiFilter?: (result: AiFilterResult) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

export const SearchBar = ({ searchTerm, onSearchChange, onAiFilter }: SearchBarProps) => {
	const [value, setValue] = useState(searchTerm);
	const [aiMode, setAiMode] = useState(false);
	const [aiQuery, setAiQuery] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const { data: status } = useAiStatus();
	const filterMutation = useAiFilter();
	const { toast } = useToast();

	const aiEnabled = !!status?.enabled && !!onAiFilter;

	const onSearchChangeRef = useRef(onSearchChange);
	onSearchChangeRef.current = onSearchChange;

	useEffect(() => {
		setValue(searchTerm);
	}, [searchTerm]);

	useEffect(() => {
		if (aiMode) return;
		if (value === searchTerm) return;
		const timer = setTimeout(() => onSearchChangeRef.current(value), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [value, searchTerm, aiMode]);

	const isActive = aiMode ? aiQuery.trim().length > 0 : value.trim().length > 0;

	const clearSearch = () => {
		if (aiMode) {
			setAiQuery('');
		} else {
			setValue('');
			onSearchChangeRef.current('');
		}
	};

	const toggleAiMode = () => {
		if (aiMode) {
			setAiMode(false);
			setAiQuery('');
		} else {
			setAiMode(true);
			setAiQuery('');
		}
		setTimeout(() => inputRef.current?.focus(), 0);
	};

	const submitAiQuery = async () => {
		const trimmed = aiQuery.trim();
		if (trimmed.length < 2 || filterMutation.isPending || !onAiFilter) return;
		try {
			const result = await filterMutation.mutateAsync(trimmed);
			onAiFilter(result);
			toast({ title: 'Filters applied', description: result.explanation });
			setAiMode(false);
			setAiQuery('');
		} catch (e) {
			toast({ title: 'Could not translate that', description: (e as Error).message, variant: 'destructive' });
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (aiMode && e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void submitAiQuery();
		}
	};

	return (
		<div className="relative flex-1 max-w-md">
			<div
				className={cn(
					'flex items-center rounded-md border transition-colors',
					aiMode
						? 'border-violet-400/70 bg-violet-50/50 dark:bg-violet-950/20 ring-1 ring-violet-400/30'
						: isActive
							? 'border-primary/60 bg-primary/5'
							: 'border-input bg-transparent',
					'focus-within:ring-1',
					!aiMode && 'focus-within:ring-ring'
				)}
			>
				{aiMode ? (
					<Sparkle className="ml-2 h-3.5 w-3.5 shrink-0 text-violet-500" />
				) : (
					<Search
						className={cn(
							'ml-2 h-3 w-3 shrink-0',
							isActive ? 'text-primary' : 'text-muted-foreground'
						)}
					/>
				)}

				<input
					ref={inputRef}
					type="text"
					placeholder={aiMode ? 'Describe what you want to see...' : 'Search alerts...'}
					value={aiMode ? aiQuery : value}
					onChange={(e) => aiMode ? setAiQuery(e.target.value) : setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					className={cn(
						'flex-1 h-7 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground',
						aiMode && 'placeholder:text-violet-400/70'
					)}
				/>

				{isActive && !filterMutation.isPending && (
					<button
						type="button"
						onClick={clearSearch}
						aria-label="Clear"
						className="mr-1 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				)}

				{aiMode && filterMutation.isPending && (
					<Loader2 className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin text-violet-500" />
				)}

				{aiMode && !filterMutation.isPending && aiQuery.trim().length >= 2 && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => void submitAiQuery()}
						className="mr-0.5 h-5 px-1.5 text-[11px] font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-100/60 dark:text-violet-400 dark:hover:bg-violet-900/30"
					>
						Apply
					</Button>
				)}

				{aiEnabled && (
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={toggleAiMode}
								aria-label={aiMode ? 'Switch to regular search' : 'Switch to AI search'}
								className={cn(
									'mr-1 rounded-sm p-1 transition-colors',
									aiMode
										? 'text-violet-500 bg-violet-100/60 dark:bg-violet-900/40 hover:bg-violet-200/60'
										: 'text-muted-foreground hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/30'
								)}
							>
								{aiMode ? (
									<Search className="h-3.5 w-3.5" />
								) : (
									<Sparkle className="h-3.5 w-3.5" />
								)}
							</button>
						</TooltipTrigger>
						<TooltipContent>
							{aiMode ? 'Back to search' : 'Ask AI to filter'}
						</TooltipContent>
					</Tooltip>
				)}
			</div>

			{aiMode && (
				<p className="absolute -bottom-4 left-0 text-[10px] text-muted-foreground">
					Only filter names and values are sent — no alert content.
				</p>
			)}
		</div>
	);
};
