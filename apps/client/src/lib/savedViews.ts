import { SavedView } from '@/types/SavedView';
import { Logger } from '@OpsiMate/shared';
import { viewsApi } from './api';

const logger = new Logger('savedViews');

const STORAGE_KEY = 'OpsiMate-saved-views';

// Fallback to localStorage if API fails
export async function getSavedViews(): Promise<SavedView[]> {
	try {
		// Try to get views from API first
		const response = await viewsApi.getViews();

		if (response.success && response.data) {
			return response.data;
		}

		// Fall back to localStorage if API fails
		logger.warn('API call failed, falling back to localStorage', response.error);
		const savedViewsJson = localStorage.getItem(STORAGE_KEY);
		if (!savedViewsJson) return [];
		return JSON.parse(savedViewsJson);
	} catch (error) {
		logger.error('Failed to load saved views:', error);
		return [];
	}
}

export async function saveView(view: SavedView): Promise<void> {
	try {
		// Save to API
		const response = await viewsApi.saveView(view);

		if (!response.success) {
			logger.warn('API save failed, falling back to localStorage', response.error);
			// Fall back to localStorage
			const savedViews = await getSavedViews();
			const existingIndex = savedViews.findIndex(v => v.id === view.id);

			if (existingIndex >= 0) {
				// Update existing view
				savedViews[existingIndex] = view;
			} else {
				// Add new view
				savedViews.push(view);
			}

			localStorage.setItem(STORAGE_KEY, JSON.stringify(savedViews));
		}
	} catch (error) {
		logger.error('Failed to save view:', error);
	}
}

export async function deleteView(viewId: string): Promise<boolean> {
	try {
		// Check if this is a default view
		const savedViews = await getSavedViews();
		const viewToDelete = savedViews.find(view => view.id === viewId);

		// Don't allow deletion of default views
		if (viewToDelete?.isDefault) {
			logger.warn('Cannot delete default view');
			return false;
		}

		// Delete from API
		const response = await viewsApi.deleteView(viewId);

		if (!response.success) {
			logger.warn('API delete failed, falling back to localStorage', response.error);
			// Fall back to localStorage
			const updatedViews = savedViews.filter(view => view.id !== viewId);
			localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedViews));
		}

		return true;
	} catch (error) {
		logger.error('Failed to delete view:', error);
		return false;
	}
}

export async function getActiveViewId(): Promise<string | undefined> {
	try {
		// Get from API
		const response = await viewsApi.getActiveViewId();

		if (response.success && response.data) {
			return response.data.activeViewId || 'default-view';
		}

		// If API returns error (like 404 when no active view is set), handle gracefully
		if (response.error && response.error.includes('404')) {
			// No active view is set on server, this is expected - check localStorage or return default
			const localStorageViewId = localStorage.getItem('OpsiMate-active-view-id');
			return localStorageViewId || 'default-view';
		}

		// For other API errors, fall back to localStorage
		logger.warn('API get active view failed, falling back to localStorage', response.error);
		const localStorageViewId = localStorage.getItem('OpsiMate-active-view-id');

		// If no active view is set, return the default view ID
		return localStorageViewId || 'default-view';
	} catch (error) {
		logger.error('Failed to get active view ID:', error);
		// Return default view ID as fallback
		return 'default-view';
	}
}

export async function setActiveViewId(viewId: string | undefined): Promise<void> {
	try {
		if (viewId) {
			// Set in API
			const response = await viewsApi.setActiveView(viewId);

			if (!response.success) {
				logger.warn('API set active view failed, falling back to localStorage', response.error);
				// Fall back to localStorage
				localStorage.setItem('OpsiMate-active-view-id', viewId);
			}
		} else {
			// For now, just remove from localStorage as the API doesn't have a clear endpoint
			localStorage.removeItem('OpsiMate-active-view-id');
		}
	} catch (error) {
		logger.error('Failed to set active view ID:', error);
	}
}
