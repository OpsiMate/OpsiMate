import { MutePolicy } from './types';

export const isScheduleActiveNow = (schedule: NonNullable<MutePolicy['schedule']>, now: Date = new Date()): boolean => {
	const days = schedule.daysOfWeek ?? [];
	const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

	if (schedule.startTime <= schedule.endTime) {
		return days.includes(now.getDay()) && current >= schedule.startTime && current < schedule.endTime;
	}

	const yesterday = (now.getDay() + 6) % 7;

	return (
		(current >= schedule.startTime && days.includes(now.getDay())) ||
		(current < schedule.endTime && days.includes(yesterday))
	);
};
