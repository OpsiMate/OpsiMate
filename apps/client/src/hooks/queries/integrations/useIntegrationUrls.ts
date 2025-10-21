import { useQuery } from '@tanstack/react-query';
import { integrationApi } from '@/lib/api';
import { queryKeys } from '../queryKeys';

export const useIntegrationUrls = (integrationId: number | null, tags: string[]) => {
  return useQuery({
    queryKey: [...queryKeys.integrations, integrationId, 'urls', tags],
    queryFn: async () => {
      if (!integrationId || tags.length === 0) {
        return [];
      }

      // Make separate API calls for each tag
      const dashboardPromises = tags.map(async tagName => {
        try {
          const response = await integrationApi.getIntegrationUrls(integrationId, [tagName]);

          if (response.success && response.data) {
            return response.data;
          } else {
            console.warn(`Failed to fetch dashboards for tag ${tagName}:`, response.error);
            return [];
          }
        } catch (error) {
          console.error(`Error fetching dashboards for tag ${tagName}:`, error);
          return [];
        }
      });

      // Wait for all API calls to complete
      const dashboardResults = await Promise.all(dashboardPromises);

      // Combine all results into a single array
      let allDashboards: Array<{ name: string; url: string }> = [];
      dashboardResults.forEach(dashboards => {
        allDashboards = [...allDashboards, ...dashboards];
      });

      // Remove duplicates based on URL
      const uniqueDashboards = allDashboards.filter(
        (dashboard, index, self) => index === self.findIndex(d => d.url === dashboard.url)
      );

      // Sort dashboards alphabetically by name
      uniqueDashboards.sort((a, b) => a.name.localeCompare(b.name));

      return uniqueDashboards;
    },
    enabled: !!integrationId && tags.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
