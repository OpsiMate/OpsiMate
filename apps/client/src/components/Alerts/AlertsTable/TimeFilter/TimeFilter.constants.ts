import { QUICK_TIME_PRESETS, resolveQuickPreset } from '@OpsiMate/shared';
import { PresetConfig, QuickPreset } from './TimeFilter.types';

// Labels and window lengths come from shared (one table for the browser and the server);
// getRange materializes the rolling window from "now" in the user's own time zone.
export const QUICK_PRESETS: PresetConfig[] = QUICK_TIME_PRESETS.map(({ value, label }) => ({
	label,
	value,
	getRange: () => resolveQuickPreset(value),
}));

export const PRESET_COLUMNS = [
	['last1m', 'last2m', 'last5m', 'last15m', 'last30m'],
	['last1h', 'last2h', 'last6h', 'last12h', 'last24h'],
	['today', 'last2d', 'last3d', 'last5d', 'last7d'],
] as const;

export const getPresetConfig = (preset: QuickPreset): PresetConfig | undefined => {
	return QUICK_PRESETS.find((p) => p.value === preset);
};

export const getPresetLabel = (preset: QuickPreset): string => {
	return getPresetConfig(preset)?.label || preset;
};
