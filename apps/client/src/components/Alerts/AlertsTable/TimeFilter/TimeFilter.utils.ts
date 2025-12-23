import { getPresetLabel } from './TimeFilter.constants';
import { TimeRange } from './TimeFilter.types';

export const formatTimeRange = (range: TimeRange): string => {
	if (!range.from && !range.to && !range.preset) {
		return 'All time';
	}

	if (range.preset && range.preset !== 'custom') {
		return getPresetLabel(range.preset);
	}

	if (range.from && range.to) {
		const formatDate = (date: Date) => {
			const month = (date.getMonth() + 1).toString().padStart(2, '0');
			const day = date.getDate().toString().padStart(2, '0');
			const hours = date.getHours().toString().padStart(2, '0');
			const mins = date.getMinutes().toString().padStart(2, '0');
			return `${month}/${day} ${hours}:${mins}`;
		};
		return `${formatDate(range.from)} - ${formatDate(range.to)}`;
	}

	if (range.from) {
		return `From ${range.from.toLocaleDateString()}`;
	}

	if (range.to) {
		return `Until ${range.to.toLocaleDateString()}`;
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
