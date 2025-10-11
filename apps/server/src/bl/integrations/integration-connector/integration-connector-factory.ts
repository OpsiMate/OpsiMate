import {IntegrationType} from '@OpsiMate/shared';
import {IntegrationConnector} from "./integration-connector.js";
import {GrafanaIntegrationConnector} from "./grafana-integration-connector.js";
import {KibanaIntegrationConnector} from "./kibana-integration-connector.js";
import {DatadogIntegrationConnector} from "./datadog-integration-connector.js";


export function integrationConnectorFactory(type: IntegrationType): IntegrationConnector {
  return integrationsMap[type];
}

const integrationsMap = {
  [IntegrationType.Grafana]: new GrafanaIntegrationConnector(),
  [IntegrationType.Kibana]: new KibanaIntegrationConnector(),
  [IntegrationType.Datadog]: new DatadogIntegrationConnector(),
}