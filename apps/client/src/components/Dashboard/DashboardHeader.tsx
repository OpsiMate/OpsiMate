import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Tv, Save, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
	onLaunchTVMode: () => void;
	dashboards?: { id: string; name: string }[]; // For autocomplete
	onDashboardSelect?: (id: string) => void;
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

				<Button variant="ghost" size="icon" onClick={onSettingsClick} title="Dashboard Settings">
					<Settings className="h-5 w-5" />
				</Button>

				{isDirty && (
					<Button variant="ghost" size="icon" onClick={onSave} title="Save Dashboard">
						<Save className="h-5 w-5 text-primary" />
					</Button>
				)}
			</div>

			<div className="flex items-center gap-2">
				<div className={cn("flex items-center transition-all duration-300 ease-in-out", isSearchOpen ? "w-64" : "w-auto")}>
                    {isSearchOpen ? (
                        <div className="relative w-full flex items-center">
                            <Command className="rounded-lg border shadow-md absolute right-0 top-0 z-50 w-64 bg-popover">
                                <CommandInput
                                    placeholder="Search dashboards..."
                                    autoFocus
                                    onBlur={() => {
                                        // Small delay to allow clicking on items
                                        setTimeout(() => setIsSearchOpen(false), 200);
                                    }}
                                />
                                <CommandList>
                                    <CommandEmpty>No results found.</CommandEmpty>
                                    <CommandGroup heading="Dashboards">
                                        {dashboards.map((dashboard) => (
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
                        </div>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(true)}>
                            <Search className="h-5 w-5" />
                        </Button>
                    )}
                </div>

				<Button size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-2">
					<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
					Refresh
				</Button>
				<Button size="sm" onClick={onLaunchTVMode} className="gap-2">
					<Tv className="h-4 w-4" />
					TV Mode
				</Button>
			</div>
		</div>
	);
};
