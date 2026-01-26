import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Save, Search, Settings, Tv } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface DashboardHeaderProps {
	dashboardName: string;
	onDashboardNameChange: (name: string) => void;
	onDashboardNameBlur: () => void;
	isDirty: boolean;
	onSave: () => void;
	onSettingsClick?: () => void;
	isRefreshing: boolean;
	lastRefresh?: Date;
	onRefresh: () => void;
	onLaunchTVMode?: () => void;
	dashboards?: Dashboard[];
	onDashboardSelect?: (dashboard: Dashboard) => void;
	showTvModeButton?: boolean;
	onNewDashboard?: () => void;
	isDraft?: boolean;
}

export const DashboardHeader = ({
	dashboardName,
	onDashboardNameChange,
	onDashboardNameBlur,
	isDirty,
	onSave,
	onSettingsClick,
	isRefreshing,
	lastRefresh,
	onRefresh,
	onLaunchTVMode,
	dashboards = [],
	onDashboardSelect,
	showTvModeButton = true,
	onNewDashboard,
	isDraft = false,
}: DashboardHeaderProps) => {
	const [isEditingName, setIsEditingName] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	const filteredDashboards = useMemo(() => {
		return dashboards.filter(
			(d) => d.name !== dashboardName && d.name.toLowerCase().includes(searchQuery.toLowerCase())
		);
	}, [dashboards, dashboardName, searchQuery]);

	useEffect(() => {
		if (isEditingName && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditingName]);

	const handleNameClick = () => {
		setIsEditingName(true);
	};

	const handleNameBlur = () => {
		setIsEditingName(false);
		onDashboardNameBlur();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			handleNameBlur();
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<div className="flex-1 flex items-center gap-2 min-w-0">
					{isEditingName ? (
						<Input
							ref={inputRef}
							value={dashboardName}
							onChange={(e) => onDashboardNameChange(e.target.value)}
							onBlur={handleNameBlur}
							onKeyDown={handleKeyDown}
							className="text-xl font-bold h-9 w-auto min-w-[150px] max-w-[300px]"
						/>
					) : (
						<div className="flex items-center gap-2 min-w-0">
							<div
								onClick={handleNameClick}
								className="text-xl font-bold tracking-tight text-foreground cursor-pointer border border-transparent hover:border-input rounded px-2 py-1 -ml-2 transition-colors truncate"
								title={dashboardName || 'New Dashboard'}
							>
								{dashboardName || 'New Dashboard'}
							</div>
							{isDraft && (
								<span className="text-[10px] text-muted-foreground border border-muted-foreground/40 rounded px-1.5 py-0.5 leading-none flex-shrink-0">
									Draft
								</span>
							)}
						</div>
					)}

					{onSettingsClick && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onSettingsClick}
							title="Dashboard Settings"
							className="rounded-full h-8 w-8 hover:bg-muted hover:text-foreground flex-shrink-0"
						>
							<Settings className="h-4 w-4" />
						</Button>
					)}

					{isDirty && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onSave}
							title="Save Dashboard"
							className="rounded-full h-8 w-8 hover:bg-muted flex-shrink-0"
						>
							<Save className="h-4 w-4 text-foreground" />
						</Button>
					)}
				</div>

				<div className="flex items-center gap-2 flex-shrink-0">
					{onNewDashboard && (
						<Button size="sm" onClick={onNewDashboard} className="gap-2">
							<Plus className="h-4 w-4" />
							<span className="hidden sm:inline">New Dashboard</span>
						</Button>
					)}

					{showTvModeButton && (
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button size="sm" disabled className="gap-2 opacity-50 cursor-not-allowed">
										<Tv className="h-4 w-4" />
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-[200px] text-center">
								<p>This feature is not available in the playground. Book a demo to see it in action.</p>
							</TooltipContent>
						</Tooltip>
					)}
				</div>
			</div>

			<div className="flex items-center gap-2">
				<div className="relative flex-1 min-w-0">
					<div className="flex items-center h-8 rounded-md border bg-background px-3 focus-within:ring-1 focus-within:ring-ring">
						<Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-foreground" />
						<input
							ref={searchInputRef}
							className="flex h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
							placeholder="Search dashboards..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onFocus={() => setIsSearchFocused(true)}
							onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
						/>
					</div>
					{isSearchFocused && filteredDashboards.length > 0 && (
						<div className="absolute left-0 top-10 z-50 w-full max-w-64 rounded-lg border shadow-md bg-popover overflow-hidden">
							<ul className="max-h-[300px] overflow-y-auto py-1">
								{filteredDashboards.map((dashboard) => (
									<li
										key={dashboard.id}
										className="px-2 py-1.5 text-sm text-popover-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm mx-1"
										onMouseDown={(e) => {
											e.preventDefault();
											onDashboardSelect?.(dashboard);
											setSearchQuery('');
											setIsSearchFocused(false);
											searchInputRef.current?.blur();
										}}
									>
										{dashboard.name}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>

				<Button
					variant="ghost"
					size="icon"
					onClick={onRefresh}
					disabled={isRefreshing}
					className="rounded-full h-8 w-8 hover:bg-muted hover:text-foreground flex-shrink-0"
					title="Refresh"
				>
					<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
				</Button>
			</div>
		</div>
	);
};
