import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { FAVORITES_STORAGE_KEY } from './Dashboards.constants';
import { DashboardWithFavorite } from './Dashboards.types';

export const getFavoriteDashboards = (): string[] => {
	try {
		const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
};

export const saveFavoriteDashboards = (favorites: string[]): void => {
	localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
};

export const toggleFavorite = (dashboardId: string): string[] => {
	const favorites = getFavoriteDashboards();
	const index = favorites.indexOf(dashboardId);

	if (index === -1) {
		favorites.push(dashboardId);
	} else {
		favorites.splice(index, 1);
	}

	saveFavoriteDashboards(favorites);
	return favorites;
};

export const enrichDashboardsWithFavorites = (dashboards: Dashboard[]): DashboardWithFavorite[] => {
	const favorites = getFavoriteDashboards();
	return dashboards.map((dashboard) => ({
		...dashboard,
		isFavorite: favorites.includes(dashboard.id),
		tags: [],
	}));
};

export const sortDashboardsByFavorite = (dashboards: DashboardWithFavorite[]): DashboardWithFavorite[] => {
	return [...dashboards].sort((a, b) => {
		if (a.isFavorite && !b.isFavorite) return -1;
		if (!a.isFavorite && b.isFavorite) return 1;
		return a.name.localeCompare(b.name);
	});
};

export const filterDashboards = (dashboards: DashboardWithFavorite[], searchTerm: string): DashboardWithFavorite[] => {
	if (!searchTerm.trim()) return dashboards;

	const lowerSearch = searchTerm.toLowerCase();
	return dashboards.filter(
		(d) =>
			d.name.toLowerCase().includes(lowerSearch) ||
			(d.description && d.description.toLowerCase().includes(lowerSearch)) ||
			(d.tags && d.tags.some((tag) => tag.name.toLowerCase().includes(lowerSearch)))
	);
};

export const formatDate = (dateString?: string): string => {
	if (!dateString) return '-';
	try {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	} catch {
		return '-';
	}
};

export const getContrastColor = (hexColor: string): string => {
	const hex = hexColor.replace('#', '');
	const r = parseInt(hex.substr(0, 2), 16);
	const g = parseInt(hex.substr(2, 2), 16);
	const b = parseInt(hex.substr(4, 2), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.5 ? '#000000' : '#ffffff';
};
