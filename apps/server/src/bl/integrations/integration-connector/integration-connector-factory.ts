import { IntegrationType } from '@OpsiMate/shared';
import { IntegrationConnector } from './integration-connector';
import { GrafanaIntegrationConnector } from './grafana-integration-connector';
import { KibanaIntegrationConnector } from './kibana-integration-connector';
import { DatadogIntegrationConnector } from './datadog-integration-connector';

export function integrationConnectorFactory(type: IntegrationType): IntegrationConnector {
	return integrationsMap[type];
}

const integrationsMap = {
	[IntegrationType.Grafana]: new GrafanaIntegrationConnector(),
	[IntegrationType.Kibana]: new KibanaIntegrationConnector(),
	[IntegrationType.Datadog]: new DatadogIntegrationConnector(),
};
