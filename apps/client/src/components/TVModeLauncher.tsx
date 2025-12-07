import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Monitor } from 'lucide-react';
import { Filters } from '@/components/Dashboard';

interface TVModeLauncherProps {
	children?: React.ReactNode;
	currentFilters?: Filters;
	currentVisibleColumns?: Record<string, boolean>;
	currentSearchTerm?: string;
	activeViewId?: string;
}

export const TVModeLauncher = ({
	children,
	currentFilters = {},
	currentVisibleColumns = {},
	currentSearchTerm = '',
	activeViewId,
}: TVModeLauncherProps) => {
	const navigate = useNavigate();

	const handleLaunchTVMode = () => {
		// Build URL with default settings and current dashboard state
		const params = new URLSearchParams({
			autoRefresh: 'true',
			refreshInterval: '30000', // 30 seconds
			viewRotation: 'false',
			rotationInterval: '60000', // 60 seconds
			defaultView: 'all',
			gridColumns: '6', // This will be overridden by smart grid anyway
		});

		// Add current dashboard state to URL parameters
		if (currentSearchTerm) {
			params.set('searchTerm', currentSearchTerm);
		}
		if (activeViewId) {
			params.set('activeViewId', activeViewId);
		}
		// Serialize filters and visible columns
		if (Object.keys(currentFilters).length > 0) {
			params.set('filters', JSON.stringify(currentFilters));
		}
		if (Object.keys(currentVisibleColumns).length > 0) {
			params.set('visibleColumns', JSON.stringify(currentVisibleColumns));
		}

		navigate(`/tv-mode?${params.toString()}`);
	};

	return children ? (
		<div onClick={handleLaunchTVMode} className="cursor-pointer">
			{children}
		</div>
	) : (
		<Button size="sm" onClick={handleLaunchTVMode} className="flex items-center gap-2">
			<Monitor className="h-4 w-4" />
			TV Mode
		</Button>
	);
};
