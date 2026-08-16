import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAiFilter, useAiStatus } from '@/hooks/queries/ai';
import { AiFilterResult } from '@OpsiMate/shared';
import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

export interface AiFilterPopoverProps {
	// Receives the validated result; the parent owns applying it to dashboard state.
	onApply: (result: AiFilterResult) => void;
}

// "Describe what you want to see" → the server translates it into the dashboard's own
// filter record (validated against the live vocabulary) and the parent applies it as
// ordinary filter chips + search + time range. The result is always visible, editable
// state — never a hidden query — so a wrong interpretation is one chip-click to fix.
// Hidden entirely until an admin enables AI in Settings.
export const AiFilterPopover = ({ onApply }: AiFilterPopoverProps) => {
	const { data: status } = useAiStatus();
	const filterMutation = useAiFilter();
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');

	if (!status?.enabled) return null;

	const submit = async () => {
		const trimmed = query.trim();
		// The Enter-key path bypasses the disabled button — guard here too.
		if (trimmed.length < 2 || filterMutation.isPending) return;
		try {
			const result = await filterMutation.mutateAsync(trimmed);
			onApply(result);
			toast({ title: 'Filters applied', description: result.explanation });
			setOpen(false);
			setQuery('');
		} catch (e) {
			toast({ title: 'Could not translate that', description: (e as Error).message, variant: 'destructive' });
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="gap-1.5 shrink-0"
					title="Describe a filter in plain words"
				>
					<Sparkles className="h-4 w-4" />
					<span className="hidden lg:inline">Ask AI</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-96 space-y-2">
				<p className="text-sm font-medium">Describe what you want to see</p>
				<Textarea
					autoFocus
					rows={2}
					placeholder='e.g. "critical prod alerts nobody owns from the last hour"'
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							void submit();
						}
					}}
				/>
				<div className="flex items-center justify-between gap-2">
					<p className="text-[11px] text-muted-foreground">
						Only filter names and values are sent — no alert content.
					</p>
					<Button
						size="sm"
						onClick={() => void submit()}
						disabled={filterMutation.isPending || query.trim().length < 2}
					>
						{filterMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
};
