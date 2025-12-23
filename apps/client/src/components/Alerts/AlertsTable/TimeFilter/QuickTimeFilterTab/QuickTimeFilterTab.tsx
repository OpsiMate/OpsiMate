import { Button } from '@/components/ui/button';
import { PRESET_COLUMNS, QUICK_PRESETS } from '../TimeFilter.constants';
import { QuickPreset, TimeRange } from '../TimeFilter.types';
import { BUTTON_CLASSES, COLUMN_CLASSES, CONTAINER_CLASSES } from './QuickTimeFilterTab.constants';

interface QuickTimeFilterTabProps {
	value: TimeRange;
	onPresetClick: (preset: QuickPreset) => void;
}

export const QuickTimeFilterTab = ({ value, onPresetClick }: QuickTimeFilterTabProps) => {
	return (
		<div className={CONTAINER_CLASSES}>
			{PRESET_COLUMNS.map((column, colIdx) => (
				<div key={colIdx} className={COLUMN_CLASSES}>
					{column.map((presetValue) => {
						const preset = QUICK_PRESETS.find((p) => p.value === presetValue);
						if (!preset) return null;
						return (
							<Button
								key={preset.value}
								variant={value.preset === preset.value ? 'default' : 'ghost'}
								size="sm"
								className={BUTTON_CLASSES}
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
