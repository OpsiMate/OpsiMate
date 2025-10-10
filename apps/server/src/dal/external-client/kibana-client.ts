import { Logger } from "@OpsiMate/shared";

const logger = new Logger("dal/external-client/kibana-client");

interface KibanaSavedObject<T> {
  id: string;
  type: string;
  attributes: T;
  references?: Array<{ id: string; type: string; name: string }>;
}

interface KibanaFindResponse<T> {
  saved_objects: KibanaSavedObject<T>[];
  total: number;
  page: number;
  per_page: number;
}

interface KibanaTagAttributes {
  name: string;
  description?: string;
  color?: string;
}

interface KibanaDashboardAttributes {
  title: string;
  [key: string]: unknown; // if there are more unknown fields
}

export interface DashboardResult {
  title: string;
  url: string;
}

export class KibanaClient {
  constructor(
    private url: string,
    private apiKey: string,
  ) {}

  async searchDashboardsByTag(tagName: string): Promise<DashboardResult[]> {
    try {
      logger.info(`Searching Kibana dashboards with tag: ${tagName}`);

      if (!this.url || !this.apiKey) {
        logger.error("Missing Kibana URL or API key");
        return [];
      }

      const baseUrl = this.url.replace(/\/$/, "");

      // Step 1: Get Tag ID by Name
      logger.info(
        `Fetching tags from ${baseUrl}/api/saved_objects/_find?type=tag`,
      );
      const tagResponse: Response = await fetch(
        `${baseUrl}/api/saved_objects/_find?type=tag&per_page=1000`,
        {
          headers: {
            "kbn-xsrf": "true",
            Authorization: `ApiKey ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!tagResponse.ok) {
        const errorText = await tagResponse.text();
        logger.error(`Kibana API error (${tagResponse.status}): ${errorText}`);
        throw new Error(
          `Kibana API error: ${tagResponse.status} - ${errorText}`,
        );
      }

      const tagData: KibanaFindResponse<KibanaTagAttributes> =
        (await tagResponse.json()) as KibanaFindResponse<KibanaTagAttributes>;
      logger.info(`Found ${tagData.saved_objects.length} tags`);

      const tagObject = tagData.saved_objects.find(
        (tag) => tag.attributes.name === tagName,
      );

      if (!tagObject) {
        logger.info(`Tag '${tagName}' not found`);
        return [];
      }

      const tagId = tagObject.id;
      logger.info(`Found tag '${tagName}' with ID: ${tagId}`);

      // Step 2: Fetch Dashboards with Tag ID
      const queryParam = encodeURIComponent(
        JSON.stringify({ type: "tag", id: tagId }),
      );
      const dashboardUrl = `${baseUrl}/api/saved_objects/_find?type=dashboard&has_reference=${queryParam}`;

      logger.info(`Fetching dashboards with tag ID ${tagId}`);
      const dashboardResponse = await fetch(dashboardUrl, {
        headers: {
          "kbn-xsrf": "true",
          Authorization: `ApiKey ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!dashboardResponse.ok) {
        const errorText = await dashboardResponse.text();
        logger.error(
          `Kibana API error (${dashboardResponse.status}): ${errorText}`,
        );
        throw new Error(
          `Kibana API error: ${dashboardResponse.status} - ${errorText}`,
        );
      }

      const dashboardData: KibanaFindResponse<KibanaDashboardAttributes> =
        (await dashboardResponse.json()) as KibanaFindResponse<KibanaDashboardAttributes>;
      logger.info(
        `Found ${dashboardData.saved_objects.length} dashboards with tag '${tagName}'`,
      );

      return dashboardData.saved_objects.map((dashboard) => ({
        title: dashboard.attributes.title,
        url: `/app/dashboards#/view/${dashboard.id}`,
      }));
    } catch (error: unknown) {
      logger.error("Error searching Kibana dashboards by tag:", {
        extraArgs: { error },
      });
      return [];
    }
  }
}
