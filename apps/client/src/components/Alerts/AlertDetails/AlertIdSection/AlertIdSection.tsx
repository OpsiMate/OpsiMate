interface AlertIdSectionProps {
	alertId: string;
}

export const AlertIdSection = ({ alertId }: AlertIdSectionProps) => {
	return (
		<div className="pt-2">
			<div className="text-xs font-medium text-foreground mb-1">Alert ID</div>
			<code className="text-xs bg-muted px-2 py-1 rounded break-all block text-foreground">{alertId}</code>
		</div>
	);
};
