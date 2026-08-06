import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// react-day-picker v9+ renamed the entire classNames map (caption -> month_caption,
// head_row -> weekdays, cell -> day, day -> day_button, day_selected -> selected, ...)
// and replaced the IconLeft/IconRight component slots with a single Chevron slot —
// this wrapper targets that API (the pre-v9 shape silently styles nothing).
const Calendar = ({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) => {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn('p-3', className)}
			classNames={{
				months: 'relative flex flex-col sm:flex-row gap-4',
				month: 'space-y-4',
				month_caption: 'flex justify-center pt-1 relative items-center h-7',
				caption_label: 'text-sm font-medium',
				nav: 'absolute inset-x-1 top-1 z-10 flex items-center justify-between',
				button_previous: cn(
					buttonVariants({ variant: 'outline' }),
					'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
				),
				button_next: cn(
					buttonVariants({ variant: 'outline' }),
					'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
				),
				month_grid: 'w-full border-collapse space-y-1',
				weekdays: 'flex',
				weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
				week: 'flex w-full mt-2',
				day: 'h-9 w-9 rounded-md text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
				day_button: cn(buttonVariants({ variant: 'ghost' }), 'h-9 w-9 p-0 font-normal'),
				selected:
					'bg-primary text-primary-foreground rounded-md [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
				today: 'border border-primary',
				outside: 'text-muted-foreground opacity-50',
				disabled: 'text-muted-foreground opacity-50 [&>button]:pointer-events-none',
				range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
				hidden: 'invisible',
				...classNames,
			}}
			components={{
				Chevron: ({ orientation }) =>
					orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
			}}
			{...props}
		/>
	);
};
Calendar.displayName = 'Calendar';

export { Calendar };
