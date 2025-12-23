import { Button } from '@/components/ui/button';
import { PRESET_COLUMNS, QUICK_PRESETS } from '../TimeFilter.constants';
import { QuickPreset, TimeRange } from '../TimeFilter.types';

interface QuickTimeFilterTabProps {
	value: TimeRange;
	onPresetClick: (preset: QuickPreset) => void;
}

export const QuickTimeFilterTab = ({ value, onPresetClick }: QuickTimeFilterTabProps) => {
	return (
		<div className="flex gap-3">
			{PRESET_COLUMNS.map((column, colIdx) => (
				<div key={colIdx} className="flex flex-col gap-1">
					{column.map((presetValue) => {
						const preset = QUICK_PRESETS.find((p) => p.value === presetValue);
						if (!preset) return null;
						return (
							<Button
								key={preset.value}
								variant={value.preset === preset.value ? 'default' : 'ghost'}
								size="sm"
								className="h-7 justify-center text-xs font-normal px-3"
								onClick={() => onPresetClick(preset.value)}
							>
								{preset.label}
							</Button>
						);
					})}
				</div>
			))}
		</div>
	);
};
