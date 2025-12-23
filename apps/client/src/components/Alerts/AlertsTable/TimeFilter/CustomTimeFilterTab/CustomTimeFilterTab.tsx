import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { TimeRange } from '../TimeFilter.types';

interface CustomTimeFilterTabProps {
	value: TimeRange;
	onApply: (range: TimeRange) => void;
	onClear: () => void;
}

export const CustomTimeFilterTab = ({ value, onApply, onClear }: CustomTimeFilterTabProps) => {
	const [customFrom, setCustomFrom] = useState<Date | undefined>(value.from ?? undefined);
	const [customTo, setCustomTo] = useState<Date | undefined>(value.to ?? undefined);
	const [fromTime, setFromTime] = useState('00:00');
	const [toTime, setToTime] = useState('23:59');
	const [fromCalendarOpen, setFromCalendarOpen] = useState(false);
	const [toCalendarOpen, setToCalendarOpen] = useState(false);

	const handleApply = () => {
		if (!customFrom || !customTo) return;

		const [fromHours, fromMins] = fromTime.split(':').map(Number);
		const [toHours, toMins] = toTime.split(':').map(Number);

		const from = new Date(customFrom);
		from.setHours(fromHours, fromMins, 0, 0);

		const to = new Date(customTo);
		to.setHours(toHours, toMins, 59, 999);

		onApply({ from, to, preset: 'custom' });
	};

	const handleClear = () => {
		setCustomFrom(undefined);
		setCustomTo(undefined);
		setFromTime('00:00');
		setToTime('23:59');
		onClear();
	};

	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<div className="space-y-1.5">
					<label className="text-xs font-medium text-muted-foreground">From</label>
					<div className="flex gap-1.5">
						<Popover open={fromCalendarOpen} onOpenChange={setFromCalendarOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-7 flex-1 justify-start text-xs font-normal"
								>
									<CalendarIcon className="h-3 w-3 mr-1.5" />
									{customFrom?.toLocaleDateString() || 'Pick date'}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={customFrom}
									onSelect={(date) => {
										setCustomFrom(date);
										setFromCalendarOpen(false);
									}}
									disabled={(date) => date > new Date()}
								/>
							</PopoverContent>
						</Popover>
						<Input
							type="time"
							value={fromTime}
							onChange={(e) => setFromTime(e.target.value)}
							className="h-7 w-20 text-xs px-2"
						/>
					</div>
				</div>
				<div className="space-y-1.5">
					<label className="text-xs font-medium text-muted-foreground">To</label>
					<div className="flex gap-1.5">
						<Popover open={toCalendarOpen} onOpenChange={setToCalendarOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-7 flex-1 justify-start text-xs font-normal"
								>
									<CalendarIcon className="h-3 w-3 mr-1.5" />
									{customTo?.toLocaleDateString() || 'Pick date'}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="single"
									selected={customTo}
									onSelect={(date) => {
										setCustomTo(date);
										setToCalendarOpen(false);
									}}
									disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
								/>
							</PopoverContent>
						</Popover>
						<Input
							type="time"
							value={toTime}
							onChange={(e) => setToTime(e.target.value)}
							className="h-7 w-20 text-xs px-2"
						/>
					</div>
				</div>
			</div>
			<div className="flex justify-end gap-2">
				<Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClear}>
					Clear
				</Button>
				<Button size="sm" className="h-7 text-xs" onClick={handleApply} disabled={!customFrom || !customTo}>
					Apply
				</Button>
			</div>
		</div>
	);
};
