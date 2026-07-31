import { getPresetConfig, getPresetLabel } from './TimeFilter.constants';
import { TimeRange } from './TimeFilter.types';

// Quick presets are stored as the preset alone (from/to null) and materialized here at
// FILTER time, so "Last 1 hour" / "Today" are rolling windows anchored to now — not
// snapshots of the moment the preset was clicked. Only 'custom' carries absolute dates.
export const resolveTimeRange = (range: TimeRange): { from: Date | null; to: Date | null } => {
	if (range.preset && range.preset !== 'custom') {
		const config = getPresetConfig(range.preset);
		if (config) return config.getRange();
	}
	return { from: range.from, to: range.to };
};

const formatDate = (date: Date): string => {
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	const hours = date.getHours().toString().padStart(2, '0');
	const mins = date.getMinutes().toString().padStart(2, '0');
	return `${month}/${day} ${hours}:${mins}`;
};

export const formatTimeRange = (range: TimeRange): string => {
	if (!range.from && !range.to && !range.preset) {
		return 'All time';
	}

	if (range.preset && range.preset !== 'custom') {
		return getPresetLabel(range.preset);
	}

	if (range.from && range.to) {
		return `${formatDate(range.from)} - ${formatDate(range.to)}`;
	}

	if (range.from) {
		return `From ${formatDate(range.from)}`;
	}

	if (range.to) {
		return `Until ${formatDate(range.to)}`;
	}

	return 'All time';
};

export const createEmptyTimeRange = (): TimeRange => ({
	from: null,
	to: null,
	preset: null,
});

export const isTimeRangeEmpty = (range: TimeRange): boolean => {
	return !range.from && !range.to && !range.preset;
};
