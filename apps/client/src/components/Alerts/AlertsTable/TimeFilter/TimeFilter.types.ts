import type { QuickPresetWindow, QuickTimePreset } from '@OpsiMate/shared';

// The preset names live in shared with their labels and window lengths, so the server
// resolves a saved dashboard's preset exactly as this filter does.
export type QuickPreset = QuickTimePreset;

export interface PresetConfig {
	label: string;
	value: QuickPreset;
	getRange: () => QuickPresetWindow;
}

export interface TimeRange {
	from: Date | null;
	to: Date | null;
	preset: QuickPreset | 'custom' | null;
}

export interface TimeFilterProps {
	value: TimeRange;
	onChange: (range: TimeRange) => void;
}
