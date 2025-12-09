import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';
import { Trash2 } from 'lucide-react';

export interface DashboardSettingsDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	dashboardName: string;
	onDashboardNameChange: (name: string) => void;
	dashboardDescription: string;
	onDashboardDescriptionChange: (description: string) => void;
	visibleColumns: string[];
	onColumnToggle: (column: string) => void;
	columnLabels: Record<string, string>;
	excludeColumns?: string[];
	tagKeys?: TagKeyInfo[];
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
	visibleColumns,
	onColumnToggle,
	columnLabels,
	excludeColumns = [],
	tagKeys = [],
	onDelete,
	canDelete = false,
}: DashboardSettingsDrawerProps) => {
	const availableColumns = Object.entries(columnLabels).filter(([key]) => !excludeColumns.includes(key));

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Dashboard Settings</SheetTitle>
					<SheetDescription>Configure your dashboard details and view settings.</SheetDescription>
				</SheetHeader>

				<div className="py-6 space-y-8">
					{/* Dashboard Details Section */}
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

					<Separator />

					{/* Column Visibility Section */}
					<div className="space-y-4">
						<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
							Table Columns
						</h3>
						<div className="space-y-3">
							{availableColumns.map(([key, label]) => (
								<div key={key} className="flex items-center space-x-2">
									<Checkbox
										id={key}
										checked={visibleColumns.includes(key)}
										onCheckedChange={() => onColumnToggle(key)}
									/>
									<Label
										htmlFor={key}
										className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
									>
										{label}
									</Label>
								</div>
							))}
						</div>

						{tagKeys.length > 0 && (
							<>
								<div className="pt-2">
									<h4 className="text-sm font-medium mb-2">Alert Tags</h4>
									<div className="space-y-3">
										{tagKeys.map((tagKey) => {
											const columnId = getTagKeyColumnId(tagKey.key);
											return (
												<div key={columnId} className="flex items-center space-x-2">
													<Checkbox
														id={columnId}
														checked={visibleColumns.includes(columnId)}
														onCheckedChange={() => onColumnToggle(columnId)}
													/>
													<Label
														htmlFor={columnId}
														className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
													>
														{tagKey.label}
													</Label>
												</div>
											);
										})}
									</div>
								</div>
							</>
						)}
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
