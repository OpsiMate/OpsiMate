interface StatusChipProps {
	color: string;
	label: string;
}

export const StatusChip = ({ color, label }: StatusChipProps) => (
	<div className="flex items-center gap-1.5">
		<div className="w-5 h-5 rounded border border-border shadow-sm" style={{ backgroundColor: color }} />
		<span className="text-sm font-medium text-foreground">{label}</span>
	</div>
);
