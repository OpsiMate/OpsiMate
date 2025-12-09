import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Save, Search, Settings, Tv } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface DashboardHeaderProps {
	dashboardName: string;
	onDashboardNameChange: (name: string) => void;
	onDashboardNameBlur: () => void;
	isDirty: boolean;
	onSave: () => void;
	onSettingsClick: () => void;
	isRefreshing: boolean;
	lastRefresh?: Date;
	onRefresh: () => void;
	onLaunchTVMode?: () => void;
	dashboards?: { id: string; name: string }[];
	onDashboardSelect?: (id: string) => void;
    showTvModeButton?: boolean;
	onNewDashboard?: () => void;
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
}: DashboardHeaderProps) => {
	const [isEditingName, setIsEditingName] = useState(false);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

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
		<div className="flex items-center justify-between mb-4">
			<div className="flex-1 flex items-center gap-4">
				{isEditingName ? (
					<Input
						ref={inputRef}
						value={dashboardName}
						onChange={(e) => onDashboardNameChange(e.target.value)}
						onBlur={handleNameBlur}
						onKeyDown={handleKeyDown}
						className="text-2xl font-bold h-10 w-auto min-w-[200px] max-w-[400px]"
					/>
				) : (
					<div
						onClick={handleNameClick}
						className="text-2xl font-bold tracking-tight text-foreground cursor-pointer border border-transparent hover:border-input rounded px-2 py-1 -ml-2 transition-colors"
					>
						{dashboardName || 'New Dashboard'}
					</div>
				)}

				<Button
                    variant="ghost"
                    size="icon"
                    onClick={onSettingsClick}
                    title="Dashboard Settings"
                    className="rounded-full h-8 w-8 hover:bg-muted"
                >
					<Settings className="h-4 w-4" />
				</Button>

				{isDirty && (
					<Button
                        variant="ghost"
                        size="icon"
                        onClick={onSave}
                        title="Save Dashboard"
                        className="rounded-full h-8 w-8 hover:bg-muted"
                    >
						<Save className="h-4 w-4 text-primary" />
					</Button>
				)}
			</div>

			<div className="flex items-center gap-2">
				{isSearchOpen ? (
                    <div className="relative">
                        <div className="flex items-center h-8 w-48 rounded-md border bg-background px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder="Search dashboards..."
                                autoFocus
                                onBlur={() => {
                                    setTimeout(() => setIsSearchOpen(false), 200);
                                }}
                            />
                        </div>
                        {dashboards.filter((d) => d.name !== dashboardName).length > 0 && (
                            <Command className="absolute left-0 top-10 z-50 w-48 rounded-lg border shadow-md bg-popover">
                                <CommandList className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                                    <CommandGroup heading="Dashboards">
                                        {dashboards
                                            .filter((d) => d.name !== dashboardName)
                                            .map((dashboard) => (
                                                <CommandItem
                                                    key={dashboard.id}
                                                    onSelect={() => {
                                                        onDashboardSelect?.(dashboard.id);
                                                        setIsSearchOpen(false);
                                                    }}
                                                >
                                                    {dashboard.name}
                                                </CommandItem>
                                            ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        )}
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSearchOpen(true)}
                        className="rounded-full h-8 w-8 hover:bg-muted"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                )}

				{onNewDashboard && (
					<Button
						variant="ghost"
						size="icon"
						onClick={onNewDashboard}
						title="New Dashboard"
						className="rounded-full h-8 w-8 hover:bg-muted"
					>
						<Plus className="h-4 w-4" />
					</Button>
				)}

				<Button size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-2">
					<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
					Refresh
				</Button>
				{showTvModeButton && onLaunchTVMode && (
                    <Button size="sm" onClick={onLaunchTVMode} className="gap-2">
                        <Tv className="h-4 w-4" />
                        TV Mode
                    </Button>
                )}
			</div>
		</div>
	);
};
