import { PresetConfig, QuickPreset } from './TimeFilter.types';

const minutes = (n: number) => n * 60 * 1000;
const hours = (n: number) => n * 60 * 60 * 1000;
const days = (n: number) => n * 24 * 60 * 60 * 1000;

const startOfToday = (): Date => {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export const QUICK_PRESETS: PresetConfig[] = [
	{
		label: 'Last 1 minute',
		value: 'last1m',
		getRange: () => ({ from: new Date(Date.now() - minutes(1)), to: new Date() }),
	},
	{
		label: 'Last 2 minutes',
		value: 'last2m',
		getRange: () => ({ from: new Date(Date.now() - minutes(2)), to: new Date() }),
	},
	{
		label: 'Last 5 minutes',
		value: 'last5m',
		getRange: () => ({ from: new Date(Date.now() - minutes(5)), to: new Date() }),
	},
	{
		label: 'Last 15 minutes',
		value: 'last15m',
		getRange: () => ({ from: new Date(Date.now() - minutes(15)), to: new Date() }),
	},
	{
		label: 'Last 30 minutes',
		value: 'last30m',
		getRange: () => ({ from: new Date(Date.now() - minutes(30)), to: new Date() }),
	},
	{
		label: 'Last 1 hour',
		value: 'last1h',
		getRange: () => ({ from: new Date(Date.now() - hours(1)), to: new Date() }),
	},
	{
		label: 'Last 2 hours',
		value: 'last2h',
		getRange: () => ({ from: new Date(Date.now() - hours(2)), to: new Date() }),
	},
	{
		label: 'Last 6 hours',
		value: 'last6h',
		getRange: () => ({ from: new Date(Date.now() - hours(6)), to: new Date() }),
	},
	{
		label: 'Last 12 hours',
		value: 'last12h',
		getRange: () => ({ from: new Date(Date.now() - hours(12)), to: new Date() }),
	},
	{
		label: 'Last 24 hours',
		value: 'last24h',
		getRange: () => ({ from: new Date(Date.now() - hours(24)), to: new Date() }),
	},
	{ label: 'Today', value: 'today', getRange: () => ({ from: startOfToday(), to: new Date() }) },
	{
		label: 'Last 2 days',
		value: 'last2d',
		getRange: () => ({ from: new Date(Date.now() - days(2)), to: new Date() }),
	},
	{
		label: 'Last 3 days',
		value: 'last3d',
		getRange: () => ({ from: new Date(Date.now() - days(3)), to: new Date() }),
	},
	{
		label: 'Last 5 days',
		value: 'last5d',
		getRange: () => ({ from: new Date(Date.now() - days(5)), to: new Date() }),
	},
	{
		label: 'Last 7 days',
		value: 'last7d',
		getRange: () => ({ from: new Date(Date.now() - days(7)), to: new Date() }),
	},
];

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
