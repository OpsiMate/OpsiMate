import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { getTagKeyColumnId, TagKeyInfo } from '@/types';
import { X } from 'lucide-react';

interface GroupByColumn {
	id: string;
	label: string;
}

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
	groupByColumns?: string[];
	onGroupByChange?: (columns: string[]) => void;
	availableGroupByColumns?: GroupByColumn[];
}

const DEFAULT_GROUP_BY_COLUMNS: GroupByColumn[] = [
	{ id: 'serviceName', label: 'Service' },
	{ id: 'status', label: 'Status' },
	{ id: 'type', label: 'Type' },
	{ id: 'alertName', label: 'Alert Name' },
];

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
	groupByColumns = [],
	onGroupByChange,
	availableGroupByColumns = DEFAULT_GROUP_BY_COLUMNS,
}: DashboardSettingsDrawerProps) => {
	const availableColumns = Object.entries(columnLabels).filter(([key]) => !excludeColumns.includes(key));

	const handleGroupByToggle = (columnId: string) => {
		if (!onGroupByChange) return;
		if (groupByColumns.includes(columnId)) {
			onGroupByChange(groupByColumns.filter((c) => c !== columnId));
		} else {
			onGroupByChange([...groupByColumns, columnId]);
		}
	};

	const handleRemoveGroupBy = (columnId: string) => {
		if (!onGroupByChange) return;
		onGroupByChange(groupByColumns.filter((c) => c !== columnId));
	};

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

					{onGroupByChange && (
						<>
							<Separator />

							<div className="space-y-4">
								<h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
									Group By (TV Mode)
								</h3>
								<p className="text-sm text-muted-foreground">
									Select columns to group alerts in the heatmap view.
								</p>

								{groupByColumns.length > 0 && (
									<div className="flex flex-wrap gap-2 mb-4">
										{groupByColumns.map((colId) => {
											const column = availableGroupByColumns.find((c) => c.id === colId);
											return (
												<Badge key={colId} variant="secondary" className="gap-1 pr-1">
													{column?.label || colId}
													<button
														onClick={() => handleRemoveGroupBy(colId)}
														className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
													>
														<X className="h-3 w-3" />
													</button>
												</Badge>
											);
										})}
									</div>
								)}

								<div className="space-y-3">
									{availableGroupByColumns.map((column) => (
										<div key={column.id} className="flex items-center space-x-2">
											<Checkbox
												id={`groupby-${column.id}`}
												checked={groupByColumns.includes(column.id)}
												onCheckedChange={() => handleGroupByToggle(column.id)}
											/>
											<Label
												htmlFor={`groupby-${column.id}`}
												className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
											>
												{column.label}
											</Label>
										</div>
									))}
								</div>
							</div>
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
};
