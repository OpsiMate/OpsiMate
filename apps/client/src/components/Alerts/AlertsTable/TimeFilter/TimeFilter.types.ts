export type QuickPreset =
	| 'last1m'
	| 'last2m'
	| 'last5m'
	| 'last15m'
	| 'last30m'
	| 'last1h'
	| 'last2h'
	| 'last6h'
	| 'last12h'
	| 'last24h'
	| 'today'
	| 'last2d'
	| 'last3d'
	| 'last5d'
	| 'last7d';

export interface PresetConfig {
	label: string;
	value: QuickPreset;
	getRange: () => { from: Date; to: Date };
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
