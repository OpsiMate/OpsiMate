import { Dashboard } from '@/hooks/queries/dashboards/dashboards.types';
import { Tag } from '@OpsiMate/shared';
import { FAVORITES_STORAGE_KEY } from './Dashboards.constants';
import { DashboardWithFavorite } from './Dashboards.types';

const DASHBOARD_TAGS_STORAGE_KEY = 'OpsiMate-dashboard-tags';

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

export const getDashboardTags = (): Record<string, Tag[]> => {
	try {
		const stored = localStorage.getItem(DASHBOARD_TAGS_STORAGE_KEY);
		return stored ? JSON.parse(stored) : {};
	} catch {
		return {};
	}
};

export const saveDashboardTags = (dashboardTags: Record<string, Tag[]>): void => {
	localStorage.setItem(DASHBOARD_TAGS_STORAGE_KEY, JSON.stringify(dashboardTags));
};

export const addTagToDashboard = (dashboardId: string, tag: Tag): Record<string, Tag[]> => {
	const dashboardTags = getDashboardTags();
	const currentTags = dashboardTags[dashboardId] || [];

	if (!currentTags.some((t) => t.id === tag.id)) {
		dashboardTags[dashboardId] = [...currentTags, tag];
		saveDashboardTags(dashboardTags);
	}

	return dashboardTags;
};

export const removeTagFromDashboard = (dashboardId: string, tagId: number): Record<string, Tag[]> => {
	const dashboardTags = getDashboardTags();
	const currentTags = dashboardTags[dashboardId] || [];
	dashboardTags[dashboardId] = currentTags.filter((t) => t.id !== tagId);
	saveDashboardTags(dashboardTags);
	return dashboardTags;
};

export const enrichDashboardsWithFavorites = (dashboards: Dashboard[]): DashboardWithFavorite[] => {
	const favorites = getFavoriteDashboards();
	const dashboardTags = getDashboardTags();
	return dashboards.map((dashboard) => ({
		...dashboard,
		isFavorite: favorites.includes(dashboard.id),
		tags: dashboardTags[dashboard.id] || [],
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
