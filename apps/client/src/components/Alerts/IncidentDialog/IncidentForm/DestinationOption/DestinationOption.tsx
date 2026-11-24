import { cn } from '@/lib/utils';

// One of the three radio-style choices at the top of the incident form: new incident,
// existing incident, or remove from incidents.
interface DestinationOptionProps {
	selected: boolean;
	disabled?: boolean;
	title?: string;
	icon: React.ReactNode;
	label: string;
	onSelect: () => void;
}

export const DestinationOption = ({
	selected,
	disabled = false,
	title,
	icon,
	label,
	onSelect,
}: DestinationOptionProps) => (
	<button
		type="button"
		role="radio"
		aria-checked={selected}
		disabled={disabled}
		title={title}
		onClick={onSelect}
		className={cn(
			'flex items-center justify-center gap-1.5 whitespace-nowrap rounded px-2 py-1.5 text-sm transition-colors',
			selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
			disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
		)}
	>
		{icon}
		{label}
	</button>
);
