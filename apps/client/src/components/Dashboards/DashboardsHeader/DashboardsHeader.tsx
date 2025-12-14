import { Button } from '@/components/ui/button';
import { LayoutDashboard, Plus } from 'lucide-react';

interface DashboardsHeaderProps {
	onCreateDashboard: () => void;
}

export const DashboardsHeader = ({ onCreateDashboard }: DashboardsHeaderProps) => {
	return (
		<div className="flex items-center justify-between mb-6">
			<div className="flex items-center gap-3">
				<LayoutDashboard className="h-7 w-7 text-primary" />
				<h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboards</h1>
			</div>
			<Button onClick={onCreateDashboard} className="gap-2">
				<Plus className="h-4 w-4" />
				New Dashboard
			</Button>
		</div>
	);
};
