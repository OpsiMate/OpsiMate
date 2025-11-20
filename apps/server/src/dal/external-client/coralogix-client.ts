import { Logger } from '@OpsiMate/shared';

const logger = new Logger('dal/external-client/coralogix-client');

export interface CoralogixDashboardSummary {
  authorId: string,
  createTime: string,
  description: string,
  folder: {
    id: string,
    name: string,
    parentId: string,
  },
  id: string,
  isDefault: boolean,
  isLocked: boolean,
  isPinned: boolean,
  lockerAuthorId: string,
  name: string,
  slugName: string,
  updateTime: string,
  url?: string,
}

export class CoralogixClient {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async getAllDashboard(): Promise<CoralogixDashboardSummary[]> {
    try {
      logger.info("Fetching all Coralogix dashboards");

      const baseUrl = this.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/mgmt/openapi/latest/v1/dashboards/dashboards/catalog`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Coralogix API error (${response.status}): ${errorText}`);
        throw new Error(`Coralogix API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as { items?: CoralogixDashboardSummary[] };

      if (!data.items || !Array.isArray(data.items)) {
        logger.info('No dashboards found in Coralogix response');
        return [];
      }

      logger.info(`Found ${data.items.length} Coralogix dashboards`);

      // Add URL to each dashboard with absolute URL
      return data.items.map((dashboard) => ({
        ...dashboard,
        url: `${baseUrl}/dashboards/${dashboard.id}`,
      }));
    } catch (error) {
      logger.error('Error fetching Coralogix dashboards:', error);
      return [];
    }
  }

  async getDashboardsByTags(tags: string[]): Promise<CoralogixDashboardSummary[]> {
    try {
      if (!tags || tags.length === 0) {
        logger.info('No tags provided, skipping Coralogix dashboard search');
        return [];
      }

      logger.info(`Searching Coralogix dashboards with tags: ${tags.join(', ')}`);

      // Get all dashboards first
      const allDashboards = await this.getAllDashboard();

      if (allDashboards.length === 0) {
        return [];
      }

      // Filter dashboards by name content (check if any tag is included in the dashboard name)
      const matchingDashboards = allDashboards.filter((dashboard) => {
        if (!dashboard.name) {
          return false;
        }

        const dashboardName = dashboard.name.toLowerCase();

        // Check if any of the service tags are included in the dashboard name
        return tags.some((tag) => dashboardName.includes(tag.toLowerCase()));
      });

      logger.info(
        `Found ${matchingDashboards.length} Coralogix dashboards matching tags in name: ${tags.join(', ')}`
      );
      return matchingDashboards;
    } catch (error) {
      logger.error(`Error searching Coralogix dashboards by tags:`, error);
      return [];
    }
  }
}