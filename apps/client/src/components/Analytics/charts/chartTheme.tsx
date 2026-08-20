import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReactNode } from 'react';

// Shared recharts dressing: the tooltip reads from CSS variables so it follows the
// theme; axes stay muted so the data carries the contrast.
export const tooltipStyle = {
	backgroundColor: 'hsl(var(--popover))',
	border: '1px solid hsl(var(--border))',
	borderRadius: '8px',
	color: 'hsl(var(--popover-foreground))',
	fontSize: '12px',
};
export const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

interface ChartCardProps {
	title: string;
	hint?: string;
	children: ReactNode;
}

export const ChartCard = ({ title, hint, children }: ChartCardProps) => (
	<Card>
		<CardHeader className="pb-2">
			<CardTitle className="text-sm font-semibold">{title}</CardTitle>
			{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
		</CardHeader>
		<CardContent className="pt-0">{children}</CardContent>
	</Card>
);
