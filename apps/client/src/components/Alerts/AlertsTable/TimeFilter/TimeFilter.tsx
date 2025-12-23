import { Button } from '@/components/ui/button';
import { ClearButton } from '@/components/ui/clear-button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { useCallback, useState } from 'react';
import { CustomTimeFilterTab } from './CustomTimeFilterTab';
import { QuickTimeFilterTab } from './QuickTimeFilterTab';
import { getPresetConfig } from './TimeFilter.constants';
import { QuickPreset, TimeFilterProps, TimeRange } from './TimeFilter.types';
import { formatTimeRange, isTimeRangeEmpty } from './TimeFilter.utils';

export const TimeFilter = ({ value, onChange }: TimeFilterProps) => {
	const [open, setOpen] = useState(false);

	const handlePresetClick = useCallback(
		(preset: QuickPreset) => {
			const config = getPresetConfig(preset);
			if (config) {
				const { from, to } = config.getRange();
				onChange({ from, to, preset });
				setOpen(false);
			}
		},
		[onChange]
	);

	const handleApplyCustom = useCallback(
		(range: TimeRange) => {
			onChange(range);
			setOpen(false);
		},
		[onChange]
	);

	const handleClear = useCallback(
		(e?: React.MouseEvent) => {
			if (e) {
				e.stopPropagation();
			}
			onChange({ from: null, to: null, preset: null });
		},
		[onChange]
	);

	const displayText = formatTimeRange(value);
	const hasValue = !isTimeRangeEmpty(value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						'h-8 gap-2 text-xs font-semibold w-auto items-center rounded-full',
						hasValue && 'border-primary text-primary'
					)}
				>
					<Clock className="h-4 w-4 flex-shrink-0" />
					<span className="whitespace-nowrap">{displayText}</span>
					{hasValue && (
						<ClearButton
							onClear={handleClear}
							className="h-auto w-auto inline-flex items-center justify-center"
						/>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[353px] p-0" align="end" side="bottom" sideOffset={4}>
				<Tabs defaultValue="quick" className="w-full">
					<TabsList className="w-full grid grid-cols-2 h-9 rounded-b-none">
						<TabsTrigger value="quick" className="text-xs">
							Quick
						</TabsTrigger>
						<TabsTrigger value="custom" className="text-xs">
							Custom
						</TabsTrigger>
					</TabsList>

					<TabsContent value="quick" className="mt-0 p-3">
						<QuickTimeFilterTab value={value} onPresetClick={handlePresetClick} />
					</TabsContent>

					<TabsContent value="custom" className="mt-0 p-3">
						<CustomTimeFilterTab value={value} onApply={handleApplyCustom} onClear={handleClear} />
					</TabsContent>
				</Tabs>
			</PopoverContent>
		</Popover>
	);
};
