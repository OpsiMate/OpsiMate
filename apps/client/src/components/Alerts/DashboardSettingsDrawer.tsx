import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';

export interface DashboardSettingsDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	dashboardName: string;
	onDashboardNameChange: (name: string) => void;
	dashboardDescription: string;
	onDashboardDescriptionChange: (description: string) => void;
	onDelete?: () => void;
	canDelete?: boolean;
}

export const DashboardSettingsDrawer = ({
	open,
	onOpenChange,
	dashboardName,
	onDashboardNameChange,
	dashboardDescription,
	onDashboardDescriptionChange,
	onDelete,
	canDelete = false,
}: DashboardSettingsDrawerProps) => {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Dashboard Settings</SheetTitle>
					<SheetDescription>Configure your dashboard details.</SheetDescription>
				</SheetHeader>

				<div className="py-6 space-y-8">
					<div className="space-y-4">
						<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
							Dashboard Details
						</h3>
						<div className="grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="dashboard-name">Name</Label>
								<Input
									id="dashboard-name"
									value={dashboardName}
									onChange={(e) => onDashboardNameChange(e.target.value)}
									placeholder="Dashboard Name"
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="dashboard-description">Description</Label>
								<Textarea
									id="dashboard-description"
									value={dashboardDescription}
									onChange={(e) => onDashboardDescriptionChange(e.target.value)}
									placeholder="Dashboard Description"
									className="resize-none"
									rows={3}
								/>
							</div>
						</div>
					</div>

					{canDelete && onDelete && (
						<>
							<Separator />
							<div className="space-y-4">
								<Button variant="destructive" className="w-full gap-2" onClick={onDelete}>
									<Trash2 className="h-4 w-4" />
									Delete Dashboard
								</Button>
							</div>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};
