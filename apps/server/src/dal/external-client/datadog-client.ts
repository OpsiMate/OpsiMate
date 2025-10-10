import { Logger } from "@OpsiMate/shared";

const logger = new Logger("dal/external-client/datadog-client");

export interface DatadogDashboardSummary {
  id: string;
  title: string;
  description?: string;
  url?: string;
  created_at?: string;
  modified_at?: string;
  author_handle?: string;
  tags?: string[];
}

interface DatadogApiResponse<T> {
  dashboards?: T[];
  errors?: string[];
  status?: string;
  meta?: {
    page?: number;
    per_page?: number;
    total_count?: number;
  };
}

export class DatadogClient {
  constructor(
    private url: string,
    private apiKey: string,
    private appKey: string,
  ) {}

  async getAllDashboards(): Promise<DatadogDashboardSummary[]> {
    try {
      logger.info("Fetching all Datadog dashboards");

      // Normalize the URL by removing trailing slash
      const baseUrl = this.url.replace(/\/$/, "");
      const endpoint = `${baseUrl}/api/v1/dashboard`;

      const response = await fetch(endpoint, {
        headers: {
          "DD-API-KEY": this.apiKey,
          "DD-APPLICATION-KEY": this.appKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Datadog API error (${response.status}): ${errorText}`);
        throw new Error(`Datadog API error: ${response.status} - ${errorText}`);
      }

      const data =
        (await response.json()) as DatadogApiResponse<DatadogDashboardSummary>;

      if (data.errors && data.errors.length > 0) {
        logger.error(`Datadog API returned errors: ${data.errors.join(", ")}`);
        throw new Error(`Datadog API errors: ${data.errors.join(", ")}`);
      }

      if (!data.dashboards) {
        logger.info("No dashboards found in Datadog response");
        return [];
      }

      logger.info(`Found ${data.dashboards.length} Datadog dashboards`);

      // Add URL to each dashboard with absolute URL
      return data.dashboards.map((dashboard) => ({
        ...dashboard,
        url: `${baseUrl}/dashboards/${dashboard.id}`,
      }));
    } catch (error) {
      logger.error("Error fetching Datadog dashboards:", error);
      return [];
    }
  }

  async getDashboardsByTags(
    tags: string[],
  ): Promise<DatadogDashboardSummary[]> {
    try {
      if (!tags || tags.length === 0) {
        logger.info("No tags provided, skipping Datadog dashboard search");
        return [];
      }

      logger.info(`Searching Datadog dashboards with tags: ${tags.join(", ")}`);

      // Get all dashboards first
      const allDashboards = await this.getAllDashboards();

      if (allDashboards.length === 0) {
        return [];
      }

      // Filter dashboards by title content (check if any tag is included in the dashboard title)
      const matchingDashboards = allDashboards.filter((dashboard) => {
        if (!dashboard.title) {
          return false;
        }

        const dashboardTitle = dashboard.title.toLowerCase();

        // Check if any of the service tags are included in the dashboard title
        return tags.some((tag) => dashboardTitle.includes(tag.toLowerCase()));
      });

      logger.info(
        `Found ${matchingDashboards.length} Datadog dashboards matching tags in title: ${tags.join(", ")}`,
      );
      return matchingDashboards;
    } catch (error) {
      logger.error(`Error searching Datadog dashboards by tags:`, error);
      return [];
    }
  }
}
